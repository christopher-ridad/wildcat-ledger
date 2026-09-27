// The actual Special Pay Request Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// A real filled example (Christopher, September 2026) confirmed the boxes
// need to be computed from the page's own printed section headings rather
// than fixed y-fractions: that upload's Payment Information has an extra
// "Do you anticipate submitting another Special Pay request..." Yes/No
// question not present on the blank template this was first built
// against, which shifts every section below it down and made fixed
// fractions land on the wrong section entirely (Funding's box landing over
// Payment Information, etc). computeSectionBoxes below finds each
// section's own heading line and the next section's, and boxes the space
// between them -- self-correcting for a page that's laid out a bit
// differently than expected, with a fixed-fraction fallback
// (FALLBACK_SECTION_BOXES) only for the rare case a heading can't be found
// at all.
//
// That same real upload -- a genuinely fillable PDF, filled in via its own
// form fields rather than scanned/handwritten -- also flagged Funding and
// Employee Certification despite both being filled in. Its actual
// Document AI response (logged live) showed why: every Funding cell
// (Fund, FN Dept, Project, Activity, Percent) and both "Employee's
// Signature:" fields are cleanly paired in formFields with real values
// (a signature even OCRs as garbled text -- "The be", "There" -- rather
// than nothing, since Document AI attempts to read cursive handwriting as
// text). isAnyFundingRowComplete and countFilledEmployeeSignatures
// originally only scanned raw OCR lines, on the assumption (never
// confirmed) that a printed row wouldn't pair into formFields the way
// Contracted Services' Name and Address didn't -- wrong for this
// document. Both now check formFields first, the same
// formFields-then-line-scan-fallback order every other field on this page
// already uses via findLabeledFieldStatuses, falling back to the original
// line-scan logic only when formFields doesn't have these paired at all
// (a scanned/handwritten copy of this form, say). Nature of Service picked
// up the same treatment for the same reason, even though it wasn't
// independently confirmed broken -- a checked box came through as a
// formField value ("Honorarium (106243)" paired with "☑"), which its
// original visualElements/line-glyph-only search would have missed
// entirely if that had been the checkbox's only representation.
//
// After that fix, a real upload with both Employee Information and
// Payment Information genuinely incomplete showed their two boxes reading
// as one merged rectangle -- computeSectionBoxes had a box's bottom edge
// and the next section's top edge landing on the exact same y (both
// `nextHeadingY - HEADING_BOX_PADDING`), so two adjacent flagged sections
// touched with no visible gap. SECTION_BOX_GAP now shaves a little extra
// off a box's bottom edge so adjacent boxes stay visually distinct even
// when both fire at once.
//
// Per Christopher, the minimum fields for this form to be considered
// complete, and the five flags they should be grouped into -- one per
// printed section of the form, each with its own box, rather than one
// combined box spanning several sections (an earlier version of this
// grouped Employee Information through Nature of Service into a single
// flag; Christopher's reference image draws one continuous outline across
// those sections, but the intent is five independent flags so that, say,
// a missing Funding row only boxes Funding, not the whole region):
//   - Employee Information: University ID Number, HR Department ID,
//     Department Name, Last Name, First Name.
//   - Payment Information: Period of Service Begin/End Date, Earnings
//     Amount, Hours of Work per Week.
//   - Funding: at least one row (of the table's two) where Fund, FN Dept,
//     Project, Activity, and Percent are all filled in -- Chartfield1 and
//     Account are not required (Account is pre-printed as 60111 on the
//     template, not a user-entered field).
//   - Nature of Service: at least one of its ~17 job-title checkboxes
//     selected -- doesn't matter which.
//   - Employee Certification: two separate "Employee's Signature:" lines
//     filled in (one for the grant-account certification, one for the
//     DCFS acknowledgement immediately below it) -- there's no other
//     distinguishing label text between the two, so this counts how many
//     of the (however many are found) have same-line content rather than
//     trying to match each individually.
import {
  Box,
  boxFrom,
  centerOf,
  extractText,
  findLabeledFieldStatuses,
  FormField,
  Line,
  normalizeHomoglyphs,
  PresenceFlag,
  RobustFieldSpec,
  VisualElement,
} from '../_shared/documentAi.ts';

