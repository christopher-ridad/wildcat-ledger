import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import { checkConflictOfInterest, SECTION_BOXES } from './check.ts';

const ARBITRARY_BOX = boxFrom(0, 0.1, 0, 0.1);

// Row anchor lines and the handwritten marks answering them, positioned
// the way check.ts expects: each mark within ROW_Y_BAND of its row's line
// center, and within YES_NO_COLUMNS_X horizontally. Anchor text uses the
// real multi-line question wording, split across lines the way Document
// AI's OCR would -- specifically with the anchor word itself landing mid
// wrapped-line, not conveniently at a line boundary, to genuinely exercise
// the single-word-anchor fix (see check.ts's header comment on why the
// original two-word anchors failed on a real upload).
const ROW_BOXES = [
  { line: boxFrom(0.05, 0.45, 0.295, 0.305), mark: boxFrom(0.52, 0.54, 0.298, 0.302) },
  { line: boxFrom(0.05, 0.45, 0.395, 0.405), mark: boxFrom(0.55, 0.57, 0.398, 0.402) },
  { line: boxFrom(0.05, 0.45, 0.495, 0.505), mark: boxFrom(0.6, 0.62, 0.498, 0.502) },
];
const ROW_ANCHOR_LINE_TEXT = [
  'or extended family member employed by the vendor, acting as a consultant?',
  'or extended family member received any gifts from the vendor within 12 months?',
  'or extended family member provided a gift to the vendor within 12 months?',
];

// Selected/Directed By's Signature/Date sit within SELECTED_BY_Y_RANGE
// (matching SECTION_BOXES.selectedDirectedBy); this box is also used to
// place an *out-of-range* Signature/Date pair (the NUPortal submitter's,
// earlier in the document) to prove the in-range one is what actually
// gets checked, not just the first "Signature:"/"Date:" found.
const OUT_OF_RANGE_Y = 0.3;
const IN_RANGE_Y =
  (SECTION_BOXES.selectedDirectedBy.normalizedVertices[0].y +
    SECTION_BOXES.selectedDirectedBy.normalizedVertices[2].y) /
  2;

function fullyFilledDoc() {
  const doc = new FixtureDoc();
  const formFields = [
    doc.field('Proposed Vendor Name:', 'Acme Consulting', ARBITRARY_BOX),
    // The NUPortal submitter's own (unrelated, always-blank-in-practice)
    // Signature/Date pair, positioned OUTSIDE Selected/Directed By's
    // y-range -- present here, and filled, purely to prove yRange
    // disambiguation actually matters (see the dedicated test below).
    doc.field(
      'Signature:',
      'Someone Else',
      boxFrom(0, 0.1, OUT_OF_RANGE_Y, OUT_OF_RANGE_Y + 0.01),
    ),
    doc.field(
      'Date:',
      '1/1/2020',
      boxFrom(0, 0.1, OUT_OF_RANGE_Y, OUT_OF_RANGE_Y + 0.01),
    ),
    doc.field(
      'Individual (s) who selected or directed the vendor to be added to NUFinancials:',
      'John Smith',
      ARBITRARY_BOX,
    ),
    doc.field('Signature:', 'John Smith', boxFrom(0, 0.1, IN_RANGE_Y, IN_RANGE_Y + 0.01)),
    doc.field('Date:', '9/2/2026', boxFrom(0, 0.1, IN_RANGE_Y, IN_RANGE_Y + 0.01)),
  ];
  const lines = ROW_BOXES.map((r, i) => doc.line(ROW_ANCHOR_LINE_TEXT[i], r.line));
  const tokens = ROW_BOXES.map((r) => doc.token('X', r.mark));
  return { doc, formFields, lines, tokens };
}

Deno.test('checkConflictOfInterest - fully filled document has no flags', () => {
  const { doc, formFields, lines, tokens } = fullyFilledDoc();
  assertEquals(checkConflictOfInterest(doc.text, formFields, lines, tokens), []);
});

// Regression test: a real correctly-filled example left "Individual
// submitting the form via the NUPortal" entirely blank -- name, signature,
// and date -- and only filled "Individual(s) who selected or directed the
// vendor." An earlier version of this check required both and would have
// wrongly flagged that real, complete document as missing one.
Deno.test(
  '"Individual submitting the form via the NUPortal" absent entirely is not flagged',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    assertEquals(checkConflictOfInterest(doc.text, formFields, lines, tokens), []);
  },
);

Deno.test(
  'checkConflictOfInterest - blank vendor name flags Vendor Information, with its fixed box',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    formFields[0] = doc.field('Proposed Vendor Name:', '', ARBITRARY_BOX);
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Vendor Information');
    assertEquals(flags[0].box, SECTION_BOXES.vendorInformation);
  },
);

