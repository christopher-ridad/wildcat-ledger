import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom, DocumentAiPage } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import {
  checkRsoAgreement,
  circleBoxFromToken,
  RESERVATION_LABEL_TEXT,
  SECTION_4_ROWS,
} from './check.ts';

const SECTION_3_BOX = boxFrom(0.1, 0.2, 0.49, 0.5); // y-center 0.495, inside [0.47, 0.53]
const SECTION_5_BOX = boxFrom(0.1, 0.2, 0.94, 0.95); // y-center 0.945, inside [0.92, 0.96]
const OUT_OF_RANGE_BOX = boxFrom(0.1, 0.2, 0.6, 0.61); // inside neither range
const RESERVATION_BOX = boxFrom(0.1, 0.9, 0.68, 0.75); // inside [0.678, 0.752]

// A fully filled agreement -- the baseline every other test perturbs one
// piece of. Row b is left "No" (the reservation subsection is only ever
// required when Section 4 itself, checked client-side, says otherwise).
function fullyFilledPages() {
  const doc = new FixtureDoc();

  const page1: DocumentAiPage = {
    formFields: [
      doc.field('This agreement is entered into on this date:', '9/1/2026'),
      doc.field('a. Date/Time of Engagement:', '9/18/2026'),
      doc.field('b. Compensation to Supplier ($0 if no cost)', '$100'),
      doc.field('c. Northwestern check payable to:', 'Vendor'),
      doc.field('d. Federal ID number or Social Security number:', 'XX-XXXXXXX'),
      doc.field('e. Student Group Name:', 'BLAST'),
      doc.field('f. Student Group Contact Name:', 'Jane Doe'),
      doc.field('g. Student Group Contact Email:', 'jane@example.com'),
      doc.field('h. Description of the Event:', 'Spring showcase lighting'),
    ],
  };

  const page2: DocumentAiPage = {
    formFields: [
      doc.field('Supplier Name:', 'Vendor', SECTION_3_BOX),
      doc.field('Title:', 'Vendor Title', SECTION_3_BOX),
      doc.field('Address:', 'Vendor Address', SECTION_3_BOX),
      doc.field('Signature:', 'Vendor', SECTION_3_BOX),
      doc.field('Date:', '9/1/2026', SECTION_3_BOX),
      doc.field('Email Address:', 'vendor@example.com', SECTION_3_BOX),
      doc.field('Name:', 'Staff', SECTION_5_BOX),
      doc.field('Title:', 'Staff Title', SECTION_5_BOX),
      doc.field('Signature:', 'Staff Signature', SECTION_5_BOX),
      doc.field('Date:', '9/2/2026', SECTION_5_BOX),
    ],
    tokens: [doc.token(RESERVATION_LABEL_TEXT, RESERVATION_BOX)],
  };

  return { doc, page1, page2 };
}

Deno.test('checkRsoAgreement - fully filled agreement has no section flags', () => {
  const { doc, page1, page2 } = fullyFilledPages();
  const result = checkRsoAgreement(doc.text, page1, page2);
  assertEquals(result.sectionFlags, []);
});

Deno.test(
  'checkRsoAgreement - fully filled agreement leaves the reservation subsection unfilled',
  () => {
    const { doc, page1, page2 } = fullyFilledPages();
    const result = checkRsoAgreement(doc.text, page1, page2);
    assertEquals(result.reservationSubsection.filled, false);
  },
);

Deno.test('checkRsoAgreement - always returns all seven Section 4 rows', () => {
  const { doc, page1, page2 } = fullyFilledPages();
  const result = checkRsoAgreement(doc.text, page1, page2);
  assertEquals(
    result.section4Rows.map((r) => r.key),
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  );
  assertEquals(
    result.section4Rows.every((r) => r.page === 1),
    true,
  );
});

Deno.test('checkRsoAgreement - a missing Section 1 field flags Section 1 only', () => {
  const { doc, page1, page2 } = fullyFilledPages();
  page1.formFields!.pop(); // drop "h. Description of the Event:"
  const result = checkRsoAgreement(doc.text, page1, page2);
  assertEquals(
    result.sectionFlags.map((f) => f.section),
    [1],
  );
});

