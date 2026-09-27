import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import { checkSpecialPayForm, SECTION_BOXES } from './check.ts';

const ARBITRARY_BOX = boxFrom(0, 0.1, 0, 0.1);
const NATURE_OF_SERVICE_HEADING_Y = 0.4;
const EMPLOYEE_CERT_HEADING_Y = 0.5;
const NATURE_OF_SERVICE_BOX = boxFrom(0.55, 0.6, 0.42, 0.43);
const FUND_ROW_Y = 0.3;

function fullyFilledDoc() {
  const doc = new FixtureDoc();
  const formFields = [
    doc.field('University ID Number:', '1234567', ARBITRARY_BOX),
    doc.field('HR Department ID:', '5678', ARBITRARY_BOX),
    doc.field('Department Name:', 'Student Affairs', ARBITRARY_BOX),
    doc.field('Last Name:', 'Doe', ARBITRARY_BOX),
    doc.field('First Name:', 'Jane', ARBITRARY_BOX),
    doc.field('Period of Service Begin Date:', '1/1/2026', ARBITRARY_BOX),
    doc.field('Period of Service End Date:', '1/14/2026', ARBITRARY_BOX),
    doc.field('Earnings Amount:', '$500', ARBITRARY_BOX),
    doc.field('Hours of Work per Week:', '10', ARBITRARY_BOX),
  ];
  const lines = [
    // Funding row: all five required cells on one combined printed line,
    // plus the two not required (Chartfield1, Account) -- matches the
    // template's own single-row layout as best guessed without a real
    // sample.
    doc.line(
      'Fund: 100 FN Dept: 5678 Project: A123 Activity: 1 Chartfield1:  Account: 60111 Percent: 100',
      boxFrom(0.05, 0.9, FUND_ROW_Y, FUND_ROW_Y + 0.01),
    ),
    doc.line(
      'Nature of Service',
      boxFrom(0.05, 0.3, NATURE_OF_SERVICE_HEADING_Y, NATURE_OF_SERVICE_HEADING_Y + 0.01),
    ),
    doc.line('☑', NATURE_OF_SERVICE_BOX),
    doc.line(
      'Employee Certification',
      boxFrom(0.05, 0.3, EMPLOYEE_CERT_HEADING_Y, EMPLOYEE_CERT_HEADING_Y + 0.01),
    ),
    doc.line("Employee's Signature: Jane Doe", boxFrom(0.05, 0.6, 0.52, 0.53)),
    doc.line("Employee's Signature: Jane Doe", boxFrom(0.05, 0.6, 0.58, 0.59)),
  ];
  return { doc, formFields, lines, visualElements: [] };
}

Deno.test('checkSpecialPayForm - fully filled document has no flags', () => {
  const { doc, formFields, lines, visualElements } = fullyFilledDoc();
  assertEquals(checkSpecialPayForm(doc.text, formFields, lines, visualElements), []);
});

Deno.test(
  'checkSpecialPayForm - blank University ID flags Employee Information, not Payment Information',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    formFields[0] = doc.field('University ID Number:', '', ARBITRARY_BOX);
    const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Employee Information');
    assertEquals(flags[0].box, SECTION_BOXES.employeeInformation);
  },
);

Deno.test(
  'checkSpecialPayForm - blank HR Department ID flags Employee Information',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    formFields[1] = doc.field('HR Department ID:', '', ARBITRARY_BOX);
    const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
    assertEquals(
      flags.some((f) => f.label === 'Employee Information'),
      true,
    );
  },
);

Deno.test(
  'checkSpecialPayForm - blank Department Name flags Employee Information',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    formFields[2] = doc.field('Department Name:', '', ARBITRARY_BOX);
    const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
    assertEquals(
      flags.some((f) => f.label === 'Employee Information'),
      true,
    );
  },
);

Deno.test('checkSpecialPayForm - blank Last Name flags Employee Information', () => {
  const { doc, formFields, lines, visualElements } = fullyFilledDoc();
  formFields[3] = doc.field('Last Name:', '', ARBITRARY_BOX);
  const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
  assertEquals(
    flags.some((f) => f.label === 'Employee Information'),
    true,
  );
});

