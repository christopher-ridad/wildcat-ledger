import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import { checkConflictOfInterest } from './check.ts';

const ARBITRARY_BOX = boxFrom(0, 0.1, 0, 0.1);

// Row 1/2/3's anchor line (the question's own printed text) and the
// handwritten mark answering it, positioned the way check.ts expects:
// each mark within ROW_Y_BAND of its row's line center, and within
// YES_NO_COLUMNS_X horizontally.
const ROW_BOXES = [
  { line: boxFrom(0.05, 0.45, 0.295, 0.305), mark: boxFrom(0.52, 0.54, 0.298, 0.302) },
  { line: boxFrom(0.05, 0.45, 0.395, 0.405), mark: boxFrom(0.55, 0.57, 0.398, 0.402) },
  { line: boxFrom(0.05, 0.45, 0.495, 0.505), mark: boxFrom(0.6, 0.62, 0.498, 0.502) },
];
const ROW_ANCHOR_TEXT = [
  'Are you or an immediate family member employed by the vendor?',
  'Have you received any gifts from the vendor?',
  'Have you given a gift to the vendor?',
];

// A fully, validly filled Conflict of Interest Form -- the baseline every
// other test perturbs one field of. Shape matches a real correctly-filled
// example ("Individual submitting the form via the NUPortal" deliberately
// absent -- see check.ts's header comment for why).
function fullyFilledDoc() {
  const doc = new FixtureDoc();
  const formFields = [
    doc.field('Proposed Vendor Name:', 'Acme Consulting', ARBITRARY_BOX),
    doc.field(
      'Individual (s) who selected or directed the vendor to be added to NUFinancials:',
      'John Smith',
      ARBITRARY_BOX,
    ),
  ];
  const lines = ROW_BOXES.map((r, i) => doc.line(ROW_ANCHOR_TEXT[i], r.line));
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
  'checkConflictOfInterest - blank vendor name is flagged with its own box',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    formFields[0] = doc.field('Proposed Vendor Name:', '', ARBITRARY_BOX);
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Vendor Name');
    assertEquals(flags[0].box, ARBITRARY_BOX);
  },
);

Deno.test('checkConflictOfInterest - vendor name missing entirely has a null box', () => {
  const { doc, formFields, lines, tokens } = fullyFilledDoc();
  formFields.shift();
  const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'Vendor Name');
  assertEquals(flags[0].box, null);
});

Deno.test('checkConflictOfInterest - blank selector name is flagged', () => {
  const { doc, formFields, lines, tokens } = fullyFilledDoc();
  formFields[1] = doc.field(
    'Individual (s) who selected or directed the vendor to be added to NUFinancials:',
    '',
    ARBITRARY_BOX,
  );
  const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
  assertEquals(
    flags.some((f) => f.label === 'Selected/Directed By'),
    true,
  );
});

Deno.test(
  'checkConflictOfInterest - selector name missing entirely has a null box',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    formFields.pop();
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Selected/Directed By');
    assertEquals(flags[0].box, null);
  },
);

Deno.test('checkConflictOfInterest - field name matching is case-insensitive', () => {
  const { doc, formFields, lines, tokens } = fullyFilledDoc();
  formFields[0] = doc.field('PROPOSED VENDOR NAME:', 'Acme Consulting', ARBITRARY_BOX);
  assertEquals(checkConflictOfInterest(doc.text, formFields, lines, tokens), []);
});

Deno.test(
  'checkConflictOfInterest - an unanswered question (no mark near it) is flagged',
  () => {
    const { doc, formFields, lines, tokens } = fullyFilledDoc();
    tokens.splice(1, 1); // drop row 2's mark -- rows 1 and 3 are still answered
    const flags = checkConflictOfInterest(doc.text, formFields, lines, tokens);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Question 2 (Received Gifts)');
    assertEquals(
      flags[0].message,
      'This question looks unanswered -- neither Yes nor No is marked.',
    );
  },
);

Deno.test(
  'checkConflictOfInterest - all three questions unanswered are each flagged',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    const flags = checkConflictOfInterest(doc.text, formFields, lines, []);
    assertEquals(flags.length, 3);
    assertEquals(
      flags.map((f) => f.label),
      [
        'Question 1 (Employed by / Financial Interest)',
        'Question 2 (Received Gifts)',
        'Question 3 (Given Gifts)',
      ],
    );
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
      flags.some((f) => f.label === 'Question 1 (Employed by / Financial Interest)'),
      true,
    );
  },
);

Deno.test(
  "checkConflictOfInterest - a question that can't be located on the page is flagged, not silently skipped",
  () => {
    const { doc, formFields, tokens } = fullyFilledDoc();
    // No lines at all -- simulates a non-standard copy of the form where
    // the question text itself can't be found.
    const flags = checkConflictOfInterest(doc.text, formFields, [], tokens);
    assertEquals(flags.length, 3);
    assertEquals(
      flags.every(
        (f) => f.message === "Couldn't locate this question on the page to check it.",
      ),
      true,
    );
    assertEquals(
      flags.every((f) => f.box === null),
      true,
    );
  },
);
