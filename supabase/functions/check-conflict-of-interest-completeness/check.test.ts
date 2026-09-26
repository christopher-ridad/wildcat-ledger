import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import { checkConflictOfInterest } from './check.ts';

const ARBITRARY_BOX = boxFrom(0, 0.1, 0, 0.1);

function fullyFilledDoc() {
  const doc = new FixtureDoc();
  const formFields = [
    doc.field('Proposed Vendor Name:', 'Acme Consulting', ARBITRARY_BOX),
    doc.field(
      'Individual submitting the form via the NUPortal:',
      'Jane Doe',
      ARBITRARY_BOX,
    ),
    doc.field(
      'Individual (s) who selected or directed the vendor to be added to NUFinancials:',
      'John Smith',
      ARBITRARY_BOX,
    ),
  ];
  return { doc, formFields };
}

Deno.test('checkConflictOfInterest - fully filled document has no flags', () => {
  const { doc, formFields } = fullyFilledDoc();
  assertEquals(checkConflictOfInterest(doc.text, formFields), []);
});

Deno.test(
  'checkConflictOfInterest - blank vendor name is flagged with its own box',
  () => {
    const { doc, formFields } = fullyFilledDoc();
    formFields[0] = doc.field('Proposed Vendor Name:', '', ARBITRARY_BOX);
    const flags = checkConflictOfInterest(doc.text, formFields);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Vendor Name');
    assertEquals(flags[0].box, ARBITRARY_BOX);
  },
);

Deno.test('checkConflictOfInterest - vendor name missing entirely has a null box', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields.shift();
  const flags = checkConflictOfInterest(doc.text, formFields);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'Vendor Name');
  assertEquals(flags[0].box, null);
});

Deno.test('checkConflictOfInterest - blank submitter name is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[1] = doc.field(
    'Individual submitting the form via the NUPortal:',
    '',
    ARBITRARY_BOX,
  );
  const flags = checkConflictOfInterest(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Submitted By'),
    true,
  );
});

Deno.test('checkConflictOfInterest - blank selector name is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[2] = doc.field(
    'Individual (s) who selected or directed the vendor to be added to NUFinancials:',
    '',
    ARBITRARY_BOX,
  );
  const flags = checkConflictOfInterest(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Selected/Directed By'),
    true,
  );
});

Deno.test('checkConflictOfInterest - field name matching is case-insensitive', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[0] = doc.field('PROPOSED VENDOR NAME:', 'Acme Consulting', ARBITRARY_BOX);
  assertEquals(checkConflictOfInterest(doc.text, formFields), []);
});
