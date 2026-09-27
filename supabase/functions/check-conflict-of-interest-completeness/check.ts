// The actual Conflict of Interest Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Grounded in real correctly-filled examples and live tests (Christopher,
// September 2026), not a guess from the blank template:
//   - The NUPortal submitter's name/signature/date are left blank on a
//     genuinely complete submission -- only "Individual(s) who selected or
//     directed the vendor" is required.
//   - Yes/No anchors must be single words ('employed', 'received',
//     'provided'), not phrases -- a real upload's line-wrap split a
//     two-word phrase across lines, so it never matched intact.
//   - A label and its handwritten value often OCR as separate lines, not
//     "Label: value" combined -- Vendor Name checks the next line, same as
//     Contracted Services' Description of Services.
//   - A handwritten checkmark OCRs as a Unicode glyph ("☑") on its own
//     line. Yes/No rows search for it within the row's vertical span with
//     no horizontal constraint -- an earlier column-position guess had no
//     real data behind it and was the likely cause of prior failures. One
//     row's mark is a confirmed OCR miss (absent from lines, tokens, and
//     visualElements alike) -- a processor limitation, not a bug to keep
//     chasing.
//   - SECTION_BOXES and Signature/Date's yRange were originally read by
//     eye and wrong: Selected/Directed By's real content sits at
//     y ~0.68-0.75 (not ~0.49-0.6), and Vendor Information's box didn't
//     reach the Yes/No table's third row (runs to y ~0.55). Both now use
//     real Document AI Y-positions.
//
// Per Christopher: flags are grouped by two page regions, not one per
// field -- "Vendor Information" (vendor name + all three Yes/No
// questions) and "Selected/Directed By" (name, signature, and date of
// whoever selected/directed the vendor). Both boxes are fixed
// (SECTION_BOXES), matching Contracted Services' and RSO Agreement's
// section-level pattern.
//
// Signature/Date are disambiguated from the form's two other identical
// Signature/Date pairs by vertical position (yRange) -- no other
// distinguishing text exists on any of the three.
//
// Deliberately not checked: the Comments column (free text) and the
// conditional COI Manager sign-off (only required on a "Yes" answer,
// which this doesn't distinguish).
import {
  Box,
  boxFrom,
  centerOf,
  extractText,
  findLabeledFieldStatuses,
  FormField,
  Line,
  PresenceFlag,
  RobustFieldSpec,
} from '../_shared/documentAi.ts';

// Confirmed live: label at y=0.676, Signature at 0.745, Date at 0.752.
const SELECTED_BY_Y_RANGE = { yMin: 0.66, yMax: 0.76 };

export const SECTION_BOXES: Record<'vendorInformation' | 'selectedDirectedBy', Box> = {
  // Confirmed live: "Proposed Vendor Name:" at y=0.300, table header at
  // 0.347, row 3 runs to 0.55.
  vendorInformation: boxFrom(0.04, 0.97, 0.19, 0.56),
  selectedDirectedBy: boxFrom(
    0.04,
    0.97,
    SELECTED_BY_Y_RANGE.yMin,
    SELECTED_BY_Y_RANGE.yMax,
  ),
};

const VENDOR_NAME_SPEC: RobustFieldSpec = {
  matchFieldName: (n) => n.includes('proposed vendor name'),
  lineLabel: 'proposed vendor name',
  valueLocation: 'nextLine',
  // Blank field's next line is the Yes/No table's own header ("To the
  // best of your knowledge:") -- without this, a blank name would still
  // read as filled.
  nextLineBoilerplate: ['to the best of your knowledge'],
  label: 'Vendor Name',
  message: 'Proposed Vendor Name looks blank.',
};

const SELECTED_BY_SPECS: RobustFieldSpec[] = [
  {
    matchFieldName: (n) => n.includes('selected or directed the vendor'),
    lineLabel: 'selected or directed the vendor',
    valueLocation: 'sameLine',
    label: 'Selected/Directed By',
    message:
      'The name of the individual(s) who selected or directed the vendor looks blank.',
  },
  {
    matchFieldName: (n) => n === 'signature:',
    lineLabel: 'signature:',
    valueLocation: 'sameLine',
    yRange: SELECTED_BY_Y_RANGE,
    label: 'Signature',
    message: 'Signature looks blank.',
  },
  {
    matchFieldName: (n) => n === 'date:',
    lineLabel: 'date:',
    valueLocation: 'sameLine',
    yRange: SELECTED_BY_Y_RANGE,
    label: 'Date',
    message: 'Date looks blank.',
  },
];

// Single-word (see header comment) and unique enough to identify their
// row without matching the other two questions.
const YES_NO_ANCHORS = ['employed', 'received', 'provided'];

// A handwritten checkmark OCRs as one of these ("☑" confirmed live); the
// other variants are included defensively.
const CHECK_GLYPHS = ['☑', '✓', '☒', '✗'];

// Generous band -- a question wraps across lines, so the anchor word may
// not sit at its row's vertical center (real offsets seen: +0.010,
// +0.003). No horizontal constraint (see header comment).
const ROW_Y_BAND = 0.045;

function isYesNoRowAnswered(
  documentText: string,
  lines: Line[],
  anchorText: string,
): boolean {
  const anchorLine = lines.find((l) =>
    extractText(documentText, l.layout?.textAnchor).toLowerCase().includes(anchorText),
  );
  const center = centerOf(anchorLine?.layout?.boundingPoly);
  // Question not found at all -- treat as unanswered rather than silently
  // passing.
  if (!center) return false;

  return lines.some((l) => {
    const text = extractText(documentText, l.layout?.textAnchor);
    if (!CHECK_GLYPHS.some((glyph) => text.includes(glyph))) return false;
    const y = centerOf(l.layout?.boundingPoly)?.y;
    return y !== undefined && y >= center.y - ROW_Y_BAND && y <= center.y + ROW_Y_BAND;
  });
}

export function checkConflictOfInterest(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
): PresenceFlag[] {
  const flags: PresenceFlag[] = [];

  const vendorNameFilled = findLabeledFieldStatuses(documentText, formFields, lines, [
    VENDOR_NAME_SPEC,
  ])[0].filled;
  const allQuestionsAnswered = YES_NO_ANCHORS.every((anchorText) =>
    isYesNoRowAnswered(documentText, lines, anchorText),
  );
  if (!vendorNameFilled || !allQuestionsAnswered) {
    flags.push({
      label: 'Vendor Information',
      message: 'Vendor Information looks incomplete.',
      box: SECTION_BOXES.vendorInformation,
    });
  }

  const selectedByStatuses = findLabeledFieldStatuses(
    documentText,
    formFields,
    lines,
    SELECTED_BY_SPECS,
  );
  if (selectedByStatuses.some((s) => !s.filled)) {
    flags.push({
      label: 'Selected/Directed By',
      message: 'Selected/Directed By information looks incomplete.',
      box: SECTION_BOXES.selectedDirectedBy,
    });
  }

  return flags;
}
