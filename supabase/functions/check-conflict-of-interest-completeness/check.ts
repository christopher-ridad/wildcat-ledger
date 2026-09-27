// The actual Conflict of Interest Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Grounded in real correctly-filled examples and multiple live tests of
// the deployed check (provided by Christopher, September 2026) rather
// than a guess from the blank template alone:
//   - "Individual submitting the form via the NUPortal" is left entirely
//     blank -- name, signature, and date -- on a genuinely complete
//     submission; only "Individual(s) who selected or directed the
//     vendor" is filled in (alongside its own signature and date). An
//     earlier version of this check required both name fields, and would
//     have wrongly flagged a real, complete document as missing one.
//   - The Yes/No questions' anchor phrases originally being two words each
//     ('employed by', 'received any gifts', 'given a gift') failed
//     outright on a real upload -- each question wraps across several
//     printed lines, and if Document AI's line-wrap happens to fall
//     between the two words, the phrase never appears intact on any
//     single OCR'd line. Switched to single-word anchors, which can't be
//     split this way.
//   - A real Document AI response (logged live) showed a printed label
//     and its handwritten value often OCR as two separate lines, not one
//     combined "Label: value" line -- "Proposed Vendor Name:" is its own
//     line, with "Matt Rivers" a distinct line immediately after it (the
//     handwriting sits slightly above the blank, not overlapping it, so
//     its own line's vertical center can even read as *above* the
//     label's). Vendor Name now checks the next line, the same way
//     Contracted Services' Additional Description of Services does.
//   - That same real response confirmed a handwritten checkmark reads as
//     an actual Unicode glyph ("☑", BALLOT BOX WITH CHECK) on its own
//     line -- not nothing, and not something that needs pixel-level
//     token/column-position guessing the way this was originally built.
//     Each Yes/No row is now checked by searching for that glyph within
//     the row's own vertical span, with no horizontal (column) constraint
//     at all -- the column-position guess never had any real Document AI
//     data behind it and was very likely part of why this kept failing.
//     Real data confirmed this for two of the three rows on that upload.
//     The third row's checkmark is a CONFIRMED complete OCR miss, not a
//     bug here -- it doesn't appear anywhere in that same real response's
//     lines, tokens, or visualElements. There is no signal in Document
//     AI's output for this check to key off of for that specific mark;
//     it's a genuine limitation, not something fixable by adjusting this
//     logic further.
//   - Both SECTION_BOXES entries, and Signature/Date's yRange, were
//     initially read by eye off a reference image (no real Document AI
//     sample) and were wrong: Selected/Directed By's real content sits at
//     y ~0.68-0.75, not the ~0.49-0.6 first guessed, which meant
//     Signature/Date's yRange filter was excluding the real occurrences
//     entirely and finding nothing -- flagging that section as incomplete
//     even when genuinely filled in. Vendor Information's box similarly
//     didn't reach far enough down to cover the Yes/No table's third row
//     (real data: row 3 runs to y ~0.55, the box stopped at 0.44). Both
//     now use the real Y-positions a live Document AI response confirmed,
//     not a visual estimate.
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
// RSO Agreement's numbered sections use.
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
} from '../_shared/documentAi.ts';

// Real y-positions confirmed live: the label at 0.676, its name value at
// 0.697, its Signature line at 0.745, its Date line at 0.752.
const SELECTED_BY_Y_RANGE = { yMin: 0.66, yMax: 0.76 };

export const SECTION_BOXES: Record<'vendorInformation' | 'selectedDirectedBy', Box> = {
  // Real y-positions confirmed live: "Proposed Vendor Name:" at 0.300,
  // the Yes/No table's header at 0.347, and its third row running through
  // 0.55.
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
  // If blank, the next real printed content on the page is the Yes/No
  // table's own header ("To the best of your knowledge:"), confirmed on
  // the same real response that showed the label/value split -- without
  // this, a genuinely blank name would still read as filled.
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

// Single-word anchors -- see the header comment for why. Each is unique
// enough on the page to identify its row without matching the other two
// questions or any surrounding paragraph text.
const YES_NO_ANCHORS = ['employed', 'received', 'provided'];

// Confirmed via a real Document AI response: a handwritten checkmark OCRs
// as one of these on its own line. "☑" (BALLOT BOX WITH CHECK) is the
// one actually seen; the plain checkmark/X variants are included in case a
// differently-drawn mark OCRs differently.
const CHECK_GLYPHS = ['☑', '✓', '☒', '✗'];

// How far above/below the anchor word's own line to look for a checkmark
// glyph -- generous, since each question wraps across several lines and
// the matched anchor word may not fall exactly in the vertical middle of
// its row. Confirmed sufficient for 2 of 3 rows against a real response
// (real offsets seen: +0.010 and +0.003); no confirmed horizontal
// (column) constraint exists, so none is applied -- see the header
// comment for why that was very likely part of the original bug.
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
  // Couldn't even locate the question itself -- treat as unanswered rather
  // than silently passing (a non-standard copy of the form, a bad scan, is
  // worth surfacing as incomplete too).
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
