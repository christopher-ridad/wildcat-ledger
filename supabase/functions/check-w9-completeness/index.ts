// Checks a W-9 for likely-missing required fields via Google Document AI's
// Form Parser, per GitHub issue #29.
//
// Deliberately returns only pass/fail-style flags plus a box position to
// draw on the client -- never persists anything, and never forwards
// extracted field values for anything except what's needed to explain a
// flag (the date text itself isn't sensitive, unlike a name/SSN, which
// this deliberately never reads back even though it's on the form).
//
// Line 3a's tax-classification checkboxes are checked via raw
// visualElements (typed filled_checkbox/unfilled_checkbox directly by
// Document AI) rather than formFields' label-pairing -- pairing was found
// inconsistent between otherwise-identical documents during the spike
// (empty on one run, correctly "☑" on another), but the underlying
// visualElements positions/states were byte-identical across every test
// file, blank template included. See checkTaxClassificationChecked below.
import {
  type Box,
  boxFrom,
  centerOf,
  DocumentAiPage,
  extractText,
  FormField,
  serveDocumentCheck,
  Token,
  VisualElement,
} from '../_shared/documentAi.ts';

interface Flag {
  label: string;
  message: string;
  box: Box | null;
}

// Accepts common US date formats a person might type into a signature
// block (M/D/YYYY, MM-DD-YYYY, etc). Returns null rather than throwing on
// anything it doesn't recognize -- an unparseable value becomes its own
// flag rather than a crash.
function parseUsDate(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  const [, m, d, yRaw] = match;
  const year = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
  const date = new Date(Date.UTC(year, Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

// The W-9's own printed layout is fixed (it's a standard IRS form), so
// these are real coordinates captured from the feasibility spike -- used
// whenever Document AI doesn't pair a field at all, which is exactly what
// happens when that part of the form is genuinely blank (nothing for its
// key-value heuristic to latch onto). See issue #29's spike notes.
const FALLBACK_BOXES: Record<string, Box> = {
  name: boxFrom(0.0992, 0.9424, 0.1247, 0.1451),
  address: boxFrom(0.0968, 0.446, 0.3514, 0.3607),
  cityStateZip: boxFrom(0.0998, 0.2463, 0.3807, 0.391),
  signature: boxFrom(0.123, 0.1911, 0.7344, 0.7553),
  date: boxFrom(0.63, 0.6557, 0.7456, 0.7531),
  tin: boxFrom(0.68, 0.96, 0.464, 0.562),
  taxClassification: boxFrom(0.095, 0.72, 0.222, 0.305),
};

// Line 3a's seven checkbox centers, captured from the spike -- confirmed
// identical across every test file (unsigned, signed, and a genuinely
// blank template), unlike formFields' label-pairing for the same boxes.
const TAX_CLASSIFICATION_CHECKBOXES = [
  { x: 0.1254, y: 0.2323 }, // Individual/sole proprietor
  { x: 0.3001, y: 0.2321 }, // C corporation
  { x: 0.4181, y: 0.2325 }, // S corporation
  { x: 0.5356, y: 0.2321 }, // Partnership
  { x: 0.6414, y: 0.2321 }, // Trust/estate
  { x: 0.1257, y: 0.2492 }, // LLC
  { x: 0.1254, y: 0.2949 }, // Other
];
const CHECKBOX_MATCH_TOLERANCE = 0.015;

// The SSN/EIN entry ("Part I -- Taxpayer Identification Number") is laid
// out as two rows of individual digit boxes, not a single label+value
// blob the way every other field on this form is -- so it never shows up
// in formFields at all. Detected by checking whether Document AI found
// ANY text tokens positioned inside the two digit-box rows, using only
// their positions -- the actual matched characters are never read or
// returned, since an SSN is far more sensitive than anything else this
// check touches. Both boxes are checked as a single region: the W-9 only
// requires ONE of SSN/EIN filled in, not both.
const SSN_ROW = { yMin: 0.464, yMax: 0.503, xMin: 0.68, xMax: 0.96 };
const EIN_ROW = { yMin: 0.526, yMax: 0.562, xMin: 0.68, xMax: 0.96 };

function tokenCenterIn(
  token: Token,
  region: { yMin: number; yMax: number; xMin: number; xMax: number },
) {
  const center = centerOf(token.layout?.boundingPoly);
  if (!center) return false;
  return (
    center.x >= region.xMin &&
    center.x <= region.xMax &&
    center.y >= region.yMin &&
    center.y <= region.yMax
  );
}

function checkTinPresent(tokens: Token[]): Flag[] {
  const hasSsn = tokens.some((t) => tokenCenterIn(t, SSN_ROW));
  const hasEin = tokens.some((t) => tokenCenterIn(t, EIN_ROW));
  if (hasSsn || hasEin) return [];
  return [
    {
      label: 'TIN',
      message: 'Social Security Number or Employer Identification Number looks blank.',
      box: FALLBACK_BOXES.tin,
    },
  ];
}

// Checks whether any of line 3a's seven tax-classification checkboxes is
// marked, by matching Document AI's raw checkbox detections against each
// box's known position on the form -- see the header comment for why this
// uses visualElements rather than formFields' pairing.
function checkTaxClassificationChecked(visualElements: VisualElement[]): Flag[] {
  const checkboxes = visualElements.filter((el) => el.type?.includes('checkbox'));

  const anyChecked = TAX_CLASSIFICATION_CHECKBOXES.some((pos) =>
    checkboxes.some((el) => {
      const center = centerOf(el.layout?.boundingPoly);
      if (!center) return false;
      const close =
        Math.abs(center.x - pos.x) < CHECKBOX_MATCH_TOLERANCE &&
        Math.abs(center.y - pos.y) < CHECKBOX_MATCH_TOLERANCE;
      return close && el.type === 'filled_checkbox';
    }),
  );

  if (anyChecked) return [];
  return [
    {
      label: 'Tax classification',
      message: 'No box appears checked for federal tax classification (line 3a).',
      box: FALLBACK_BOXES.taxClassification,
    },
  ];
}

// A simple "is there any text here at all" check, for the fields where
// presence alone is the whole rule (name, address, signature, etc) --
// distinct from the date field below, which also validates what's there.
function checkFieldPresent(
  documentText: string,
  formFields: FormField[],
  matchName: (name: string) => boolean,
  fallbackBoxKey: keyof typeof FALLBACK_BOXES,
  label: string,
  missingMessage: string,
): Flag[] {
  const field = formFields.find((f) => {
    const name = extractText(documentText, f.fieldName?.textAnchor).trim().toLowerCase();
    return matchName(name);
  });
  const value = field
    ? extractText(documentText, field.fieldValue?.textAnchor).trim()
    : '';
  if (value) return [];

  const box = field?.fieldName?.boundingPoly ?? FALLBACK_BOXES[fallbackBoxKey];
  return [{ label, message: missingMessage, box }];
}

function checkDateField(documentText: string, formFields: FormField[]): Flag[] {
  const dateField = formFields.find((f) => {
    const name = extractText(documentText, f.fieldName?.textAnchor).trim().toLowerCase();
    return name === 'date';
  });

  if (!dateField?.fieldValue) {
    return [
      { label: 'Date', message: 'Signature date looks blank.', box: FALLBACK_BOXES.date },
    ];
  }

  const box =
    dateField.fieldValue.boundingPoly ??
    dateField.fieldName?.boundingPoly ??
    FALLBACK_BOXES.date;
  const raw = extractText(documentText, dateField.fieldValue.textAnchor).trim();
  const parsed = parseUsDate(raw);

  if (!parsed) {
    return [
      {
        label: 'Date',
        message: `Couldn't read the date ("${raw}") -- worth a manual check.`,
        box,
      },
    ];
  }

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  if (parsed.getUTCFullYear() !== todayUtc.getUTCFullYear()) {
    return [
      {
        label: 'Date',
        message: `Dated ${raw}, but it's currently ${todayUtc.getUTCFullYear()}.`,
        box,
      },
    ];
  }
  if (parsed.getTime() > todayUtc.getTime()) {
    return [{ label: 'Date', message: `Dated ${raw}, which is in the future.`, box }];
  }
  return [];
}

function checkW9(
  documentText: string,
  formFields: FormField[],
  tokens: Token[],
  visualElements: VisualElement[],
): Flag[] {
  return [
    ...checkFieldPresent(
      documentText,
      formFields,
      (name) => name.startsWith('1') && name.includes('name of entity'),
      'name',
      'Name (line 1)',
      'Name looks blank.',
    ),
    ...checkFieldPresent(
      documentText,
      formFields,
      (name) => name.startsWith('5') && name.includes('address'),
      'address',
      'Address (line 5)',
      'Address looks blank.',
    ),
    ...checkFieldPresent(
      documentText,
      formFields,
      (name) => name.startsWith('6') && name.includes('city'),
      'cityStateZip',
      'City/State/ZIP (line 6)',
      'City, state, and ZIP look blank.',
    ),
    ...checkFieldPresent(
      documentText,
      formFields,
      (name) => name.includes('signature'),
      'signature',
      'Signature',
      'Signature line looks blank.',
    ),
    ...checkDateField(documentText, formFields),
    ...checkTinPresent(tokens),
    ...checkTaxClassificationChecked(visualElements),
  ];
}

serveDocumentCheck((text, pages) => {
  const page = (pages[0] ?? {}) as DocumentAiPage;
  const formFields: FormField[] = page.formFields ?? [];
  const tokens: Token[] = page.tokens ?? [];
  const visualElements: VisualElement[] = page.visualElements ?? [];

  return { flags: checkW9(text, formFields, tokens, visualElements) };
});
