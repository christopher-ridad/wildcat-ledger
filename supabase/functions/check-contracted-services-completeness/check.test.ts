import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import { checkContractedServices } from './check.ts';

const ARBITRARY_BOX = boxFrom(0, 0.1, 0, 0.1);

// A fully, validly filled Contracted Services Form -- the baseline every
// other test perturbs one field of.
function fullyFilledDoc() {
  const doc = new FixtureDoc();
  const formFields = [
    doc.field('Requestor:', 'Jane Doe', ARBITRARY_BOX),
    doc.field('Department:', 'Student Affairs', ARBITRARY_BOX),
    doc.field('Name:', 'Acme Consulting', ARBITRARY_BOX),
    doc.field('Address Line 1:', '123 Main St', ARBITRARY_BOX),
    doc.field('From:', '1/1/2026', ARBITRARY_BOX),
    doc.field('To:', '1/31/2026', ARBITRARY_BOX),
    doc.field('or Flat Fee:', '$500', ARBITRARY_BOX),
    doc.field('Contractor Signature:', 'A. Consultant', ARBITRARY_BOX),
  ];
  return { doc, formFields };
}

Deno.test('checkContractedServices - fully filled document has no flags', () => {
  const { doc, formFields } = fullyFilledDoc();
  assertEquals(checkContractedServices(doc.text, formFields), []);
});

Deno.test('checkContractedServices - blank Requestor is flagged with its own box', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[0] = doc.field('Requestor:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'Requestor');
  assertEquals(flags[0].box, ARBITRARY_BOX);
});

Deno.test('checkContractedServices - Requestor missing entirely has a null box', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields.shift();
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'Requestor');
  assertEquals(flags[0].box, null);
});

Deno.test('checkContractedServices - blank Department is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[1] = doc.field('Department:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Department'),
    true,
  );
});

Deno.test('checkContractedServices - blank contractor Name is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[2] = doc.field('Name:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Contractor Name'),
    true,
  );
});

Deno.test('checkContractedServices - blank Address is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[3] = doc.field('Address Line 1:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Address'),
    true,
  );
});

Deno.test('checkContractedServices - blank Period of Service From is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[4] = doc.field('From:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Period of Service (From)'),
    true,
  );
});

Deno.test('checkContractedServices - blank Period of Service To is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[5] = doc.field('To:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Period of Service (To)'),
    true,
  );
});

Deno.test('checkContractedServices - blank Rate of Pay is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[6] = doc.field('or Flat Fee:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Rate of Pay'),
    true,
  );
});

Deno.test('checkContractedServices - blank Contractor Signature is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[7] = doc.field('Contractor Signature:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Contractor Signature'),
    true,
  );
});

Deno.test('checkContractedServices - field name matching is case-insensitive', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[0] = doc.field('REQUESTOR:', 'Jane Doe', ARBITRARY_BOX);
  assertEquals(checkContractedServices(doc.text, formFields), []);
});
