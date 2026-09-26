// The actual Contracted Services Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Grounded in two real correctly-filled examples (provided by Christopher,
// September 2026) rather than a guess from the blank template alone. The
// first revealed Requestor and Department are left blank on a genuinely
// complete submission (evidently filled in by SOFO staff, not the org), so
// this deliberately does not check them despite being printed as plain
// labeled fields same as everything else on the form. The second, tested
// live against the deployed check, revealed real Document AI limitations
// this now works around (see checkLabeledFieldsRobust's own header
// comment in _shared/documentAi.ts):
//   - Name and Address Line 1 never appear in Document AI's formFields at
//     all on this form, despite being filled in -- falls back to scanning
//     the page's raw OCR'd lines for these.
//   - "To:" was OCR'd as "Το:" (Greek Tau + omicron) rather than Latin
//     "To:" -- see normalizeHomoglyphs.
//   - Additional Description of Services' value prints on the line below
//     its label, not beside it, and the label itself has trailing static
//     text ("...also describe the benefit to the award):") that would
//     look like a filled-in value if the same line were checked -- this
//     only checks the next line for that one.
//
// Still deliberately NOT checked: the University Approvals table and the
// University Payment Request section (both blank on the real examples too
// -- SOFO's own internal processing, added after upload -- see
// docs/BUSINESS_RULES.md#document-requirements--requesting-documents on
// the org filling in "their side" before sending it on), the Check
// Handling checkboxes, and the "Date" next to the contractor's signature
// (the form has several other Date-labeled cells in the approvals table
// that a from-text match can't reliably tell apart from this one without
// real position data to disambiguate by, the same way the RSO Agreement
// check's Section 3/5 fields are).
import {
  checkLabeledFieldsRobust,
  FormField,
  Line,
  PresenceFlag,
} from '../_shared/documentAi.ts';

export function checkContractedServices(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
): PresenceFlag[] {
  return checkLabeledFieldsRobust(documentText, formFields, lines, [
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
      matchFieldName: (n) => n.includes('contractor signature'),
      lineLabel: 'contractor signature',
      valueLocation: 'sameLine',
      label: 'Contractor Signature',
      message: "The contractor's signature looks blank.",
    },
    {
      lineLabel: 'additional description of services',
      valueLocation: 'nextLine',
      label: 'Description of Services',
      message: 'Additional Description of Services looks blank.',
    },
  ]);
}
