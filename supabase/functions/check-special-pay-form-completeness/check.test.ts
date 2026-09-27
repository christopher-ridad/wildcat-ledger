import { assertEquals } from 'jsr:@std/assert@1';

import { boxFrom } from '../_shared/documentAi.ts';
import { FixtureDoc } from '../_shared/testFixtures.ts';
import { checkSpecialPayForm, computeSectionBoxes } from './check.ts';

const ARBITRARY_BOX = boxFrom(0, 0.1, 0, 0.1);

// Section headings, in the order they print on the page -- each section's
// box is computed from its own heading down to the next one (see
// computeSectionBoxes in check.ts), so every test needs all six present
// even when it only cares about one section.
const HEADING_Y = {
  employeeInformation: 0.08,
  paymentInformation: 0.16,
  funding: 0.24,
  natureOfService: 0.32,
  employeeCertification: 0.5,
  approvals: 0.6,
};
const NATURE_OF_SERVICE_BOX = boxFrom(0.55, 0.6, 0.34, 0.35);
const FUND_ROW_Y = 0.26;

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

  const headingLine = (heading: keyof typeof HEADING_Y, text: string) =>
    doc.line(text, boxFrom(0.05, 0.3, HEADING_Y[heading], HEADING_Y[heading] + 0.01));

  const employeeInformationHeading = headingLine(
    'employeeInformation',
    'Employee Information',
  );
  const paymentInformationHeading = headingLine(
    'paymentInformation',
    'Payment Information',
  );
  const fundingHeading = headingLine('funding', 'Funding');
  // Funding row: all five required cells on one combined printed line,
  // plus the two not required (Chartfield1, Account) -- matches the
  // template's own single-row layout as best guessed without a real
  // sample.
  const fundRow = doc.line(
    'Fund: 100 FN Dept: 5678 Project: A123 Activity: 1 Chartfield1:  Account: 60111 Percent: 100',
    boxFrom(0.05, 0.9, FUND_ROW_Y, FUND_ROW_Y + 0.01),
  );
  const natureOfServiceHeading = headingLine('natureOfService', 'Nature of Service');
  const checkmark = doc.line('☑', NATURE_OF_SERVICE_BOX);
  const employeeCertificationHeading = headingLine(
    'employeeCertification',
    'Employee Certification',
  );
  const signature1 = doc.line(
    "Employee's Signature: Jane Doe",
    boxFrom(0.05, 0.6, 0.52, 0.53),
  );
  const signature2 = doc.line(
    "Employee's Signature: Jane Doe",
    boxFrom(0.05, 0.6, 0.58, 0.59),
  );
  const approvalsHeading = headingLine('approvals', 'Approvals');

  const lines = [
    employeeInformationHeading,
    paymentInformationHeading,
    fundingHeading,
    fundRow,
    natureOfServiceHeading,
    checkmark,
    employeeCertificationHeading,
    signature1,
    signature2,
    approvalsHeading,
  ];

  return {
    doc,
    formFields,
    lines,
    visualElements: [],
    fundRow,
    checkmark,
    signature1,
    signature2,
  };
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
    assertEquals(flags[0].box, computeSectionBoxes(doc.text, lines).employeeInformation);
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
    assertEquals(flags[0].box, computeSectionBoxes(doc.text, lines).paymentInformation);
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
  const { doc, formFields, lines, visualElements, fundRow } = fullyFilledDoc();
  const idx = lines.indexOf(fundRow);
  lines[idx] = doc.line(
    'Fund: 100 FN Dept: 5678 Project: A123 Activity: 1 Chartfield1:  Account: 60111 Percent: ',
    boxFrom(0.05, 0.9, FUND_ROW_Y, FUND_ROW_Y + 0.01),
  );
  const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
  assertEquals(flags.length, 1);
  assertEquals(flags[0].label, 'Funding');
  assertEquals(flags[0].box, computeSectionBoxes(doc.text, lines).funding);
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
    const { doc, formFields, lines, visualElements, fundRow } = fullyFilledDoc();
    const idx = lines.indexOf(fundRow);
    lines[idx] = doc.line(
      'Fund: 100',
      boxFrom(0.05, 0.2, FUND_ROW_Y, FUND_ROW_Y + 0.005),
    );
    lines.splice(
      idx + 1,
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
    const { doc, formFields, lines, visualElements, checkmark } = fullyFilledDoc();
    const withoutCheckmark = lines.filter((l) => l !== checkmark);
    const flags = checkSpecialPayForm(
      doc.text,
      formFields,
      withoutCheckmark,
      visualElements,
    );
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Nature of Service');
    assertEquals(
      flags[0].box,
      computeSectionBoxes(doc.text, withoutCheckmark).natureOfService,
    );
  },
);

