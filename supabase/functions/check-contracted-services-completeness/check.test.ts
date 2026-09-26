import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import { checkContractedServices } from './check.ts';

const ARBITRARY_BOX = boxFrom(0, 0.1, 0, 0.1);

// A fully, validly filled Contracted Services Form -- the baseline every
// other test perturbs one field of. Shape matches a real correctly-filled
// example (Requestor/Department deliberately absent -- see check.ts's
// header comment for why).
function fullyFilledDoc() {
  const doc = new FixtureDoc();
  const formFields = [
    doc.field('Name:', 'Acme Consulting', ARBITRARY_BOX),
    doc.field('Address Line 1:', '123 Main St', ARBITRARY_BOX),
    doc.field('City, State  Zip:', 'Evanston, IL 60201', ARBITRARY_BOX),
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

// Regression test: a real correctly-filled example left Requestor and
// Department entirely blank (evidently filled in by SOFO staff, not the
// org) -- an earlier version of this check required them and would have
// wrongly flagged that real, complete document.
Deno.test(
  'checkContractedServices - Requestor and Department absent entirely is not flagged',
  () => {
    const { doc, formFields } = fullyFilledDoc();
    assertEquals(checkContractedServices(doc.text, formFields), []);
  },
);

Deno.test(
  'checkContractedServices - blank contractor Name is flagged with its own box',
  () => {
    const { doc, formFields } = fullyFilledDoc();
    formFields[0] = doc.field('Name:', '', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Contractor Name');
    assertEquals(flags[0].box, ARBITRARY_BOX);
  },
);

Deno.test(
  'checkContractedServices - contractor Name missing entirely has a null box',
  () => {
    const { doc, formFields } = fullyFilledDoc();
    formFields.shift();
    const flags = checkContractedServices(doc.text, formFields);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Contractor Name');
    assertEquals(flags[0].box, null);
  },
);

Deno.test('checkContractedServices - blank Address is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[1] = doc.field('Address Line 1:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Address'),
    true,
  );
});

Deno.test('checkContractedServices - blank City/State/Zip is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[2] = doc.field('City, State  Zip:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'City/State/Zip'),
    true,
  );
});

Deno.test('checkContractedServices - blank Period of Service From is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[3] = doc.field('From:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Period of Service (From)'),
    true,
  );
});

Deno.test('checkContractedServices - blank Period of Service To is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[4] = doc.field('To:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Period of Service (To)'),
    true,
  );
});

Deno.test('checkContractedServices - blank Rate of Pay is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[5] = doc.field('or Flat Fee:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Rate of Pay'),
    true,
  );
});

Deno.test('checkContractedServices - blank Contractor Signature is flagged', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[6] = doc.field('Contractor Signature:', '', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields);
  assertEquals(
    flags.some((f) => f.label === 'Contractor Signature'),
    true,
  );
});

Deno.test('checkContractedServices - field name matching is case-insensitive', () => {
  const { doc, formFields } = fullyFilledDoc();
  formFields[0] = doc.field('NAME:', 'Acme Consulting', ARBITRARY_BOX);
  assertEquals(checkContractedServices(doc.text, formFields), []);
});
