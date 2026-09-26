// The actual Contracted Services Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Unlike the W-9 and RSO Agreement checks, this one was NOT calibrated
// against a real Document AI response (no live sample was available) --
// its field-name matchers are a best effort read of the actual template
// PDF's printed labels (public/forms/contracted-services.pdf), and it only
// covers fields whose label is unique enough on the page to match
// confidently without ambiguity:
//   - Requestor, Department (top block)
//   - Contractor Name, Address Line 1 (Contractor Information)
//   - Period of Service From/To, Rate of Pay or Flat Fee
//   - Contractor Signature (the actual "this is filled in" signal from the
//     vendor's side)
// Deliberately NOT checked: the University Approvals table (that's SOFO's
// own internal sign-off, added after upload -- see
// docs/BUSINESS_RULES.md#document-requirements--requesting-documents on
// the org filling in "their side" before sending it on), the Check
// Handling checkboxes, and the "Date" next to the contractor's signature
// (the form has several other Date-labeled cells in the approvals table
// that a from-text match can't reliably tell apart from this one without
// real position data to disambiguate by, the same way the RSO Agreement
// check's Section 3/5 fields are).
import { checkFieldsPresent, FormField, PresenceFlag } from '../_shared/documentAi.ts';

export function checkContractedServices(
  documentText: string,
  formFields: FormField[],
): PresenceFlag[] {
  return checkFieldsPresent(documentText, formFields, [
    {
      matchName: (n) => n === 'requestor:',
      label: 'Requestor',
      message: 'Requestor looks blank.',
    },
    {
      matchName: (n) => n === 'department:',
      label: 'Department',
      message: 'Department looks blank.',
    },
    {
      matchName: (n) => n === 'name:',
      label: 'Contractor Name',
      message: "The contractor's name looks blank.",
    },
    {
      matchName: (n) => n.includes('address line 1'),
      label: 'Address',
      message: "The contractor's address looks blank.",
    },
    {
      matchName: (n) => n === 'from:',
      label: 'Period of Service (From)',
      message: 'Period of Service start date looks blank.',
    },
    {
      matchName: (n) => n === 'to:',
      label: 'Period of Service (To)',
      message: 'Period of Service end date looks blank.',
    },
    {
      matchName: (n) => n.includes('flat fee'),
      label: 'Rate of Pay',
      message: 'Rate of Pay or Flat Fee looks blank.',
    },
    {
      matchName: (n) => n.includes('contractor signature'),
      label: 'Contractor Signature',
      message: "The contractor's signature looks blank.",
    },
  ]);
}