Deno.test(
  'checkSpecialPayForm - a filled_checkbox visualElement inside Nature of Service also counts',
  () => {
    const { doc, formFields, lines, visualElements, checkmark } = fullyFilledDoc();
    const withoutCheckmark = lines.filter((l) => l !== checkmark);
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
    const { doc, formFields, lines, visualElements, checkmark } = fullyFilledDoc();
    const idx = lines.indexOf(checkmark);
    lines[idx] = doc.line('☑', boxFrom(0.55, 0.6, 0.9, 0.91));
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
    const { doc, formFields, lines, visualElements, signature2 } = fullyFilledDoc();
    const idx = lines.indexOf(signature2);
    lines[idx] = doc.line("Employee's Signature: ", boxFrom(0.05, 0.6, 0.58, 0.59));
    const flags = checkSpecialPayForm(doc.text, formFields, lines, visualElements);
    assertEquals(flags.length, 1);
    assertEquals(flags[0].label, 'Employee Certification');
    assertEquals(
      flags[0].box,
      computeSectionBoxes(doc.text, lines).employeeCertification,
    );
  },
);

Deno.test(
  "checkSpecialPayForm - both Employee's Signature lines blank flags Employee Certification",
  () => {
    const { doc, formFields, lines, visualElements, signature1, signature2 } =
      fullyFilledDoc();
    lines[lines.indexOf(signature1)] = doc.line(
      "Employee's Signature: ",
      boxFrom(0.05, 0.6, 0.52, 0.53),
    );
    lines[lines.indexOf(signature2)] = doc.line(
      "Employee's Signature: ",
      boxFrom(0.05, 0.6, 0.58, 0.59),
    );
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
    const { doc, formFields, lines, visualElements, signature2 } = fullyFilledDoc();
    formFields[0] = doc.field('University ID Number:', '', ARBITRARY_BOX); // Employee Information
    formFields[5] = doc.field('Period of Service Begin Date:', '', ARBITRARY_BOX); // Payment Information
    lines[lines.indexOf(signature2)] = doc.line(
      "Employee's Signature: ",
      boxFrom(0.05, 0.6, 0.58, 0.59),
    ); // Employee Certification
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

// Regression test: a real upload had an extra "Do you anticipate
// submitting another Special Pay request..." Yes/No question wedged into
// Payment Information (a newer form revision than the blank template this
// was first built against), which shifts every section below it further
// down the page than a fixed y-fraction guess would expect. Boxes are
// computed from each section's own heading position, not a fixed guess,
// so a page laid out with extra vertical space here should still box each
// section correctly rather than drifting onto the wrong one.
Deno.test(
  'checkSpecialPayForm - a section pushed further down the page than the fixed-fraction guess is still boxed correctly',
  () => {
    const doc = new FixtureDoc();
    // Deliberately far outside FALLBACK_SECTION_BOXES' fractions for
    // Funding (0.235-0.315) and Nature of Service (0.315-0.5) -- if boxes
    // were still coming from the fixed guess instead of these real
    // heading positions, this test would fail.
    const fundingHeadingY = 0.6;
    const natureOfServiceHeadingY = 0.7;
    const lines = [
      doc.line('Employee Information', boxFrom(0.05, 0.3, 0.08, 0.09)),
      doc.line('Payment Information', boxFrom(0.05, 0.3, 0.16, 0.17)),
      doc.line('Funding', boxFrom(0.05, 0.3, fundingHeadingY, fundingHeadingY + 0.01)),
      doc.line(
        'Nature of Service',
        boxFrom(0.05, 0.3, natureOfServiceHeadingY, natureOfServiceHeadingY + 0.01),
      ),
      doc.line('Employee Certification', boxFrom(0.05, 0.3, 0.8, 0.81)),
      doc.line('Approvals', boxFrom(0.05, 0.3, 0.9, 0.91)),
    ];
    const boxes = computeSectionBoxes(doc.text, lines);
    assertEquals(boxes.funding.normalizedVertices[0].y, fundingHeadingY - 0.015);
    assertEquals(
      boxes.funding.normalizedVertices[2].y,
      natureOfServiceHeadingY - 0.015 - 0.01,
    );
  },
);

// Regression test: an earlier version computed a box's bottom edge and the
// next section's top edge to the exact same y, so two sections flagged at
// once (a real upload: Employee Information and Payment Information) had
// their boxes touch with no gap and read as one merged rectangle.
Deno.test(
  'checkSpecialPayForm - two adjacent sections both incomplete get visually separate boxes',
  () => {
    const doc = new FixtureDoc();
    const lines = [
      doc.line('Employee Information', boxFrom(0.05, 0.3, 0.08, 0.09)),
      doc.line('Payment Information', boxFrom(0.05, 0.3, 0.16, 0.17)),
      doc.line('Funding', boxFrom(0.05, 0.3, 0.24, 0.25)),
      doc.line('Nature of Service', boxFrom(0.05, 0.3, 0.32, 0.33)),
      doc.line('Employee Certification', boxFrom(0.05, 0.3, 0.5, 0.51)),
      doc.line('Approvals', boxFrom(0.05, 0.3, 0.6, 0.61)),
    ];
    const boxes = computeSectionBoxes(doc.text, lines);
    const employeeInformationBottom = boxes.employeeInformation.normalizedVertices[2].y;
    const paymentInformationTop = boxes.paymentInformation.normalizedVertices[0].y;
    assertEquals(employeeInformationBottom < paymentInformationTop, true);
  },
);

// Falls back to the fixed-fraction guess when a heading genuinely can't be
// found at all (a non-standard copy of the form, a bad scan) rather than
// leaving a flag with no usable box.
Deno.test(
  'checkSpecialPayForm - falls back to a fixed box when a heading is entirely missing',
  () => {
    const doc = new FixtureDoc();
    const boxes = computeSectionBoxes(doc.text, []);
    assertEquals(boxes.funding.normalizedVertices[0].y, 0.235);
  },
);

// Regression coverage for the real bug: a genuinely fillable PDF pairs
// each Funding cell as its own formField (name "Fund:", value "731",
// etc), all five landing within a few thousandths of each other in y --
// not present in `lines` as a combined "Fund: ... Percent: ..." row at
// all. An earlier version only ever checked lines and would have wrongly
// flagged this as incomplete.
Deno.test(
  'checkSpecialPayForm - a funding row present only in formFields (not lines) is recognized as complete',
  () => {
    const { doc, formFields, lines, visualElements, fundRow } = fullyFilledDoc();
    const withoutFundRowLine = lines.filter((l) => l !== fundRow);
    const fundingFormFields = [
      ...formFields,
      doc.field('Fund:', '731', boxFrom(0, 0.1, FUND_ROW_Y, FUND_ROW_Y + 0.001)),
      doc.field('FN Dept:', '2106100', boxFrom(0.1, 0.2, FUND_ROW_Y, FUND_ROW_Y + 0.001)),
      doc.field(
        'Project:',
        '70019963',
        boxFrom(0.2, 0.3, FUND_ROW_Y, FUND_ROW_Y + 0.001),
      ),
      doc.field('Activity:', '01', boxFrom(0.3, 0.4, FUND_ROW_Y, FUND_ROW_Y + 0.001)),
      doc.field('Percent:', '100', boxFrom(0.4, 0.5, FUND_ROW_Y, FUND_ROW_Y + 0.001)),
    ];
    assertEquals(
      checkSpecialPayForm(
        doc.text,
        fundingFormFields,
        withoutFundRowLine,
        visualElements,
      ),
      [],
    );
  },
);

Deno.test(
  'checkSpecialPayForm - a funding row in formFields missing one cell still flags Funding',
  () => {
    const { doc, formFields, lines, visualElements, fundRow } = fullyFilledDoc();
    const withoutFundRowLine = lines.filter((l) => l !== fundRow);
    const fundingFormFields = [
      ...formFields,
      doc.field('Fund:', '731', boxFrom(0, 0.1, FUND_ROW_Y, FUND_ROW_Y + 0.001)),
      doc.field('FN Dept:', '2106100', boxFrom(0.1, 0.2, FUND_ROW_Y, FUND_ROW_Y + 0.001)),
      doc.field(
        'Project:',
        '70019963',
        boxFrom(0.2, 0.3, FUND_ROW_Y, FUND_ROW_Y + 0.001),
      ),
      doc.field('Activity:', '01', boxFrom(0.3, 0.4, FUND_ROW_Y, FUND_ROW_Y + 0.001)),
      // Percent left unpaired entirely.
    ];
    const flags = checkSpecialPayForm(
      doc.text,
      fundingFormFields,
      withoutFundRowLine,
      visualElements,
    );
    assertEquals(
      flags.some((f) => f.label === 'Funding'),
      true,
    );
  },
);

// Regression coverage for the real bug: a checked box paired as its own
// formField, with the check glyph as the *value* ("Honorarium (106243)"
// paired with "☑") -- not present in lines or visualElements at all. An
// earlier version only checked those two and would have wrongly flagged
// this as incomplete.
Deno.test(
  'checkSpecialPayForm - a checked box present only as a formField value is recognized',
  () => {
    const { doc, formFields, lines, visualElements, checkmark } = fullyFilledDoc();
    const withoutCheckmarkLine = lines.filter((l) => l !== checkmark);
    const withCheckedFormField = [
      ...formFields,
      doc.field('Honorarium (106243)', '☑', NATURE_OF_SERVICE_BOX),
    ];
    assertEquals(
      checkSpecialPayForm(
        doc.text,
        withCheckedFormField,
        withoutCheckmarkLine,
        visualElements,
      ),
      [],
    );
  },
);

// Regression coverage for the real bug: both "Employee's Signature:"
// fields pair as their own formField, with the handwritten signature
// OCR'd -- imperfectly, but non-empty -- as the value (a real upload saw
// "The be" and "There" for two different actual signatures). An earlier
// version only checked lines and would have wrongly flagged this
// incomplete.
Deno.test(
  "checkSpecialPayForm - two Employee's Signature formFields with garbled but non-empty OCR values are recognized",
  () => {
    const { doc, formFields, lines, visualElements, signature1, signature2 } =
      fullyFilledDoc();
    const withoutSignatureLines = lines.filter(
      (l) => l !== signature1 && l !== signature2,
    );
    const signatureFormFields = [
      ...formFields,
      doc.field("Employee's Signature:", 'The be', boxFrom(0.05, 0.6, 0.52, 0.53)),
      doc.field("Employee's Signature:", 'There', boxFrom(0.05, 0.6, 0.58, 0.59)),
    ];
    assertEquals(
      checkSpecialPayForm(
        doc.text,
        signatureFormFields,
        withoutSignatureLines,
        visualElements,
      ),
      [],
    );
  },
);

// The same physical signature detected via both formFields and a raw
// line (both sources describe the same location) should only count once
// -- two formFields-plus-lines pairs at the SAME two locations must still
// only reach a count of 2, not 4, and one location detected twice must
// not be mistaken for two distinct signatures.
Deno.test(
  'checkSpecialPayForm - the same signature found in both formFields and lines is not double-counted',
  () => {
    const { doc, formFields, lines, visualElements, signature2 } = fullyFilledDoc();
    // signature1 (from fullyFilledDoc) is already present as a line at
    // y=0.52-0.53; add a formField for that exact same location. Only
    // one of the two required signatures is genuinely present elsewhere.
    const idx = lines.indexOf(signature2);
    lines[idx] = doc.line("Employee's Signature: ", boxFrom(0.05, 0.6, 0.58, 0.59)); // blank
    const duplicatedFormFields = [
      ...formFields,
      doc.field("Employee's Signature:", 'Jane Doe', boxFrom(0.05, 0.6, 0.52, 0.53)),
    ];
    const flags = checkSpecialPayForm(
      doc.text,
      duplicatedFormFields,
      lines,
      visualElements,
    );
    assertEquals(
      flags.some((f) => f.label === 'Employee Certification'),
      true,
    );
  },
);
