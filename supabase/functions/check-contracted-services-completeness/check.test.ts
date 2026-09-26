import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import { checkContractedServices } from './check.ts';

const ARBITRARY_BOX = boxFrom(0, 0.1, 0, 0.1);

// A fully, validly filled Contracted Services Form -- the baseline every
// other test perturbs one line of. Modeled on lines, not formFields: a
// real upload confirmed Document AI doesn't reliably pair every one of
// these into formFields on this form (Name and Address Line 1 never
// appeared in formFields at all despite being filled in) -- see check.ts's
// header comment.
function fullyFilledDoc() {
  const doc = new FixtureDoc();
  const lines = [
    doc.line('Name: Acme Consulting', ARBITRARY_BOX),
    doc.line('Address Line 1: 123 Main St', ARBITRARY_BOX),
    doc.line('City, State  Zip: Evanston, IL 60201', ARBITRARY_BOX),
    doc.line('From: 1/1/2026', ARBITRARY_BOX),
    // Matches a real upload, where Document AI OCR'd "To:" as "Το:"
    // (Greek Tau + omicron) instead of Latin "To:".
    doc.line('Το: 1/31/2026', ARBITRARY_BOX),
    doc.line('or Flat Fee: $500', ARBITRARY_BOX),
    doc.line('Contractor Signature: A. Consultant', ARBITRARY_BOX),
    doc.line(
      'Additional Description of Services (for sponsored project, also describe the benefit to the award):',
      ARBITRARY_BOX,
    ),
    doc.line('Some real description text', ARBITRARY_BOX),
  ];
  return { doc, formFields: [], lines };
}

Deno.test('checkContractedServices - fully filled document has no flags', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  assertEquals(checkContractedServices(doc.text, formFields, lines), []);
});

// Regression test: a real correctly-filled example left Requestor and
// Department entirely blank (evidently filled in by SOFO staff, not the
// org) -- an earlier version of this check required them and would have
// wrongly flagged that real, complete document.
Deno.test(
  'checkContractedServices - Requestor and Department absent entirely is not flagged',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    assertEquals(checkContractedServices(doc.text, formFields, lines), []);
  },
);

Deno.test('checkContractedServices - blank Contractor Name is flagged', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  lines[0] = doc.line('Name: ', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields, lines);
  assertEquals(
    flags.some((f) => f.label === 'Contractor Name'),
    true,
  );
});

Deno.test(
  'checkContractedServices - Contractor Name missing entirely is flagged with a null box',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines.shift();
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Contractor Name'),
      true,
    );
    assertEquals(flags.find((f) => f.label === 'Contractor Name')?.box, null);
  },
);

Deno.test('checkContractedServices - blank Address is flagged', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  lines[1] = doc.line('Address Line 1: ', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields, lines);
  assertEquals(
    flags.some((f) => f.label === 'Address'),
    true,
  );
});

Deno.test('checkContractedServices - blank City/State/Zip is flagged', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  lines[2] = doc.line('City, State  Zip: ', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields, lines);
  assertEquals(
    flags.some((f) => f.label === 'City/State/Zip'),
    true,
  );
});

Deno.test('checkContractedServices - blank Period of Service From is flagged', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  lines[3] = doc.line('From: ', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields, lines);
  assertEquals(
    flags.some((f) => f.label === 'Period of Service (From)'),
    true,
  );
});

Deno.test(
  'checkContractedServices - blank Period of Service To (OCR\'d as Greek "Το:") is flagged',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[4] = doc.line('Το: ', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Period of Service (To)'),
      true,
    );
  },
);

Deno.test(
  'checkContractedServices - filled Period of Service To is recognized despite the Greek OCR',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    assertEquals(
      checkContractedServices(doc.text, formFields, lines).some(
        (f) => f.label === 'Period of Service (To)',
      ),
      false,
    );
  },
);

Deno.test('checkContractedServices - blank Rate of Pay is flagged', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  lines[5] = doc.line('or Flat Fee: ', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields, lines);
  assertEquals(
    flags.some((f) => f.label === 'Rate of Pay'),
    true,
  );
});

Deno.test('checkContractedServices - blank Contractor Signature is flagged', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  lines[6] = doc.line('Contractor Signature: ', ARBITRARY_BOX);
  const flags = checkContractedServices(doc.text, formFields, lines);
  assertEquals(
    flags.some((f) => f.label === 'Contractor Signature'),
    true,
  );
});

// Regression test: the label line itself has trailing static text ("...
// also describe the benefit to the award):"), which would look like a
// filled-in value if the same line were checked instead of the next one.
Deno.test(
  'checkContractedServices - blank Description (label line only, no next line of actual content) is flagged',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines.pop(); // drop the description's own content line
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Description of Services'),
      true,
    );
  },
);

Deno.test('checkContractedServices - a filled Description is not flagged', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  assertEquals(
    checkContractedServices(doc.text, formFields, lines).some(
      (f) => f.label === 'Description of Services',
    ),
    false,
  );
});

Deno.test(
  "checkContractedServices - Document AI's own formFields pairing is enough on its own, with no matching line needed",
  () => {
    const doc = new FixtureDoc();
    // Matches what a real upload actually returned for this field --
    // formFields pairing works for Contractor Signature, unlike Name and
    // Address Line 1. No lines at all here, to prove this path doesn't
    // depend on the line fallback.
    const formFields = [
      doc.field('Contractor Signature: ', 'A. Consultant', ARBITRARY_BOX),
    ];
    const flags = checkContractedServices(doc.text, formFields, []);
    assertEquals(
      flags.some((f) => f.label === 'Contractor Signature'),
      false,
    );
  },
);

Deno.test('checkContractedServices - line matching is case-insensitive', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  lines[0] = doc.line('NAME: Acme Consulting', ARBITRARY_BOX);
  assertEquals(checkContractedServices(doc.text, formFields, lines), []);
});
