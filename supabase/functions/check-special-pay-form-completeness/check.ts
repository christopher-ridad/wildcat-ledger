// The actual Special Pay Request Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Section boxes (computeSectionBoxes) are computed from each section's own
// printed heading position rather than a fixed y-fraction -- confirmed
// necessary since a real form revision had an extra Yes/No question in
// Payment Information that a fixed guess didn't account for, throwing off
// every box below it. FALLBACK_SECTION_BOXES is only used when a heading
// can't be found at all.
//
// Funding, Nature of Service, and Employee Certification each check
// formFields first and fall back to a raw-line scan, the same order
// findLabeledFieldStatuses uses elsewhere on this page. Confirmed
// necessary on a real fillable-PDF upload: every Funding cell and both
// "Employee's Signature:" fields pair cleanly into formFields (a
// signature even OCRs as garbled but non-empty text, e.g. "The be"), and
// a checked Nature of Service box came through as a formField value
// ("Honorarium (106243)" paired with "☑") rather than its own line.
//
// Funding and Payment Information both have several labels crammed onto
// one printed row ("Fund: FN Dept: ... Percent:" / "Period of Service
// Begin Date: ... Hours of Work per Week:", confirmed off the real
// template's own text) -- isAnyRowCompleteFromFormFields/
// isAnyRowCompleteFromLines read a label's value only up to the *next*
// known label rather than to the end of the line, so an empty cell can't
// be mistaken for filled just because more labels follow it on the same
// row.
//
// Per Christopher, the five required sections, each its own independent
// flag with its own box rather than one box spanning several sections:
//   - Employee Information: University ID Number, HR Department ID,
//     Department Name, Last Name, First Name.
//   - Payment Information: Period of Service Begin/End Date, Earnings
//     Amount, Hours of Work per Week.
//   - Funding: at least one row (of the table's two) where Fund, FN Dept,
//     Project, Activity, and Percent are all filled in -- Chartfield1 and
//     Account are not required (Account is pre-printed as 60111).
//   - Nature of Service: at least one of its ~17 job-title checkboxes.
//   - Employee Certification: both "Employee's Signature:" lines filled
//     in -- identical label text with nothing else to tell them apart, so
//     this counts distinct filled locations rather than matching each one
//     individually.
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

// Shared by Funding (two repeated rows) and Payment Information (one row).
// Checks whether ANY cluster of matches for `requiredLabels` -- everything
// within `yBand` of some anchor match -- has every required label filled;
// for a label that only ever appears once (Payment Information), this
// naturally degrades to "is the one row complete."
//
// Primary path: each cell pairs as its own formField (confirmed on a real
// upload -- "Fund:" -> "731", etc, all landing within a few thousandths of
// each other in y). Clusters formFields matching a required label by
// y-proximity to each candidate anchor, and requires every label to have a
// non-empty match in that same cluster.
function isAnyRowCompleteFromFormFields(
  documentText: string,
  formFields: FormField[],
  requiredLabels: string[],
  yBand: number,
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
        requiredLabels.includes(f.name) && f.y !== undefined,
    );

  return matches.some(
    (anchor) =>
      anchor.value.length > 0 &&
      requiredLabels.every((label) =>
        matches.some(
          (m) =>
            m.name === label && m.value.length > 0 && Math.abs(m.y - anchor.y) <= yBand,
        ),
      ),
  );
}

// Fallback for a scanned/handwritten copy, or a formField that pairs a
// label with adjacent label text instead of a real value: combines every
// line within `yBand` of the anchor label's line into one text blob, then
// slices out each required label's value up to whichever label (in this
// row, or `otherLabels` -- present on the page but not required, e.g.
// Funding's Chartfield1/Account) comes next, rather than reading to the
// end of the line.
function isAnyRowCompleteFromLines(
  documentText: string,
  lines: Line[],
  anchorLabel: string,
  requiredLabels: string[],
  otherLabels: string[],
  yBand: number,
): boolean {
  const anchorLines = lines.filter((l) =>
    new RegExp(`\\b${anchorLabel}`).test(
      normalizeHomoglyphs(extractText(documentText, l.layout?.textAnchor).toLowerCase()),
    ),
  );

  return anchorLines.some((anchorLine) => {
    const y = centerOf(anchorLine.layout?.boundingPoly)?.y;
    if (y === undefined) return false;

    const rowText = lines
      .filter((l) => {
        const ly = centerOf(l.layout?.boundingPoly)?.y;
        return ly !== undefined && Math.abs(ly - y) <= yBand;
      })
      .map((l) =>
        normalizeHomoglyphs(
          extractText(documentText, l.layout?.textAnchor).toLowerCase(),
        ),
      )
      .join(' ');

    const allLabels = [...requiredLabels, ...otherLabels];
    return requiredLabels.every((label) => {
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

const FUNDING_ROW_LABELS = ['fund:', 'fn dept:', 'project:', 'activity:', 'percent:'];
const FUNDING_ROW_OTHER_LABELS = ['chartfield1:', 'account:'];
const FUNDING_ROW_Y_BAND = 0.03;

function isAnyFundingRowComplete(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
): boolean {
  return (
    isAnyRowCompleteFromFormFields(
      documentText,
      formFields,
      FUNDING_ROW_LABELS,
      FUNDING_ROW_Y_BAND,
    ) ||
    isAnyRowCompleteFromLines(
      documentText,
      lines,
      'fund:',
      FUNDING_ROW_LABELS,
      FUNDING_ROW_OTHER_LABELS,
      FUNDING_ROW_Y_BAND,
    )
  );
}

const PAYMENT_INFO_LABELS = [
  'period of service begin date:',
  'period of service end date:',
  'earnings amount:',
  'hours of work per week:',
];
const PAYMENT_INFO_ROW_Y_BAND = 0.03;

function isPaymentInfoRowComplete(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
): boolean {
  return (
    isAnyRowCompleteFromFormFields(
      documentText,
      formFields,
      PAYMENT_INFO_LABELS,
      PAYMENT_INFO_ROW_Y_BAND,
    ) ||
    isAnyRowCompleteFromLines(
      documentText,
      lines,
      'period of service begin date:',
      PAYMENT_INFO_LABELS,
      [],
      PAYMENT_INFO_ROW_Y_BAND,
    )
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
  const flags: PresenceFlag[] = [];

  const employeeInfoStatuses = findLabeledFieldStatuses(
    documentText,
    formFields,
    lines,
    EMPLOYEE_INFO_SPECS,
  );
  if (employeeInfoStatuses.some((s) => !s.filled)) {
    flags.push({
      label: 'Employee Information',
      message: 'Employee Information looks incomplete.',
      box: sectionBoxes.employeeInformation,
    });
  }

  if (!isPaymentInfoRowComplete(documentText, formFields, lines)) {
    flags.push({
      label: 'Payment Information',
      message: 'Payment Information looks incomplete.',
      box: sectionBoxes.paymentInformation,
    });
  }

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
