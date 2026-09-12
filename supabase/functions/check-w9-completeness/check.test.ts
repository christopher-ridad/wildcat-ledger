import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import {
  checkW9,
  EIN_ROW,
  FALLBACK_BOXES,
  parseUsDate,
  SSN_ROW,
  TAX_CLASSIFICATION_CHECKBOXES,
} from './check.ts';

const ARBITRARY_BOX = boxFrom(0, 0.1, 0, 0.1);

// A fully, validly filled W-9 -- the baseline every other test perturbs
// one piece of. Uses today's own date so it never goes stale.
function fullyFilledDoc() {
  const doc = new FixtureDoc();
  const todayUtc = new Date();
  const raw = `${todayUtc.getUTCMonth() + 1}/${todayUtc.getUTCDate()}/${todayUtc.getUTCFullYear()}`;

  const formFields = [
    doc.field('1. Name of entity/individual', 'Acme Robotics Club', ARBITRARY_BOX),
    doc.field(
      '5. Address (number, street, and apt. or suite no.)',
      '123 Main St',
      ARBITRARY_BOX,
    ),
    doc.field('6. City, state, and ZIP code', 'Evanston, IL 60201', ARBITRARY_BOX),
    doc.field('Signature', 'Jane Doe', ARBITRARY_BOX),
    doc.field('Date', raw, ARBITRARY_BOX),
  ];
  const tokens = [
    doc.token('123-45-6789', { normalizedVertices: [{ x: 0.7, y: 0.48 }] }),
  ];
  const visualElements = [
    doc.visualElement('filled_checkbox', {
      normalizedVertices: [TAX_CLASSIFICATION_CHECKBOXES[0]],
    }),
  ];

  return { doc, formFields, tokens, visualElements };
}

Deno.test('checkW9 - fully filled document has no flags', () => {
  const { doc, formFields, tokens, visualElements } = fullyFilledDoc();
  assertEquals(checkW9(doc.text, formFields, tokens, visualElements), []);
});

Deno.test("checkW9 - name paired but blank uses the field's own box", () => {
  const { doc, formFields, tokens, visualElements } = fullyFilledDoc();
  formFields[0] = doc.field('1. Name of entity/individual', '', ARBITRARY_BOX);
  const flags = checkW9(doc.text, formFields, tokens, visualElements);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'Name (line 1)');
  assertEquals(flags[0].box, ARBITRARY_BOX);
});

Deno.test('checkW9 - name missing entirely falls back to the known form position', () => {
  const { doc, formFields, tokens, visualElements } = fullyFilledDoc();
  formFields.shift(); // drop the name field -- simulates a genuinely blank line 1
  const flags = checkW9(doc.text, formFields, tokens, visualElements);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'Name (line 1)');
  assertEquals(flags[0].box, FALLBACK_BOXES.name);
});

Deno.test('checkW9 - address missing is flagged', () => {
  const { doc, formFields, tokens, visualElements } = fullyFilledDoc();
  formFields.splice(1, 1);
  const flags = checkW9(doc.text, formFields, tokens, visualElements);
  assertEquals(
    flags.some((f) => f.label === 'Address (line 5)'),
    true,
  );
});

Deno.test('checkW9 - city/state/zip missing is flagged', () => {
  const { doc, formFields, tokens, visualElements } = fullyFilledDoc();
  formFields.splice(2, 1);
  const flags = checkW9(doc.text, formFields, tokens, visualElements);
  assertEquals(
    flags.some((f) => f.label === 'City/State/ZIP (line 6)'),
    true,
  );
});

Deno.test('checkW9 - signature missing is flagged', () => {
  const { doc, formFields, tokens, visualElements } = fullyFilledDoc();
  formFields.splice(3, 1);
  const flags = checkW9(doc.text, formFields, tokens, visualElements);
  assertEquals(
    flags.some((f) => f.label === 'Signature'),
    true,
  );
});

Deno.test('checkW9 - date missing falls back to the known form position', () => {
  const { doc, formFields, tokens, visualElements } = fullyFilledDoc();
  formFields.pop();
  const flags = checkW9(doc.text, formFields, tokens, visualElements);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'Date');
  assertEquals(flags[0].message, 'Signature date looks blank.');
  assertEquals(flags[0].box, FALLBACK_BOXES.date);
});

Deno.test('checkW9 - unparseable date is flagged with its raw text', () => {
  const { doc, formFields, tokens, visualElements } = fullyFilledDoc();
  formFields[4] = doc.field('Date', 'sometime next week', ARBITRARY_BOX);
  const flags = checkW9(doc.text, formFields, tokens, visualElements);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].message.includes('sometime next week'), true);
});

Deno.test('checkW9 - date from a different year is flagged', () => {
  const { doc, formFields, tokens, visualElements } = fullyFilledDoc();
  const lastYear = new Date().getUTCFullYear() - 1;
  formFields[4] = doc.field('Date', `1/1/${lastYear}`, ARBITRARY_BOX);
  const flags = checkW9(doc.text, formFields, tokens, visualElements);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].message.includes("it's currently"), true);
});