Deno.test('checkSpecialPayForm - blank First Name flags Employee Information', () => {
  const { doc, formFields, lines, visualElements } = fullyFilledDoc();
  formFields[4] = doc.field('First Name:', '', ARBITRARY_BOX);
  const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
  assertEquals(
    flags.some((f) => f.label === 'Employee Information'),
    true,
  );
});

Deno.test(
  'checkSpecialPayForm - blank Period of Service Begin Date flags Payment Information, not Employee Information',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    formFields[5] = doc.field('Period of Service Begin Date:', '', ARBITRARY_BOX);
    const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Payment Information');
    assertEquals(flags[0].box, SECTION_BOXES.paymentInformation);
  },
);

Deno.test(
  'checkSpecialPayForm - blank Period of Service End Date flags Payment Information',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    formFields[6] = doc.field('Period of Service End Date:', '', ARBITRARY_BOX);
    const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
    assertEquals(
      flags.some((f) => f.label === 'Payment Information'),
      true,
    );
  },
);

Deno.test('checkSpecialPayForm - blank Earnings Amount flags Payment Information', () => {
  const { doc, formFields, lines, visualElements } = fullyFilledDoc();
  formFields[7] = doc.field('Earnings Amount:', '', ARBITRARY_BOX);
  const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
  assertEquals(
    flags.some((f) => f.label === 'Payment Information'),
    true,
  );
});

Deno.test(
  'checkSpecialPayForm - blank Hours of Work per Week flags Payment Information',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    formFields[8] = doc.field('Hours of Work per Week:', '', ARBITRARY_BOX);
    const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
    assertEquals(
      flags.some((f) => f.label === 'Payment Information'),
      true,
    );
  },
);

Deno.test('checkSpecialPayForm - field name matching is case-insensitive', () => {
  const { doc, formFields, lines, visualElements } = fullyFilledDoc();
  formFields[0] = doc.field('UNIVERSITY ID NUMBER:', '1234567', ARBITRARY_BOX);
  assertEquals(checkSpecialPayForm(doc.text, formFields, lines, visualElements), []);
});

Deno.test(
  'checkSpecialPayForm - falls back to a line scan when Document AI never paired a field at all',
  () => {
    const { doc, lines, visualElements } = fullyFilledDoc();
    const flags = checkSpecialPayForm(doc.text, [], lines, visualElements);
    assertEquals(
      flags.some((f) => f.label === 'Employee Information'),
      true,
    );
    assertEquals(
      flags.some((f) => f.label === 'Payment Information'),
      true,
    );
  },
);

// Funding: no row has all five required cells filled -- Percent is blank
// on the only row present.
Deno.test('checkSpecialPayForm - incomplete funding row flags Funding only', () => {
  const { doc, formFields, lines, visualElements } = fullyFilledDoc();
  lines[0] = doc.line(
    'Fund: 100 FN Dept: 5678 Project: A123 Activity: 1 Chartfield1:  Account: 60111 Percent: ',
    boxFrom(0.05, 0.9, FUND_ROW_Y, FUND_ROW_Y + 0.01),
  );
  const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'Funding');
  assertEquals(flags[0].box, SECTION_BOXES.funding);
});

// A second, blank funding row alongside a fully filled first row is still
// complete -- only one row needs to be filled.
Deno.test(
  'checkSpecialPayForm - one complete funding row is enough even if a second row is blank',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    lines.push(
      doc.line(
        'Fund:  FN Dept:  Project:  Activity:  Chartfield1:  Account: 60111 Percent: ',
        boxFrom(0.05, 0.9, FUND_ROW_Y + 0.05, FUND_ROW_Y + 0.06),
      ),
    );
    assertEquals(checkSpecialPayForm(doc.text, formFields, lines, visualElements), []);
  },
);

