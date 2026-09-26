// The actual Contracted Services Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Grounded in real correctly-filled examples and a live test of the
// deployed check (provided by Christopher, September 2026) rather than a
// guess from the blank template alone:
//   - Requestor and Department are left blank on a genuinely complete
//     submission (evidently filled in by SOFO staff, not the org), so
//     this deliberately does not check them.
//   - Name and Address Line 1 never appear in Document AI's formFields at
//     all on this form, despite being filled in -- falls back to scanning
//     the page's raw OCR'd lines for these (see
//     findLabeledFieldStatuses/checkLabeledFieldsRobust's own header
//     comment in _shared/documentAi.ts).
//   - "To:" was OCR'd as "Το:" (Greek Tau + omicron) rather than Latin
//     "To:" -- see normalizeHomoglyphs.
//   - Additional Description of Services' value prints on the line below
//     its label, not beside it, and the label itself has trailing static
//     text ("...also describe the benefit to the award):") that would
//     look like a filled-in value if the same line were checked -- this
//     only checks the next line for that one. A blank description box has
//     no OCR'd line of its own either, so a genuinely blank one would
//     otherwise still read as "filled" from the "Contractor's
//     Acknowledgement" section heading that follows it on the real
//     form -- excluded via nextLineBoilerplate.
//
// Per Christopher: rather than flag each of these individually, the
// missing-fields hit test groups them by the form's own two printed
// sections -- "Contractor Information" (Name through Additional
// Description of Services) and "Contractor's Acknowledgement" (Signature,
// Date) -- and flags the whole section if anything inside it is missing,
// the same as RSO Agreement already does with its own numbered sections
// (see check-rso-agreement-completeness/check.ts). Unlike RSO's sections,
// there's no hand-calibrated box for either of these two -- the box drawn
// is the union of whichever member fields' own positions were actually
// found (see unionBoxes), filled or not.
//
// Still deliberately NOT checked: the University Approvals table and the
// University Payment Request section (both blank on the real examples too
// -- SOFO's own internal processing, added after upload -- see
// docs/BUSINESS_RULES.md#document-requirements--requesting-documents on
// the org filling in "their side" before sending it on) and the Check
// Handling checkboxes.
import {
  findLabeledFieldStatuses,
  FormField,
  Line,
  PresenceFlag,
  RobustFieldSpec,
  unionBoxes,
} from '../_shared/documentAi.ts';

const CONTRACTOR_INFO_SPECS: RobustFieldSpec[] = [
  {
    matchFieldName: (n) => n === 'name:',
    lineLabel: 'name:',
    valueLocation: 'sameLine',
    label: 'Contractor Name',
    message: "The contractor's name looks blank.",
  },
  {
    matchFieldName: (n) => n.includes('address line 1'),
    lineLabel: 'address line 1',
    valueLocation: 'sameLine',
    label: 'Address',
    message: "The contractor's address looks blank.",
  },
  {
    matchFieldName: (n) => n.includes('city') && n.includes('zip'),
    lineLabel: 'city, state',
    valueLocation: 'sameLine',
    label: 'City/State/Zip',
    message: "The contractor's city, state, and ZIP look blank.",
  },
  {
    matchFieldName: (n) => n === 'from:',
    lineLabel: 'from:',
    valueLocation: 'sameLine',
    label: 'Period of Service (From)',
    message: 'Period of Service start date looks blank.',
  },
  {
    matchFieldName: (n) => n === 'to:',
    lineLabel: 'to:',
    valueLocation: 'sameLine',
    label: 'Period of Service (To)',
    message: 'Period of Service end date looks blank.',
  },
  {
    matchFieldName: (n) => n.includes('flat fee'),
    lineLabel: 'flat fee',
    valueLocation: 'sameLine',
    label: 'Rate of Pay',
    message: 'Rate of Pay or Flat Fee looks blank.',
  },
  {
    lineLabel: 'additional description of services',
    valueLocation: 'nextLine',
    // A blank description box has no OCR'd line of its own, so the "next
    // line" Document AI reports is really the next thing printed on the
    // page regardless -- the "Contractor's Acknowledgement" section
    // heading that follows this box on the real form, whether the
    // description itself was filled in or not.
    nextLineBoilerplate: ["contractor's acknowledgement"],
    label: 'Description of Services',
    message: 'Additional Description of Services looks blank.',
  },
];

const ACKNOWLEDGEMENT_SPECS: RobustFieldSpec[] = [
  {
    matchFieldName: (n) => n.includes('contractor signature'),
    lineLabel: 'contractor signature',
    valueLocation: 'sameLine',
    label: 'Contractor Signature',
    message: "The contractor's signature looks blank.",
  },
  {
    // The form's only other "Date:" cells are in the University Approvals
    // table, which -- per the real examples this was checked against --
    // aren't picked up as formFields (or matching lines) at all while
    // blank, so the first "date:" match in practice is this one. Not
    // disambiguated by position the way RSO Agreement's Section 3/5 dates
    // are, since there's no real sample of a *filled* University
    // Approvals table to confirm how that would come through.
    matchFieldName: (n) => n === 'date:',
    lineLabel: 'date:',
    valueLocation: 'sameLine',
    label: 'Signature Date',
    message: "The contractor's signature date looks blank.",
  },
];

function checkSection(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
  specs: RobustFieldSpec[],
  sectionLabel: string,
  sectionMessage: string,
): PresenceFlag[] {
  const statuses = findLabeledFieldStatuses(documentText, formFields, lines, specs);
  if (statuses.every((s) => s.filled)) return [];
  return [
    {
      label: sectionLabel,
      message: sectionMessage,
      box: unionBoxes(statuses.map((s) => s.box)),
    },
  ];
}

export function checkContractedServices(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
): PresenceFlag[] {
  return [
    ...checkSection(
      documentText,
      formFields,
      lines,
      CONTRACTOR_INFO_SPECS,
      'Contractor Information',
      'Contractor Information looks incomplete.',
    ),
    ...checkSection(
      documentText,
      formFields,
      lines,
      ACKNOWLEDGEMENT_SPECS,
      "Contractor's Acknowledgement",
      "Contractor's Acknowledgement looks incomplete.",
    ),
  ];
}
