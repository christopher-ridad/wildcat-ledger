// The actual Conflict of Interest Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Grounded in real correctly-filled examples and a live test of the
// deployed check (provided by Christopher, September 2026) rather than a
// guess from the blank template alone:
//   - "Individual submitting the form via the NUPortal" is left entirely
//     blank -- name, signature, and date -- on a genuinely complete
//     submission; only "Individual(s) who selected or directed the
//     vendor" is filled in (alongside its own signature and date). An
//     earlier version of this check required both name fields, and would
//     have wrongly flagged a real, complete document as missing one.
//   - A live test flagged all three Yes/No questions as "couldn't locate
//     this question on the page" -- the anchor phrases used to find each
//     one ('employed by', 'received any gifts', 'given a gift') were each
//     two words, and each question wraps across several printed lines;
//     if Document AI's line-wrap happens to fall between those two words,
//     the phrase never appears intact on any single OCR'd line, and the
//     search finds nothing. Switched to single-word anchors, which can't
//     be split this way -- a line only ever wraps at a space between
//     words, never in the middle of one.
//
// Per Christopher (with a reference image marked up directly on the blank
// template, the same way Contracted Services' two sections were): flags
// are grouped by two regions of the page rather than one flag per field --
// "Vendor Information" (Proposed Vendor Name plus all three Yes/No
// questions, each needing some mark, Yes or No, it doesn't matter which)
// and "Selected/Directed By" (the "Individual(s) who selected or directed
// the vendor" name line, its signature, and its date -- signature and date
// newly checked, not just the name, per Christopher). Both boxes are fixed
// (SECTION_BOXES), the same pattern Contracted Services' two sections and
// RSO Agreement's numbered sections use -- read by eye off the reference
// image, not a measured position (no real Document AI sample calibrating
// one), so expect these to need a nudge once seen against a real render.
//
// Signature/Date are disambiguated from the form's other two identical
// Signature/Date pairs (the NUPortal submitter's, and the conditional COI
// Manager's) by vertical position (yRange, matching Selected/Directed By's
// own box), the same technique RSO Agreement's own Section 3/5 fields use
// -- there's no other distinguishing text on any of the three.
//
// Still deliberately NOT checked: the Comments column (free text, no
// static label to check against) and the conditional COI Manager sign-off
// (only required when a question is answered "Yes," which this doesn't
// distinguish).
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
  Token,
} from '../_shared/documentAi.ts';

const SELECTED_BY_Y_RANGE = { yMin: 0.49, yMax: 0.6 };

export const SECTION_BOXES: Record<'vendorInformation' | 'selectedDirectedBy', Box> = {
  vendorInformation: boxFrom(0.04, 0.97, 0.185, 0.44),
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
  valueLocation: 'sameLine',
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

// Single-word anchors -- see the header comment for why. Each is unique
// enough on the page to identify its row without matching the other two
// questions or any surrounding paragraph text.
const YES_NO_ANCHORS = ['employed', 'received', 'provided'];

// The YES/NO columns' combined horizontal span, as a fraction of page
// width -- an estimate from the page's visual layout (question column
// wide on the left, YES then NO narrow columns, Comments wide on the
// right), not measured Document AI output.
const YES_NO_COLUMNS_X = { xMin: 0.5, xMax: 0.67 };
// How far above/below the anchor line's own center to look for a mark --
// generous, since each question wraps across several lines and the
// matched anchor word may not fall exactly in the vertical middle of its
// row.
const ROW_Y_BAND = 0.035;

function isYesNoRowAnswered(
  documentText: string,
  lines: Line[],
  tokens: Token[],
  anchorText: string,
): boolean {
  const anchorLine = lines.find((l) =>
    extractText(documentText, l.layout?.textAnchor).toLowerCase().includes(anchorText),
  );
  const center = centerOf(anchorLine?.layout?.boundingPoly);
  // Couldn't even locate the question itself -- treat as unanswered rather
  // than silently passing (a non-standard copy of the form, a bad scan, is
  // worth surfacing as incomplete too).
  if (!center) return false;

  return tokens.some((t) => {
    const tokenCenter = centerOf(t.layout?.boundingPoly);
    return (
      tokenCenter &&
      tokenCenter.x >= YES_NO_COLUMNS_X.xMin &&
      tokenCenter.x <= YES_NO_COLUMNS_X.xMax &&
      tokenCenter.y >= center.y - ROW_Y_BAND &&
      tokenCenter.y <= center.y + ROW_Y_BAND
    );
  });
}

export function checkConflictOfInterest(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
  tokens: Token[],
): PresenceFlag[] {
  const flags: PresenceFlag[] = [];

  const vendorNameFilled = findLabeledFieldStatuses(documentText, formFields, lines, [
    VENDOR_NAME_SPEC,
  ])[0].filled;
  const allQuestionsAnswered = YES_NO_ANCHORS.every((anchorText) =>
    isYesNoRowAnswered(documentText, lines, tokens, anchorText),
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