Deno.test(
  'checkConflictOfInterest - vendor name missing entirely also flags Vendor Information',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    formFields.shift();
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(
      flags.some((f) => f.label === 'Vendor Information'),
      true,
    );
  },
);

Deno.test('checkConflictOfInterest - field name matching is case-insensitive', () => {
  const { doc, formFields, lines, tokens } = fullyFilledDoc();
  formFields[0] = doc.field('PROPOSED VENDOR NAME:', 'Acme Consulting', ARBITRARY_BOX);
  assertEquals(checkConflictOfInterest(doc.text, formFields, lines, tokens), []);
});

Deno.test(
  'checkConflictOfInterest - one unanswered Yes/No question flags Vendor Information, not a separate per-question flag',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    tokens.splice(1, 1); // drop row 2's mark -- rows 1 and 3 are still answered
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Vendor Information');
  },
);

Deno.test(
  'checkConflictOfInterest - all three questions unanswered still produces just one Vendor Information flag',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    const flags = checkConflictOfInterest(doc.text, formFields, lines, []);
    assertEquals(flags.filter((f) => f.label === 'Vendor Information').length, 1);
  },
);

Deno.test(
  'checkConflictOfInterest - a mark outside the Yes/No columns does not count as an answer',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    // Row 1's mark, but positioned in the Comments column (past x 0.67) --
    // shouldn't be mistaken for an actual Yes/No answer.
    tokens[0] = doc.token('some comment', boxFrom(0.75, 0.8, 0.298, 0.302));
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(
      flags.some((f) => f.label === 'Vendor Information'),
      true,
    );
  },
);

Deno.test(
  "checkConflictOfInterest - a single-word anchor still finds its row even when Document AI's line-wrap splits the old two-word phrase",
  () => {
    // None of ROW_ANCHOR_LINE_TEXT contains the old two-word phrases
    // intact ("employed by", "received any gifts", "given a gift") on a
    // single line -- each is deliberately worded so the anchor word
    // appears mid-line, with the rest of the original phrasing on a
    // different (here, entirely absent) line, the way a real line-wrapped
    // OCR result would split it. The fully-filled baseline already proves
    // this resolves correctly; this test just makes that intent explicit.
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    assertEquals(checkConflictOfInterest(doc.text, formFields, lines, tokens), []);
  },
);

Deno.test(
  'checkConflictOfInterest - blank Selected/Directed By name flags that section',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    formFields[3] = doc.field(
      'Individual (s) who selected or directed the vendor to be added to NUFinancials:',
      '',
      ARBITRARY_BOX,
    );
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Selected/Directed By');
    assertEquals(flags[0].box, SECTION_BOXES.selectedDirectedBy);
  },
);

Deno.test(
  'checkConflictOfInterest - blank in-range Signature flags Selected/Directed By',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    formFields[4] = doc.field(
      'Signature:',
      '',
      boxFrom(0, 0.1, IN_RANGE_Y, IN_RANGE_Y + 0.01),
    );
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(
      flags.some((f) => f.label === 'Selected/Directed By'),
      true,
    );
  },
);

Deno.test(
  'checkConflictOfInterest - blank in-range Date flags Selected/Directed By',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    formFields[5] = doc.field(
      'Date:',
      '',
      boxFrom(0, 0.1, IN_RANGE_Y, IN_RANGE_Y + 0.01),
    );
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(
      flags.some((f) => f.label === 'Selected/Directed By'),
      true,
    );
  },
);

// Regression/design test: the form has three identical "Signature:" /
// "Date:" labels (the NUPortal submitter's, the selector's, and the
// conditional COI Manager's). Without yRange disambiguation, a blank
// in-range Signature could be masked by an earlier, out-of-range, FILLED
// one -- formFields.find() would stop at the first match regardless of
// which one actually belongs to Selected/Directed By.
Deno.test(
  'checkConflictOfInterest - an out-of-range but filled Signature does not mask a blank in-range one',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    // formFields[1] is the out-of-range (submitter's) Signature, already
    // filled in fullyFilledDoc(). Blank out the in-range (selector's) one.
    formFields[4] = doc.field(
      'Signature:',
      '',
      boxFrom(0, 0.1, IN_RANGE_Y, IN_RANGE_Y + 0.01),
    );
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(
      flags.some((f) => f.label === 'Selected/Directed By'),
      true,
    );
  },
);

Deno.test(
  'checkConflictOfInterest - both sections incomplete produces two separate flags',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    formFields[0] = doc.field('Proposed Vendor Name:', '', ARBITRARY_BOX);
    formFields[3] = doc.field(
      'Individual (s) who selected or directed the vendor to be added to NUFinancials:',
      '',
      ARBITRARY_BOX,
    );
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(flags.length, 2);
    assertEquals(
      flags.map((f) => f.label).sort(),
      ['Selected/Directed By', 'Vendor Information'].sort(),
    );
  },
);
