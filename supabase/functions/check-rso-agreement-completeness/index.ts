// Checks Northwestern's RSO Agreement (2025-2026) for likely-missing
// required sections via Google Document AI's Form Parser, per the same
// GitHub issue #29 workflow used for the W-9 (see check-w9-completeness).
//
// Flags here are section-level, not field-level -- if any required field
// inside a section is blank, this reports one "Section N not filled out"
// flag for that section rather than one per field, per the requested UX.
// Section 2 is plain terms text with nothing to fill in, so it's skipped
// entirely.
//
// Section 4 is Yes/No radio-style rows. Document AI's own checkbox
// classifier (visualElements) only picks up 4 of the 7 rows' circles
// reliably (confirmed against both the raw PDF and a high-resolution
// render during the feasibility spike -- a genuine processor limitation,
// not a resolution issue) so this never relies on it. Instead this
// returns each row's calibrated Yes/No circle position, geometrically
// derived from the row's Yes/No TEXT tokens (which Document AI reads
// correctly in all seven rows) via an offset formula calibrated against
// the four rows the classifier does agree with. The client -- which
// already renders the page to a canvas for the visual preview -- does the
// actual pixel-darkness read of those circles and reports which rows are
// unanswered, since Deno has no easy image-decoding story of its own.
//
// Row b ("reserved on-campus space") has a conditional: if answered Yes,
// the subsection directly below it (reservation number, space reserved,
// event contact person) must also be filled in. That subsection's label
// text is fixed/known (same static form every time), so "filled in" is
// detected the same way as the W-9's TIN check -- by comparing all text
// found in that region against the known label text, never reading back
// anything sensitive (none of this is sensitive, but the technique
// generalizes and needed no page-specific redesign to reuse).
import {
  type Box,
  corsHeaders,
  DocumentAiPage,
  extractText,
  FormField,
  loadDocumentAiConfig,
  processDocument,
  Token,
} from '../_shared/documentAi.ts';

interface SectionFlag {
  section: number;
  page: number;
  message: string;
  box: Box;
}

interface RowRegion {
  key: string;
  label: string;
  page: number;
  yesBox: Box;
  noBox: Box;
}

function boxFrom(xMin: number, xMax: number, yMin: number, yMax: number): Box {
  return {
    normalizedVertices: [
      { x: xMin, y: yMin },
      { x: xMax, y: yMin },
      { x: xMax, y: yMax },
      { x: xMin, y: yMax },
    ],
  };
}

// Each section's overall printed region on the form, used only as the box
// to draw when that section gets flagged -- captured from the feasibility
// spike the same way the W-9's FALLBACK_BOXES were.
const SECTION_BOXES: Record<number, { page: number; box: Box }> = {
  1: { page: 0, box: boxFrom(0.05, 0.96, 0.31, 0.545) },
  3: { page: 1, box: boxFrom(0.05, 0.98, 0.43, 0.53) },
  4: { page: 1, box: boxFrom(0.05, 0.98, 0.565, 0.885) },
  5: { page: 1, box: boxFrom(0.05, 0.98, 0.895, 0.96) },
};

interface FieldSpec {
  matchName: (name: string) => boolean;
}

// Section 1 lives entirely on page 1 (index 0) with no duplicate labels,
// so no y-filtering is needed.
const SECTION_1_FIELDS: FieldSpec[] = [
  { matchName: (n) => n.includes('entered into on this date') },
  { matchName: (n) => n.startsWith('a.') && n.includes('date/time of engagement') },
  { matchName: (n) => n.startsWith('b.') && n.includes('compensation to supplier') },
  { matchName: (n) => n.startsWith('c.') && n.includes('northwestern check payable to') },
  { matchName: (n) => n.startsWith('d.') && n.includes('federal id number') },
  { matchName: (n) => n.startsWith('e.') && n.includes('student group name') },
  { matchName: (n) => n.startsWith('f.') && n.includes('student group contact name') },
  { matchName: (n) => n.startsWith('g.') && n.includes('student group contact email') },
  { matchName: (n) => n.startsWith('h.') && n.includes('description of the event') },
];