Deno.test(
  'checkRsoAgreement - a blank Section 1 field (present but empty) also flags Section 1',
  () => {
    const { doc, page1, page2 } = fullyFilledPages();
    page1.formFields![0] = doc.field('This agreement is entered into on this date:', '');
    const result = checkRsoAgreement(doc.text, page1, page2);
    assertEquals(
      result.sectionFlags.map((f) => f.section),
      [1],
    );
  },
);

Deno.test(
  'checkRsoAgreement - a missing Section 3 field flags Section 3, not Section 5',
  () => {
    const { doc, page1, page2 } = fullyFilledPages();
    page2.formFields = page2.formFields!.slice(1); // drop "Supplier Name:"
    const result = checkRsoAgreement(doc.text, page1, page2);
    assertEquals(
      result.sectionFlags.map((f) => f.section),
      [3],
    );
  },
);

Deno.test(
  'checkRsoAgreement - a missing Section 5 field flags Section 5, not Section 3',
  () => {
    const { doc, page1, page2 } = fullyFilledPages();
    page2.formFields = page2.formFields!.slice(0, -1); // drop the last Section 5 "Date:"
    const result = checkRsoAgreement(doc.text, page1, page2);
    assertEquals(
      result.sectionFlags.map((f) => f.section),
      [5],
    );
  },
);

Deno.test(
  'checkRsoAgreement - Section 3 and Section 5 share identical labels, disambiguated by position',
  () => {
    const { doc, page1, page2 } = fullyFilledPages();
    // Blank out only Section 5's "Signature:" (index 8 in the fixture --
    // Section 3 occupies 0-5, Section 5 occupies 6-9) -- Section 3's
    // identically labeled field is untouched, so only Section 5 should flag.
    page2.formFields![8] = doc.field('Signature:', '', SECTION_5_BOX);
    const result = checkRsoAgreement(doc.text, page1, page2);
    assertEquals(
      result.sectionFlags.map((f) => f.section),
      [5],
    );
  },
);

Deno.test(
  'checkRsoAgreement - a field with the right name but the wrong position satisfies neither section',
  () => {
    const { doc, page1, page2 } = fullyFilledPages();
    // Move Section 3's "Date:" out of both known ranges, and drop Section
    // 5's separate "Date:" entirely -- the only "date:"-named field left
    // sits in neither range, so neither section's date requirement is met.
    page2.formFields![4] = doc.field('Date:', '9/1/2026', OUT_OF_RANGE_BOX);
    page2.formFields = page2.formFields!.slice(0, -1);
    const result = checkRsoAgreement(doc.text, page1, page2);
    assertEquals(result.sectionFlags.map((f) => f.section).sort(), [3, 5]);
  },
);

Deno.test(
  'checkRsoAgreement - reservation subsection with only the printed label is not filled',
  () => {
    const { doc, page1, page2 } = fullyFilledPages();
    const result = checkRsoAgreement(doc.text, page1, page2);
    assertEquals(result.reservationSubsection.filled, false);
  },
);

Deno.test(
  'checkRsoAgreement - reservation subsection with text beyond the label is filled',
  () => {
    const { doc, page1, page2 } = fullyFilledPages();
    page2.tokens = [
      ...page2.tokens!,
      doc.token(' Room 201, contact Alex Smith', RESERVATION_BOX),
    ];
    const result = checkRsoAgreement(doc.text, page1, page2);
    assertEquals(result.reservationSubsection.filled, true);
  },
);

Deno.test(
  'checkRsoAgreement - reservation subsection with nothing in the region reads as filled (no static label to compare against)',
  () => {
    // A pathological case that never happens in production (the printed
    // label text is always there) -- documented here so the behavior is at
    // least intentional, not a silent surprise: empty input simply isn't
    // equal to the known label text either.
    const { doc, page1, page2 } = fullyFilledPages();
    page2.tokens = [];
    const result = checkRsoAgreement(doc.text, page1, page2);
    assertEquals(result.reservationSubsection.filled, true);
  },
);

Deno.test(
  'circleBoxFromToken - derives a circle to the left of the Yes/No text token',
  () => {
    const row = SECTION_4_ROWS.find((r) => r.key === 'c')!;
    const circle = circleBoxFromToken(row.no);
    const tokenXMin = Math.min(...row.no.normalizedVertices.map((v) => v.x));
    const circleXs = circle.normalizedVertices.map((v) => v.x);
    // The circle sits entirely to the left of the token it's derived from.
    assertEquals(Math.max(...circleXs) < tokenXMin, true);
  },
);
