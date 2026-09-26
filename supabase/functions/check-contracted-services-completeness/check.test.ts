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
// header comment. Includes the "Contractor's Acknowledgement" section
// heading between the description box and the signature line, matching
// the real form's own layout -- needed to properly exercise the
// nextLineBoilerplate guard below.
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
    doc.line(
      'Additional Description of Services (for sponsored project, also describe the benefit to the award):',
      ARBITRARY_BOX,
    ),
    doc.line('Some real description text', ARBITRARY_BOX),
    doc.line("Contractor's Acknowledgement", ARBITRARY_BOX),
    doc.line('Contractor Signature: A. Consultant', ARBITRARY_BOX),
    doc.line('Date: 9/2/2026', ARBITRARY_BOX),
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

Deno.test(
  'checkContractedServices - one blank Contractor Information field flags the whole section, not the individual field',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[0] = doc.line('Name: ', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Contractor Information');
    assertEquals(flags[0].message, 'Contractor Information looks incomplete.');
  },
);

Deno.test(
  'checkContractedServices - the Contractor Information box covers every field in that section, filled or not',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[0] = doc.line('Name: ', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields, lines);
    // Every field in the fixture shares the same ARBITRARY_BOX, so the
    // union should equal it exactly.
    assertEquals(flags[0].box, ARBITRARY_BOX);
  },
);

Deno.test(
  'checkContractedServices - Contractor Information entirely missing (no lines at all) has a null box',
  () => {
    const doc = new FixtureDoc();
    const flags = checkContractedServices(doc.text, [], []);
    const infoFlag = flags.find((f) => f.label === 'Contractor Information');
    assertEquals(infoFlag?.box, null);
  },
);

Deno.test(
  'checkContractedServices - the Contractor Information box widens to include the section heading and Address Line 2, when present',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[0] = doc.line('Name: ', ARBITRARY_BOX);
    const headerBox = boxFrom(0.05, 0.3, 0.2, 0.22);
    const addressLine2Box = boxFrom(0.05, 0.3, 0.3, 0.32);
    lines.push(doc.line('Contractor Information', headerBox));
    lines.push(doc.line('Address Line 2: ', addressLine2Box));
    const flags = checkContractedServices(doc.text, formFields, lines);
    // The union now spans from ARBITRARY_BOX (every field shares it here)
    // through both anchors' boxes, so the result should stretch wider and
    // taller than ARBITRARY_BOX alone.
    assertEquals(flags[0].box, {
      normalizedVertices: [
        { x: 0, y: 0 },
        { x: 0.3, y: 0 },
        { x: 0.3, y: 0.32 },
        { x: 0, y: 0.32 },
      ],
    });
  },
);

Deno.test(
  'checkContractedServices - blank Address (within Contractor Information) is flagged',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[1] = doc.line('Address Line 1: ', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Contractor Information'),
      true,
    );
  },
);

Deno.test(
  'checkContractedServices - blank City/State/Zip (within Contractor Information) is flagged',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[2] = doc.line('City, State  Zip: ', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Contractor Information'),
      true,
    );
  },
);

Deno.test(
  'checkContractedServices - blank Period of Service From (within Contractor Information) is flagged',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[3] = doc.line('From: ', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Contractor Information'),
      true,
    );
  },
);

Deno.test(
  'checkContractedServices - blank Period of Service To (OCR\'d as Greek "Το:") is flagged',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[4] = doc.line('Το: ', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Contractor Information'),
      true,
    );
  },
);

Deno.test(
  'checkContractedServices - filled Period of Service To is recognized despite the Greek OCR',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    assertEquals(checkContractedServices(doc.text, formFields, lines), []);
  },
);

Deno.test(
  'checkContractedServices - blank Rate of Pay (within Contractor Information) is flagged',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[5] = doc.line('or Flat Fee: ', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Contractor Information'),
      true,
    );
  },
);

// Regression test: the label line itself has trailing static text ("...
// also describe the benefit to the award):"), and the next real printed
// content on the page -- when the description box is genuinely blank --
// is the "Contractor's Acknowledgement" section heading, not user-entered
// text. Both would look like a filled-in value without the
// nextLineBoilerplate guard.
Deno.test(
  'checkContractedServices - blank Description (label immediately followed by the Acknowledgement heading) flags Contractor Information',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines.splice(7, 1); // drop the description's own content line
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === 'Contractor Information'),
      true,
    );
  },
);

Deno.test('checkContractedServices - a filled Description is not flagged', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  assertEquals(checkContractedServices(doc.text, formFields, lines), []);
});

Deno.test(
  'checkContractedServices - blank Contractor Signature flags the Acknowledgement section, not Contractor Information',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[9] = doc.line('Contractor Signature: ', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, "Contractor's Acknowledgement");
    assertEquals(flags[0].message, "Contractor's Acknowledgement looks incomplete.");
  },
);

Deno.test(
  'checkContractedServices - blank signature Date flags the Acknowledgement section',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[10] = doc.line('Date: ', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(
      flags.some((f) => f.label === "Contractor's Acknowledgement"),
      true,
    );
  },
);

Deno.test(
  'checkContractedServices - the Acknowledgement box widens to include the section heading, when present',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[9] = doc.line('Contractor Signature: ', ARBITRARY_BOX);
    const headerBox = boxFrom(0.05, 0.3, 0.2, 0.22);
    lines.push(doc.line("Contractor's Acknowledgement", headerBox));
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(flags[0].box, {
      normalizedVertices: [
        { x: 0, y: 0 },
        { x: 0.3, y: 0 },
        { x: 0.3, y: 0.22 },
        { x: 0, y: 0.22 },
      ],
    });
  },
);

Deno.test(
  'checkContractedServices - both sections incomplete produces two separate flags',
  () => {
    const { doc, formFields, lines } = fullyFilledDoc();
    lines[0] = doc.line('Name: ', ARBITRARY_BOX);
    lines[9] = doc.line('Contractor Signature: ', ARBITRARY_BOX);
    const flags = checkContractedServices(doc.text, formFields, lines);
    assertEquals(flags.length, 2);
    assertEquals(
      flags.map((f) => f.label).sort(),
      ["Contractor's Acknowledgement", 'Contractor Information'].sort(),
    );
  },
);

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
      doc.field('Date: ', '9/2/2026', ARBITRARY_BOX),
    ];
    const flags = checkContractedServices(doc.text, formFields, []);
    assertEquals(
      flags.some((f) => f.label === "Contractor's Acknowledgement"),
      false,
    );
  },
);

Deno.test('checkContractedServices - line matching is case-insensitive', () => {
  const { doc, formFields, lines } = fullyFilledDoc();
  lines[0] = doc.line('NAME: Acme Consulting', ARBITRARY_BOX);
  assertEquals(checkContractedServices(doc.text, formFields, lines), []);
});