Deno.test('checkW9 - future date is flagged', () => {
  const { doc, formFields, tokens, visualElements } = fullyFilledDoc();
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const raw = `${tomorrow.getUTCMonth() + 1}/${tomorrow.getUTCDate()}/${tomorrow.getUTCFullYear()}`;
  formFields[4] = doc.field('Date', raw, ARBITRARY_BOX);
  const flags = checkW9(doc.text, formFields, tokens, visualElements);
  // A same-day rollover could make "tomorrow" fall in a different year, in
  // which case the year check fires first -- either way it's one flag.
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'Date');
});

Deno.test('checkW9 - TIN present via the EIN row alone is not flagged', () => {
  const { doc, formFields, visualElements } = fullyFilledDoc();
  const einCenter = {
    x: (EIN_ROW.xMin + EIN_ROW.xMax) / 2,
    y: (EIN_ROW.yMin + EIN_ROW.yMax) / 2,
  };
  const tokens = [doc.token('12-3456789', { normalizedVertices: [einCenter] })];
  assertEquals(checkW9(doc.text, formFields, tokens, visualElements), []);
});

Deno.test('checkW9 - TIN present via the SSN row alone is not flagged', () => {
  const { doc, formFields, visualElements } = fullyFilledDoc();
  const ssnCenter = {
    x: (SSN_ROW.xMin + SSN_ROW.xMax) / 2,
    y: (SSN_ROW.yMin + SSN_ROW.yMax) / 2,
  };
  const tokens = [doc.token('123-45-6789', { normalizedVertices: [ssnCenter] })];
  assertEquals(checkW9(doc.text, formFields, tokens, visualElements), []);
});

Deno.test('checkW9 - TIN absent entirely falls back to the known form position', () => {
  const { doc, formFields, visualElements } = fullyFilledDoc();
  const flags = checkW9(doc.text, formFields, [], visualElements);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'TIN');
  assertEquals(flags[0].box, FALLBACK_BOXES.tin);
});

Deno.test('checkW9 - a token outside both TIN rows does not count as present', () => {
  const { doc, formFields, visualElements } = fullyFilledDoc();
  const tokens = [doc.token('unrelated', { normalizedVertices: [{ x: 0.1, y: 0.1 }] })];
  const flags = checkW9(doc.text, formFields, tokens, visualElements);
  assertEquals(
    flags.some((f) => f.label === 'TIN'),
    true,
  );
});

Deno.test(
  'checkW9 - each of the seven tax-classification checkboxes counts as checked',
  () => {
    for (const pos of TAX_CLASSIFICATION_CHECKBOXES) {
      const { doc, formFields, tokens } = fullyFilledDoc();
      const visualElements = [
        doc.visualElement('filled_checkbox', { normalizedVertices: [pos] }),
      ];
      const flags = checkW9(doc.text, formFields, tokens, visualElements);
      assertEquals(
        flags.some((f) => f.label === 'Tax classification'),
        false,
      );
    }
  },
);

Deno.test(
  'checkW9 - an unfilled checkbox at a known position does not count as checked',
  () => {
    const { doc, formFields, tokens } = fullyFilledDoc();
    const visualElements = [
      doc.visualElement('unfilled_checkbox', {
        normalizedVertices: [TAX_CLASSIFICATION_CHECKBOXES[0]],
      }),
    ];
    const flags = checkW9(doc.text, formFields, tokens, visualElements);
    assertEquals(
      flags.some((f) => f.label === 'Tax classification'),
      true,
    );
  },
);

Deno.test(
  'checkW9 - a filled checkbox away from any known position does not count as checked',
  () => {
    const { doc, formFields, tokens } = fullyFilledDoc();
    const visualElements = [
      doc.visualElement('filled_checkbox', { normalizedVertices: [{ x: 0.5, y: 0.9 }] }),
    ];
    const flags = checkW9(doc.text, formFields, tokens, visualElements);
    assertEquals(
      flags.some((f) => f.label === 'Tax classification'),
      true,
    );
  },
);

Deno.test('checkW9 - no checkboxes at all falls back to the known form position', () => {
  const { doc, formFields, tokens } = fullyFilledDoc();
  const flags = checkW9(doc.text, formFields, tokens, []);
  assertEquals(
    flags.find((f) => f.label === 'Tax classification')?.box,
    FALLBACK_BOXES.taxClassification,
  );
});

Deno.test('parseUsDate - accepts common US date formats', () => {
  assertEquals(parseUsDate('1/2/2026')?.getUTCFullYear(), 2026);
  assertEquals(parseUsDate('01-02-2026')?.getUTCMonth(), 0);
  assertEquals(parseUsDate('1/2/26')?.getUTCFullYear(), 2026);
});

Deno.test('parseUsDate - rejects unparseable text instead of throwing', () => {
  assertEquals(parseUsDate('next Tuesday'), null);
  assertEquals(parseUsDate(''), null);
});
