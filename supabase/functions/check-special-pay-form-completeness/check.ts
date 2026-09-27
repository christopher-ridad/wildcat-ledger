// The actual Special Pay Request Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Unlike Contracted Services and Conflict of Interest, this has NOT yet
// been run against a real Document AI response for a filled example --
// there is no live test behind any of the choices below yet. Field-name
// matchers, the funding-row/Nature of Service/signature-count logic, and
// SECTION_BOXES are all a first-pass best effort read off the blank
// template PDF plus a reference image Christopher marked up showing which
// two regions should be flagged (Employee Information through Nature of
// Service as one box, Employee Certification as a second), the same
// starting point Contracted Services and Conflict of Interest each began
// from before a real upload corrected several wrong assumptions (see
// those two check.ts files' own header comments for what changed and
// why). Expect the same here once this gets its first live test --
// particularly SECTION_BOXES' fractions, and the funding-row/signature
// logic below, none of which had any real Document AI position data to
// check against.
//
// Per Christopher, the minimum fields for this form to be considered
// complete:
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
//
// Grouped into the same two flags the reference image marks: "Employee &
// Payment Information" (everything through Nature of Service) and
// "Employee Certification," the same section-grouping pattern Contracted
// Services and Conflict of Interest use.
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

export const SECTION_BOXES: Record<
  'employeeAndPaymentInformation' | 'employeeCertification',
  Box
> = {
  employeeAndPaymentInformation: boxFrom(0.04, 0.97, 0.08, 0.5),
  employeeCertification: boxFrom(0.04, 0.97, 0.5, 0.62),
};

const EMPLOYEE_PAYMENT_SPECS: RobustFieldSpec[] = [
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

// The Funding table's two rows repeat the same five labels. Rather than
// assume whether Document AI prints a whole row as one OCR'd line or as
// several separate ones (no real sample to check either way), this
// combines every line within a generous band of each "Fund:" line's own
// vertical position into one text blob, then looks for each required
// label inside that blob and takes the text between it and whichever
// label (in this row or the ones this form doesn't require -- Chartfield1
// and Account) comes next as that label's value. Works whether the row is
// one combined printed line or several close ones.
const FUNDING_ROW_LABELS = ['fund:', 'fn dept:', 'project:', 'activity:', 'percent:'];
const FUNDING_ROW_OTHER_LABELS = ['chartfield1:', 'account:'];
const FUNDING_ROW_Y_BAND = 0.03;

function isAnyFundingRowComplete(documentText: string, lines: Line[]): boolean {
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
  lines: Line[],
  visualElements: VisualElement[],
): boolean {
  const startY = centerOf(
    lines.find((l) =>
      normalizeHomoglyphs(
        extractText(documentText, l.layout?.textAnchor).toLowerCase(),
      ).includes('nature of service'),
    )?.layout?.boundingPoly,
  )?.y;
  const endY = centerOf(
    lines.find((l) =>
      normalizeHomoglyphs(
        extractText(documentText, l.layout?.textAnchor).toLowerCase(),
      ).includes('employee certification'),
    )?.layout?.boundingPoly,
  )?.y;
  // Couldn't even locate the section -- treat as unanswered rather than
  // silently passing.
  if (startY === undefined || endY === undefined) return false;

  const inRegion = (y: number | undefined) => y !== undefined && y > startY && y < endY;

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
// apart -- counts how many have same-line content rather than matching
// each individually, the same way Conflict of Interest's identical
// Signature/Date labels needed position (not text) to disambiguate, except
// here there's no known real y-position to disambiguate by yet either.
function countFilledEmployeeSignatures(documentText: string, lines: Line[]): number {
  let count = 0;
  for (const line of lines) {
    const raw = extractText(documentText, line.layout?.textAnchor);
    const normalized = normalizeHomoglyphs(raw.toLowerCase());
    if (!normalized.includes('employee') || !normalized.includes('signature')) continue;
    const labelIdx = normalized.indexOf('signature');
    const sameLineAfter = raw
      .slice(labelIdx + 'signature'.length)
      .replace(/^:/, '')
      .trim();
    if (sameLineAfter.length > 0) count++;
  }
  return count;
}

export function checkSpecialPayForm(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
  visualElements: VisualElement[],
): PresenceFlag[] {
  const flags: PresenceFlag[] = [];

  const employeePaymentStatuses = findLabeledFieldStatuses(
    documentText,
    formFields,
    lines,
    EMPLOYEE_PAYMENT_SPECS,
  );
  const fundingComplete = isAnyFundingRowComplete(documentText, lines);
  const natureOfServiceChecked = isAnyNatureOfServiceChecked(
    documentText,
    lines,
    visualElements,
  );
  if (
    employeePaymentStatuses.some((s) => !s.filled) ||
    !fundingComplete ||
    !natureOfServiceChecked
  ) {
    flags.push({
      label: 'Employee & Payment Information',
      message: 'Employee & Payment Information looks incomplete.',
      box: SECTION_BOXES.employeeAndPaymentInformation,
    });
  }

  if (countFilledEmployeeSignatures(documentText, lines) < 2) {
    flags.push({
      label: 'Employee Certification',
      message: 'Employee Certification looks incomplete.',
      box: SECTION_BOXES.employeeCertification,
    });
  }

  return flags;
}
