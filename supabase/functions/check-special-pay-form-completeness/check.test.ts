import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import { checkSpecialPayForm } from './check.ts';

const ARBITRARY_BOX = boxFrom(0, 0.1, 0, 0.1);

function fullyFilledDoc() {
  const doc = new FixtureDoc();
  const formFields = [
    doc.field('University ID Number:', '1234567', ARBITRARY_BOX),
    doc.field('Last Name:', 'Doe', ARBITRARY_BOX),
    doc.field('First Name:', 'Jane', ARBITRARY_BOX),
    doc.field('HR Department ID:', '5678', ARBITRARY_BOX),
    doc.field('Department Name:', 'Student Affairs', ARBITRARY_BOX),
    doc.field('Period of Service Begin Date:', '1/1/2026', ARBITRARY_BOX),
    doc.field('Period of Service End Date:', '1/14/2026', ARBITRARY_BOX),
    doc.field('Earnings Amount:', '$500', ARBITRARY_BOX),
    doc.field('Name of Person Completing Form: (print)', 'Jane Doe', ARBITRARY_BOX),
  ];
  return { doc, formFields };
}

Deno.test('checkSpecialPayForm - fully filled document has no flags', () => {
  const { doc, formFields } = fullyFilledDoc();
  assertEquals(checkSpecialPayForm(doc.text, formFields), []);
});

Deno.test('checkSpecialPayForm - blank University ID is flagged with its own box', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[0] = doc.field('University ID Number:', '', ARBITRARY_BOX);
  const flags = checkSpecialPayForm(doc.text, formFields);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'University ID Number');
  assertEquals(flags[0].box, ARBITRARY_BOX);
});

Deno.test('checkSpecialPayForm - University ID missing entirely has a null box', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields.shift();
  const flags = checkSpecialPayForm(doc.text, formFields);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'University ID Number');
  assertEquals(flags[0].box, null);
});

Deno.test('checkSpecialPayForm - blank Last Name is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[1] = doc.field('Last Name:', '', ARBITRARY_BOX);
  const flags = checkSpecialPayForm(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Last Name'),
    true,
  );
});

Deno.test('checkSpecialPayForm - blank First Name is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[2] = doc.field('First Name:', '', ARBITRARY_BOX);
  const flags = checkSpecialPayForm(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'First Name'),
    true,
  );
});

Deno.test('checkSpecialPayForm - blank HR Department ID is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[3] = doc.field('HR Department ID:', '', ARBITRARY_BOX);
  const flags = checkSpecialPayForm(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'HR Department ID'),
    true,
  );
});

Deno.test('checkSpecialPayForm - blank Department Name is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[4] = doc.field('Department Name:', '', ARBITRARY_BOX);
  const flags = checkSpecialPayForm(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Department Name'),
    true,
  );
});

Deno.test('checkSpecialPayForm - blank Period of Service Begin Date is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[5] = doc.field('Period of Service Begin Date:', '', ARBITRARY_BOX);
  const flags = checkSpecialPayForm(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Period of Service (Begin)'),
    true,
  );
});

Deno.test('checkSpecialPayForm - blank Period of Service End Date is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[6] = doc.field('Period of Service End Date:', '', ARBITRARY_BOX);
  const flags = checkSpecialPayForm(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Period of Service (End)'),
    true,
  );
});

Deno.test('checkSpecialPayForm - blank Earnings Amount is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[7] = doc.field('Earnings Amount:', '', ARBITRARY_BOX);
  const flags = checkSpecialPayForm(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Earnings Amount'),
    true,
  );
});

Deno.test(
  'checkSpecialPayForm - blank "Name of Person Completing Form" is flagged',
  () => {
    const { doc, formFields } = fullyFilledDoc();
    formFields[8] = doc.field(
      'Name of Person Completing Form: (print)',
      '',
      ARBITRARY_BOX,
    );
    const flags = checkSpecialPayForm(doc.text, formFields);
    assertEquals(
      flags.some((f) => f.label === 'Completed By'),
      true,
    );
  },
);

Deno.test('checkSpecialPayForm - field name matching is case-insensitive', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[0] = doc.field('UNIVERSITY ID NUMBER:', '1234567', ARBITRARY_BOX);
  assertEquals(checkSpecialPayForm(doc.text, formFields), []);
});