// Section 3 and Section 5 (both page 2 / index 1) use the exact same
// labels -- "Signature:", "Date:", "Title:" -- so fields are disambiguated
// by vertical position on the page, not by name.
const SECTION_3_Y_RANGE = { yMin: 0.47, yMax: 0.53 };
const SECTION_3_FIELDS: FieldSpec[] = [
  { matchName: (n) => n.includes('supplier name') },
  { matchName: (n) => n === 'title:' },
  { matchName: (n) => n.includes('address') && !n.includes('email') },
  { matchName: (n) => n.includes('signature') },
  { matchName: (n) => n === 'date:' },
  { matchName: (n) => n.includes('email address') },
];

const SECTION_5_Y_RANGE = { yMin: 0.92, yMax: 0.96 };
const SECTION_5_FIELDS: FieldSpec[] = [
  { matchName: (n) => n === 'name:' },
  { matchName: (n) => n === 'title:' },
  { matchName: (n) => n.includes('signature') },
  { matchName: (n) => n === 'date:' },
];

function fieldNameY(field: FormField): number | null {
  const vertices = field.fieldName?.boundingPoly?.normalizedVertices;
  if (!vertices?.length) return null;
  return vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;
}

function isFieldFilled(
  documentText: string,
  formFields: FormField[],
  spec: FieldSpec,
  yRange?: { yMin: number; yMax: number },
): boolean {
  const field = formFields.find((f) => {
    const name = extractText(documentText, f.fieldName?.textAnchor).trim().toLowerCase();
    if (!spec.matchName(name)) return false;
    if (!yRange) return true;
    const y = fieldNameY(f);
    return y !== null && y >= yRange.yMin && y <= yRange.yMax;
  });
  if (!field) return false;
  return extractText(documentText, field.fieldValue?.textAnchor).trim().length > 0;
}

function checkSection(
  section: number,
  documentText: string,
  formFields: FormField[],
  specs: FieldSpec[],
  yRange?: { yMin: number; yMax: number },
): SectionFlag[] {
  const anyMissing = specs.some(
    (spec) => !isFieldFilled(documentText, formFields, spec, yRange),
  );
  if (!anyMissing) return [];
  const { page, box } = SECTION_BOXES[section];
  return [{ section, page, message: `Section ${section} not filled out.`, box }];
}

// Section 4's seven Yes/No rows -- token positions captured from the
// feasibility spike against the raw (unrendered) PDF, since that's the
// production path. See the header comment for why circles are derived
// from these rather than trusting Document AI's own checkbox detection.
const SECTION_4_ROWS: { key: string; label: string; yes: Box; no: Box }[] = [
  {
    key: 'a',
    label: 'My Student Organization has confirmed funds for this event.',
    yes: boxFrom(0.8271, 0.8572, 0.6334, 0.6431),
    no: boxFrom(0.8993, 0.9221, 0.6334, 0.644),
  },
  {
    key: 'b',
    label: 'My Student Organization has reserved on-campus space for this event.',
    yes: boxFrom(0.8271, 0.8572, 0.6541, 0.6651),
    no: boxFrom(0.8993, 0.9226, 0.6563, 0.6659),
  },
  {
    key: 'c',
    label: 'This agreement has additional terms beyond this contract.',
    yes: boxFrom(0.8265, 0.8567, 0.7521, 0.7626),
    no: boxFrom(0.8993, 0.9226, 0.7525, 0.7618),
  },
  {
    key: 'd',
    label: 'This event may have more than 250 people attending.',
    yes: boxFrom(0.8271, 0.8561, 0.7776, 0.7873),
    no: boxFrom(0.8993, 0.9226, 0.7789, 0.7881),
  },
  {
    key: 'e',
    label: 'This event will have a speaker or performer from outside of Northwestern.',
    yes: boxFrom(0.8265, 0.8567, 0.8026, 0.8132),
    no: boxFrom(0.8993, 0.9215, 0.8035, 0.8136),
  },
  {
    key: 'f',
    label: 'This event will have alcohol served or sold.',
    yes: boxFrom(0.8271, 0.8572, 0.8286, 0.8396),
    no: boxFrom(0.8993, 0.9221, 0.8308, 0.8404),
  },
  {
    key: 'g',
    label: "My Student Organization's adviser is aware of the event.",
    yes: boxFrom(0.8271, 0.8572, 0.8558, 0.8673),
    no: boxFrom(0.8993, 0.9221, 0.8567, 0.8668),
  },
];