// Funding row split across several separate OCR'd lines rather than one
// combined line -- each label still found within the same row-local Y
// band.
Deno.test(
  'checkSpecialPayForm - funding row split across separate lines is still recognized as complete',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    lines[0] = doc.line('Fund: 100', boxFrom(0.05, 0.2, FUND_ROW_Y, FUND_ROW_Y + 0.005));
    lines.splice(
      1,
      0,
      doc.line('FN Dept: 5678', boxFrom(0.2, 0.35, FUND_ROW_Y, FUND_ROW_Y + 0.005)),
      doc.line('Project: A123', boxFrom(0.35, 0.5, FUND_ROW_Y, FUND_ROW_Y + 0.005)),
      doc.line('Activity: 1', boxFrom(0.5, 0.65, FUND_ROW_Y, FUND_ROW_Y + 0.005)),
      doc.line('Percent: 100', boxFrom(0.65, 0.8, FUND_ROW_Y, FUND_ROW_Y + 0.005)),
    );
    assertEquals(checkSpecialPayForm(doc.text, formFields, lines, visualElements), []);
  },
);

Deno.test(
  'checkSpecialPayForm - no checkmark glyph anywhere in Nature of Service flags Nature of Service only',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    const withoutCheckmark = lines.filter((l) => l !== lines[2]);
    const flags = checkSpecialPayForm(
      doc.text,
      formFields,
      withoutCheckmark,
      visualElements,
    );
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Nature of Service');
    assertEquals(flags[0].box, SECTION_BOXES.natureOfService);
  },
);

Deno.test(
  'checkSpecialPayForm - a filled_checkbox visualElement inside Nature of Service also counts',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    const withoutCheckmark = lines.filter((l) => l !== lines[2]);
    const withVisualElement = [
      ...visualElements,
      doc.visualElement('filled_checkbox', NATURE_OF_SERVICE_BOX),
    ];
    assertEquals(
      checkSpecialPayForm(doc.text, formFields, withoutCheckmark, withVisualElement),
      [],
    );
  },
);

Deno.test(
  'checkSpecialPayForm - a checkmark outside the Nature of Service region does not count',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    lines[2] = doc.line('☑', boxFrom(0.55, 0.6, 0.9, 0.91));
    const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
    assertEquals(
      flags.some((f) => f.label === 'Nature of Service'),
      true,
    );
  },
);

Deno.test(
  "checkSpecialPayForm - only one filled Employee's Signature line flags Employee Certification only",
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    lines[5] = doc.line("Employee's Signature: ", boxFrom(0.05, 0.6, 0.58, 0.59));
    const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Employee Certification');
    assertEquals(flags[0].box, SECTION_BOXES.employeeCertification);
  },
);

Deno.test(
  "checkSpecialPayForm - both Employee's Signature lines blank flags Employee Certification",
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    lines[4] = doc.line("Employee's Signature: ", boxFrom(0.05, 0.6, 0.52, 0.53));
    lines[5] = doc.line("Employee's Signature: ", boxFrom(0.05, 0.6, 0.58, 0.59));
    const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
    assertEquals(
      flags.some((f) => f.label === 'Employee Certification'),
      true,
    );
  },
);

Deno.test(
  'checkSpecialPayForm - multiple incomplete sections each produce their own separate flag',
  () => {
    const { doc, formFields, lines, visualElements } = fullyFilledDoc();
    formFields[0] = doc.field('University ID Number:', '', ARBITRARY_BOX); // Employee Information
    formFields[5] = doc.field('Period of Service Begin Date:', '', ARBITRARY_BOX); // Payment Information
    lines[5] = doc.line("Employee's Signature: ", boxFrom(0.05, 0.6, 0.58, 0.59)); // Employee Certification
    const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
    assertEquals(flags.length, 3);
    assertEquals(
      flags.map((f) => f.label).sort(),
      ['Employee Certification', 'Employee Information', 'Payment Information'].sort(),
    );
  },
);

Deno.test(
  'checkSpecialPayForm - all five sections incomplete produces five separate flags',
  () => {
    const doc = new FixtureDoc();
    const flags = checkSpecialPayForm(doc.text, [], [], []);
    assertEquals(
      flags.map((f) => f.label).sort(),
      [
        'Employee Certification',
        'Employee Information',
        'Funding',
        'Nature of Service',
        'Payment Information',
      ].sort(),
    );
  },
);