type SectionKey =
  | 'employeeInformation'
  | 'paymentInformation'
  | 'funding'
  | 'natureOfService'
  | 'employeeCertification';

// Only used when a section's own heading, or the next section's, can't be
// found on the page at all -- the same rough visual estimate this started
// from, kept as a last resort rather than leaving a flag with no box.
// Each entry ends a little short of the next one's start (see
// SECTION_BOX_GAP below) so two adjacent flagged sections don't touch and
// read as one merged rectangle.
export const FALLBACK_SECTION_BOXES: Record<SectionKey, Box> = {
  employeeInformation: boxFrom(0.04, 0.97, 0.08, 0.145),
  paymentInformation: boxFrom(0.04, 0.97, 0.155, 0.225),
  funding: boxFrom(0.04, 0.97, 0.235, 0.305),
  natureOfService: boxFrom(0.04, 0.97, 0.315, 0.49),
  employeeCertification: boxFrom(0.04, 0.97, 0.5, 0.615),
};

// Each entry's box spans from its own heading down to the next entry's
// heading -- "Approvals" is only ever used as Employee Certification's
// lower bound, never boxed itself (that section has no required fields).
const SECTION_HEADINGS: { key: SectionKey; heading: string }[] = [
  { key: 'employeeInformation', heading: 'employee information' },
  { key: 'paymentInformation', heading: 'payment information' },
  { key: 'funding', heading: 'funding' },
  { key: 'natureOfService', heading: 'nature of service' },
  { key: 'employeeCertification', heading: 'employee certification' },
];
const END_HEADING = 'approvals';

// How far above a heading line's own vertical center its box should start
// -- enough to include the heading text itself, not just the fields below
// it.
const HEADING_BOX_PADDING = 0.015;

// Extra vertical gap subtracted from a box's bottom edge (on top of the
// next section's own HEADING_BOX_PADDING) so two adjacent sections, both
// flagged at once, don't touch and read as one merged rectangle -- an
// earlier version had both edges land on exactly the same y, which did
// exactly that for Employee Information and Payment Information on a
// real upload.
const SECTION_BOX_GAP = 0.01;

function findHeadingY(
  documentText: string,
  lines: Line[],
  heading: string,
): number | undefined {
  return centerOf(
    lines.find((l) =>
      normalizeHomoglyphs(
        extractText(documentText, l.layout?.textAnchor).toLowerCase(),
      ).includes(heading),
    )?.layout?.boundingPoly,
  )?.y;
}

export function computeSectionBoxes(
  documentText: string,
  lines: Line[],
): Record<SectionKey, Box> {
  const headingYs = [...SECTION_HEADINGS.map((s) => s.heading), END_HEADING].map(
    (heading) => findHeadingY(documentText, lines, heading),
  );

  const boxes = {} as Record<SectionKey, Box>;
  SECTION_HEADINGS.forEach((section, i) => {
    const top = headingYs[i];
    const bottom = headingYs[i + 1];
    boxes[section.key] =
      top !== undefined && bottom !== undefined && bottom > top
        ? boxFrom(
            0.04,
            0.97,
            top - HEADING_BOX_PADDING,
            bottom - HEADING_BOX_PADDING - SECTION_BOX_GAP,
          )
        : FALLBACK_SECTION_BOXES[section.key];
  });
  return boxes;
}

