import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import { checkConflictOfInterest, SECTION_BOXES } from './check.ts';

const ARBITRARY_BOX = boxFrom(0, 0.1, 0, 0.1);

// Each row's anchor line (a fragment of the real multi-line question text,
// worded so the anchor word itself lands mid-line rather than
// conveniently at a line boundary) and the checkmark glyph "answering" it,
// positioned within ROW_Y_BAND of the anchor line's own center -- matches
// a real Document AI response, where a handwritten checkmark OCRs as
// "☑" on its own line, with no reliable horizontal position to
// anchor to (see check.ts's header comment).
const ROW_ANCHOR_LINE_TEXT = [
  'or extended family member employed by the vendor, acting as a consultant?',
  'or extended family member received any gifts from the vendor within 12 months?',
  'or extended family member given a gift or provided more than incidental hospitality',
];
const ROW_Y = [0.3, 0.4, 0.5];

// Selected/Directed By's Signature/Date sit within SELECTED_BY_Y_RANGE
// (matching SECTION_BOXES.selectedDirectedBy); this range is also used to
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
  const lines = [
    // Vendor Name: label and value as two separate lines, matching a real
    // Document AI response -- not "Label: Value" combined on one line.
    doc.line('Proposed Vendor Name:', boxFrom(0.05, 0.5, 0.19, 0.2)),
    doc.line('Matt Rivers', boxFrom(0.2, 0.4, 0.185, 0.195)),
    doc.line('To the best of your knowledge:', boxFrom(0.05, 0.3, 0.21, 0.22)),
    ...ROW_ANCHOR_LINE_TEXT.map((text, i) =>
      doc.line(text, boxFrom(0.05, 0.45, ROW_Y[i] - 0.005, ROW_Y[i] + 0.005)),
    ),
    ...ROW_Y.map((y) => doc.line('☑', boxFrom(0.55, 0.58, y, y + 0.01))),
  ];
  return { doc, formFields, lines };
}

Deno.test('checkConflictOfInterest - fully filled document has no flags', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  assertEquals(checkConflictOfInterest(doc.text, formFields, lines), []);
});

// Regression test: a real correctly-filled example left "Individual
// submitting the form via the NUPortal" entirely blank -- name, signature,
// and date -- and only filled "Individual(s) who selected or directed the
// vendor." An earlier version of this check required both and would have
// wrongly flagged that real, complete document as missing one.
Deno.test(
  '"Individual submitting the form via the NUPortal" absent entirely is not flagged',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    assertEquals(checkConflictOfInterest(doc.text, formFields, lines), []);
  },
);

// Regression test: a real Document AI response showed "Proposed Vendor
// Name:" and its handwritten value as two separate lines, not one
// combined "Label: Value" line. An earlier version of this check only
// looked at the same line as the label and would have wrongly flagged a
// real, filled name as blank.
Deno.test(
  'checkConflictOfInterest - vendor name on its own separate next line is recognized as filled',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    assertEquals(checkConflictOfInterest(doc.text, formFields, lines), []);
  },
);

Deno.test(
  'checkConflictOfInterest - blank vendor name (label immediately followed by the table header) flags Vendor Information',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines.splice(1, 1); // drop "Matt Rivers" -- next real line is the table header
    const flags = checkConflictOfInterest(doc.text, formFields, lines);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Vendor Information');
    assertEquals(flags[0].box, SECTION_BOXES.vendorInformation);
  },
);

Deno.test(
  'checkConflictOfInterest - vendor name label missing entirely also flags Vendor Information',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines.splice(0, 2); // drop both the label and value lines
    const flags = checkConflictOfInterest(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Vendor Information'),
      true,
    );
  },
);

Deno.test('checkConflictOfInterest - line matching is case-insensitive', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  lines[0] = doc.line('PROPOSED VENDOR NAME:', boxFrom(0.05, 0.5, 0.19, 0.2));
  assertEquals(checkConflictOfInterest(doc.text, formFields, lines), []);
});

Deno.test(
  'checkConflictOfInterest - one missing checkmark flags Vendor Information, not a separate per-question flag',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines.splice(7, 1); // drop row 2's checkmark line
    const flags = checkConflictOfInterest(doc.text, formFields, lines);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Vendor Information');
  },
);

Deno.test(
  'checkConflictOfInterest - all three checkmarks missing still produces just one Vendor Information flag',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines.splice(6, 3); // drop all three checkmark lines
    const flags = checkConflictOfInterest(doc.text, formFields, lines);
    assertEquals(flags.filter((f) => f.label === 'Vendor Information').length, 1);
  },
);

Deno.test(
  "checkConflictOfInterest - a checkmark far outside the row's Y band does not count as that row's answer",
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    // Replace row 1's checkmark with one positioned nowhere near any row.
    lines[6] = doc.line('☑', boxFrom(0.55, 0.58, 0.9, 0.91));
    const flags = checkConflictOfInterest(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Vendor Information'),
      true,
    );
  },
);

Deno.test('checkConflictOfInterest - a plain checkmark glyph is also recognized', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  lines[6] = doc.line('✓', boxFrom(0.55, 0.58, ROW_Y[0], ROW_Y[0] + 0.01));
  assertEquals(checkConflictOfInterest(doc.text, formFields, lines), []);
});

Deno.test(
  'checkConflictOfInterest - blank Selected/Directed By name flags that section',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    formFields[2] = doc.field(
      'Individual (s) who selected or directed the vendor to be added to NUFinancials:',
      '',
      ARBITRARY_BOX,
    );
    const flags = checkConflictOfInterest(doc.text, formFields, lines);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Selected/Directed By');
    assertEquals(flags[0].box, SECTION_BOXES.selectedDirectedBy);
  },
);

Deno.test(
  'checkConflictOfInterest - blank in-range Signature flags Selected/Directed By',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    formFields[3] = doc.field(
      'Signature:',
      '',
      boxFrom(0, 0.1, IN_RANGE_Y, IN_RANGE_Y + 0.01),
    );
    const flags = checkConflictOfInterest(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Selected/Directed By'),
      true,
    );
  },
);

Deno.test(
  'checkConflictOfInterest - blank in-range Date flags Selected/Directed By',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    formFields[4] = doc.field(
      'Date:',
      '',
      boxFrom(0, 0.1, IN_RANGE_Y, IN_RANGE_Y + 0.01),
    );
    const flags = checkConflictOfInterest(doc.text, formFields, lines);
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
    const { doc, formFields, lines } = fullyFilledDoc();
    // formFields[0] is the out-of-range (submitter's) Signature, already
    // filled in fullyFilledDoc(). Blank out the in-range (selector's) one.
    formFields[3] = doc.field(
      'Signature:',
      '',
      boxFrom(0, 0.1, IN_RANGE_Y, IN_RANGE_Y + 0.01),
    );
    const flags = checkConflictOfInterest(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Selected/Directed By'),
      true,
    );
  },
);

Deno.test(
  'checkConflictOfInterest - both sections incomplete produces two separate flags',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines.splice(1, 1); // blank the vendor name
    formFields[2] = doc.field(
      'Individual (s) who selected or directed the vendor to be added to NUFinancials:',
      '',
      ARBITRARY_BOX,
    );
    const flags = checkConflictOfInterest(doc.text, formFields, lines);
    assertEquals(flags.length, 2);
    assertEquals(
      flags.map((f) => f.label).sort(),
      ['Selected/Directed By', 'Vendor Information'].sort(),
    );
  },
);