// Derives a checkbox circle's likely position from its Yes/No text token,
// calibrated against the four rows (c/d/e/f) where Document AI's own
// classifier agrees, so it can be applied uniformly to all seven rows
// including the three (a/b/g) it never detects at all.
function circleBoxFromToken(token: Box): Box {
  const vertices = token.normalizedVertices;
  const xMin = Math.min(...vertices.map((v) => v.x));
  const yMin = Math.min(...vertices.map((v) => v.y));
  const yMax = Math.max(...vertices.map((v) => v.y));
  return boxFrom(xMin - 0.037, xMin - 0.007, yMin - 0.0035, yMax + 0.006);
}

function section4RowRegions(): RowRegion[] {
  return SECTION_4_ROWS.map((row) => ({
    key: row.key,
    label: row.label,
    page: 1,
    yesBox: circleBoxFromToken(row.yes),
    noBox: circleBoxFromToken(row.no),
  }));
}

// Row b's conditional subsection ("If yes, provide the reservation number
// (if applicable), the space reserved, and the event contact person:").
// The label text is fixed on this static form -- so any text found in its
// region beyond that exact label means the subsection has been filled in.
const RESERVATION_SUBSECTION_REGION = { yMin: 0.678, yMax: 0.752 };
const RESERVATION_SUBSECTION_BOX = boxFrom(0.1, 0.95, 0.678, 0.752);
const RESERVATION_LABEL_TEXT =
  'if yes, provide the reservation number (if applicable), the space reserved, and the event contact person:';

function normalizeWhitespace(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

function checkReservationSubsectionFilled(
  documentText: string,
  tokens: Token[],
): boolean {
  const inRegion = tokens
    .map((t) => {
      const vertices = t.layout?.boundingPoly?.normalizedVertices;
      if (!vertices?.length) return null;
      const cy = vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;
      const cx = vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length;
      if (
        cy < RESERVATION_SUBSECTION_REGION.yMin ||
        cy > RESERVATION_SUBSECTION_REGION.yMax
      ) {
        return null;
      }
      return { cy, cx, text: extractText(documentText, t.layout?.textAnchor) };
    })
    .filter((t): t is { cy: number; cx: number; text: string } => t !== null)
    .sort((a, b) => (Math.abs(a.cy - b.cy) < 0.005 ? a.cx - b.cx : a.cy - b.cy));

  const combined = normalizeWhitespace(inRegion.map((t) => t.text).join(''));
  return combined !== RESERVATION_LABEL_TEXT;
}

function checkRsoAgreement(
  documentText: string,
  page1: DocumentAiPage,
  page2: DocumentAiPage,
) {
  const formFieldsPage1: FormField[] = page1.formFields ?? [];
  const formFieldsPage2: FormField[] = page2.formFields ?? [];
  const tokensPage2: Token[] = page2.tokens ?? [];

  const sectionFlags: SectionFlag[] = [
    ...checkSection(1, documentText, formFieldsPage1, SECTION_1_FIELDS),
    ...checkSection(
      3,
      documentText,
      formFieldsPage2,
      SECTION_3_FIELDS,
      SECTION_3_Y_RANGE,
    ),
    ...checkSection(
      5,
      documentText,
      formFieldsPage2,
      SECTION_5_FIELDS,
      SECTION_5_Y_RANGE,
    ),
  ];

  return {
    sectionFlags,
    section4Box: SECTION_BOXES[4],
    section4Rows: section4RowRegions(),
    reservationSubsection: {
      filled: checkReservationSubsectionFilled(documentText, tokensPage2),
      page: 1,
      box: RESERVATION_SUBSECTION_BOX,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const config = loadDocumentAiConfig();
    const { fileBase64 } = await req.json();
    if (!fileBase64) throw new Error('No file provided.');

    const { text, pages } = await processDocument(config, fileBase64, 'application/pdf');
    const page1 = (pages[0] ?? {}) as DocumentAiPage;
    const page2 = (pages[1] ?? {}) as DocumentAiPage;

    const result = checkRsoAgreement(text, page1, page2);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