const EMPLOYEE_INFO_SPECS: RobustFieldSpec[] = [
  {
    matchFieldName: (n) => n.includes('university id number'),
    lineLabel: 'university id number',
    valueLocation: 'sameLine',
    label: 'University ID Number',
    message: 'University ID Number looks blank.',
  },
  {
    matchFieldName: (n) => n.includes('hr department id'),
    lineLabel: 'hr department id',
    valueLocation: 'sameLine',
    label: 'HR Department ID',
    message: 'HR Department ID looks blank.',
  },
  {
    matchFieldName: (n) => n === 'department name:',
    lineLabel: 'department name:',
    valueLocation: 'sameLine',
    label: 'Department Name',
    message: 'Department Name looks blank.',
  },
  {
    matchFieldName: (n) => n === 'last name:',
    lineLabel: 'last name:',
    valueLocation: 'sameLine',
    label: 'Last Name',
    message: 'Last Name looks blank.',
  },
  {
    matchFieldName: (n) => n === 'first name:',
    lineLabel: 'first name:',
    valueLocation: 'sameLine',
    label: 'First Name',
    message: 'First Name looks blank.',
  },
];

const PAYMENT_INFO_SPECS: RobustFieldSpec[] = [
  {
    matchFieldName: (n) => n.includes('period of service begin date'),
    lineLabel: 'period of service begin date',
    valueLocation: 'sameLine',
    label: 'Period of Service (Begin)',
    message: 'Period of Service Begin Date looks blank.',
  },
  {
    matchFieldName: (n) => n.includes('period of service end date'),
    lineLabel: 'period of service end date',
    valueLocation: 'sameLine',
    label: 'Period of Service (End)',
    message: 'Period of Service End Date looks blank.',
  },
  {
    matchFieldName: (n) => n.includes('earnings amount'),
    lineLabel: 'earnings amount',
    valueLocation: 'sameLine',
    label: 'Earnings Amount',
    message: 'Earnings Amount looks blank.',
  },
  {
    matchFieldName: (n) => n.includes('hours of work per week'),
    lineLabel: 'hours of work per week',
    valueLocation: 'sameLine',
    label: 'Hours of Work per Week',
    message: 'Hours of Work per Week looks blank.',
  },
];

function checkSection(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
  specs: RobustFieldSpec[],
  box: Box,
  sectionLabel: string,
  sectionMessage: string,
): PresenceFlag[] {
  const statuses = findLabeledFieldStatuses(documentText, formFields, lines, specs);
  if (statuses.every((s) => s.filled)) return [];
  return [{ label: sectionLabel, message: sectionMessage, box }];
}

// The Funding table's two rows repeat the same five labels.
const FUNDING_ROW_LABELS = ['fund:', 'fn dept:', 'project:', 'activity:', 'percent:'];
const FUNDING_ROW_OTHER_LABELS = ['chartfield1:', 'account:'];
const FUNDING_ROW_Y_BAND = 0.03;

// Primary path, confirmed against a real filled example: each cell pairs
// as its own formField (name "Fund:", value "731", etc), all five in a
// row landing within a few thousandths of each other in y. Clusters every
// formField whose name matches a required label by y-proximity to each
// "anchor" match, and requires all five labels to have a non-empty match
// in that same cluster.
function isAnyFundingRowCompleteFromFormFields(
  documentText: string,
  formFields: FormField[],
): boolean {
  const matches = formFields
    .map((f) => ({
      name: normalizeHomoglyphs(
        extractText(documentText, f.fieldName?.textAnchor).trim().toLowerCase(),
      ),
      value: extractText(documentText, f.fieldValue?.textAnchor).trim(),
      y: centerOf(f.fieldName?.boundingPoly)?.y,
    }))
    .filter(
      (f): f is { name: string; value: string; y: number } =>
        FUNDING_ROW_LABELS.includes(f.name) && f.y !== undefined,
    );

  return matches.some(
    (anchor) =>
      anchor.value.length > 0 &&
      FUNDING_ROW_LABELS.every((label) =>
        matches.some(
          (m) =>
            m.name === label &&
            m.value.length > 0 &&
            Math.abs(m.y - anchor.y) <= FUNDING_ROW_Y_BAND,
        ),
      ),
  );
}

// Fallback for a scanned/handwritten copy of this form, where a row might
// not pair into formFields at all -- rather than assume whether Document
// AI prints a whole row as one OCR'd line or as several separate ones (no
// real sample of that case to check against), this combines every line
// within a generous band of each "Fund:" line's own vertical position
// into one text blob, then looks for each required label inside that blob
// and takes the text between it and whichever label (in this row or the
// ones this form doesn't require -- Chartfield1 and Account) comes next
// as that label's value. Works whether the row is one combined printed
// line or several close ones.
function isAnyFundingRowCompleteFromLines(documentText: string, lines: Line[]): boolean {
  const fundLines = lines.filter((l) =>
    /\bfund:/.test(
      normalizeHomoglyphs(extractText(documentText, l.layout?.textAnchor).toLowerCase()),
    ),
  );

  return fundLines.some((fundLine) => {
    const y = centerOf(fundLine.layout?.boundingPoly)?.y;
    if (y === undefined) return false;

    const rowText = lines
      .filter((l) => {
        const ly = centerOf(l.layout?.boundingPoly)?.y;
        return ly !== undefined && Math.abs(ly - y) <= FUNDING_ROW_Y_BAND;
      })
      .map((l) =>
        normalizeHomoglyphs(
          extractText(documentText, l.layout?.textAnchor).toLowerCase(),
        ),
      )
      .join(' ');

    const allLabels = [...FUNDING_ROW_LABELS, ...FUNDING_ROW_OTHER_LABELS];
    return FUNDING_ROW_LABELS.every((label) => {
      const start = rowText.indexOf(label);
      if (start === -1) return false;
      const afterStart = start + label.length;
      const nextPositions = allLabels
        .filter((other) => other !== label)
        .map((other) => rowText.indexOf(other, afterStart))
        .filter((p) => p !== -1);
      const end = nextPositions.length ? Math.min(...nextPositions) : rowText.length;
      return rowText.slice(afterStart, end).trim().length > 0;
    });
  });
}

function isAnyFundingRowComplete(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
): boolean {
  return (
    isAnyFundingRowCompleteFromFormFields(documentText, formFields) ||
    isAnyFundingRowCompleteFromLines(documentText, lines)
  );
}

// Confirmed elsewhere (Conflict of Interest) that a handwritten checkmark
// OCRs as one of these glyphs on its own line -- see that check's header
// comment. Not yet confirmed for this form's printed checkboxes
// specifically, which -- being real PDF form checkbox fields rather than a
// blank table cell -- may instead show up as a Document AI
// visualElement (the W-9's tax-classification checkboxes do), so both are
// checked here.
const CHECK_GLYPHS = ['☑', '✓', '☒', '✗'];

// Anchors the ~17-checkbox Nature of Service region by the two headings
// immediately before and after it, rather than a fixed y-fraction guess --
// doesn't matter which specific job title is checked, only whether
// anything within the region between these two headings is.
function isAnyNatureOfServiceChecked(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
  visualElements: VisualElement[],
): boolean {
  const startY = findHeadingY(documentText, lines, 'nature of service');
  const endY = findHeadingY(documentText, lines, 'employee certification');
  // Couldn't even locate the section -- treat as unanswered rather than
  // silently passing.
  if (startY === undefined || endY === undefined) return false;

  const inRegion = (y: number | undefined) => y !== undefined && y > startY && y < endY;

  // Confirmed on a real upload: a checked box pairs as its own formField,
  // with the check glyph as the *value* ("Honorarium (106243)" paired
  // with "☑") rather than appearing as its own separate line.
  if (
    formFields.some((f) => {
      if (!inRegion(centerOf(f.fieldName?.boundingPoly)?.y)) return false;
      const value = extractText(documentText, f.fieldValue?.textAnchor);
      return CHECK_GLYPHS.some((glyph) => value.includes(glyph));
    })
  ) {
    return true;
  }

  if (
    visualElements.some(
      (v) =>
        v.type === 'filled_checkbox' && inRegion(centerOf(v.layout?.boundingPoly)?.y),
    )
  ) {
    return true;
  }

  return lines.some((l) => {
    if (!inRegion(centerOf(l.layout?.boundingPoly)?.y)) return false;
    const text = extractText(documentText, l.layout?.textAnchor);
    return CHECK_GLYPHS.some((glyph) => text.includes(glyph));
  });
}

// Both Employee Certification signature lines share identical label text
// ("Employee's Signature:") with nothing else on the page to tell them
// apart -- counts how many distinct locations have a filled signature
// rather than matching each individually, the same way Conflict of
// Interest's identical Signature/Date labels needed position (not text)
// to disambiguate, except here there's no known real y-position to
// disambiguate by yet either. Checks both formFields (confirmed on a real
// upload: both signatures pair as their own formField, with the
// handwritten signature OCR'd -- imperfectly, but non-empty -- as its
// value) and raw lines (for a scanned/handwritten copy where that pairing
// might not happen), then dedupes by y-proximity so the same physical
// signature isn't counted twice just because both sources found it.
const SIGNATURE_DEDUPE_Y_BAND = 0.02;

function countFilledEmployeeSignatures(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
): number {
  const filledYs: number[] = [];

  for (const f of formFields) {
    const name = normalizeHomoglyphs(
      extractText(documentText, f.fieldName?.textAnchor).toLowerCase(),
    );
    if (!name.includes('employee') || !name.includes('signature')) continue;
    const value = extractText(documentText, f.fieldValue?.textAnchor).trim();
    const y = centerOf(f.fieldName?.boundingPoly)?.y;
    if (value.length > 0 && y !== undefined) filledYs.push(y);
  }

  for (const line of lines) {
    const raw = extractText(documentText, line.layout?.textAnchor);
    const normalized = normalizeHomoglyphs(raw.toLowerCase());
    if (!normalized.includes('employee') || !normalized.includes('signature')) continue;
    const labelIdx = normalized.indexOf('signature');
    const sameLineAfter = raw
      .slice(labelIdx + 'signature'.length)
      .replace(/^:/, '')
      .trim();
    const y = centerOf(line.layout?.boundingPoly)?.y;
    if (sameLineAfter.length > 0 && y !== undefined) filledYs.push(y);
  }

  const distinctYs: number[] = [];
  for (const y of filledYs.sort((a, b) => a - b)) {
    if (
      !distinctYs.some((existing) => Math.abs(existing - y) <= SIGNATURE_DEDUPE_Y_BAND)
    ) {
      distinctYs.push(y);
    }
  }
  return distinctYs.length;
}

export function checkSpecialPayForm(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
  visualElements: VisualElement[],
): PresenceFlag[] {
  const sectionBoxes = computeSectionBoxes(documentText, lines);

  const flags: PresenceFlag[] = [
    ...checkSection(
      documentText,
      formFields,
      lines,
      EMPLOYEE_INFO_SPECS,
      sectionBoxes.employeeInformation,
      'Employee Information',
      'Employee Information looks incomplete.',
    ),
    ...checkSection(
      documentText,
      formFields,
      lines,
      PAYMENT_INFO_SPECS,
      sectionBoxes.paymentInformation,
      'Payment Information',
      'Payment Information looks incomplete.',
    ),
  ];

  if (!isAnyFundingRowComplete(documentText, formFields, lines)) {
    flags.push({
      label: 'Funding',
      message:
        'Funding looks incomplete -- at least one row needs Fund, FN Dept, Project, Activity, and Percent all filled in.',
      box: sectionBoxes.funding,
    });
  }

  if (!isAnyNatureOfServiceChecked(documentText, formFields, lines, visualElements)) {
    flags.push({
      label: 'Nature of Service',
      message:
        'Nature of Service looks incomplete -- select at least one job title checkbox.',
      box: sectionBoxes.natureOfService,
    });
  }

  if (countFilledEmployeeSignatures(documentText, formFields, lines) < 2) {
    flags.push({
      label: 'Employee Certification',
      message:
        "Employee Certification looks incomplete -- both Employee's Signature lines need to be filled in.",
      box: sectionBoxes.employeeCertification,
    });
  }

  return flags;
}
