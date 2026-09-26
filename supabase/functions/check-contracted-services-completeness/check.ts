// The actual Contracted Services Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Unlike the W-9 and RSO Agreement checks, this one was not calibrated
// against a real Document AI API response (no live sample was available),
// but the fields it checks are grounded in a real example of a correctly
// filled-out form (provided by Christopher, September 2026) rather than a
// guess from the blank template alone. That example is also what revealed
// Requestor/Department/Phone/Email (the top block) are left blank on a
// genuinely complete submission -- they're evidently filled in by SOFO
// staff processing the request, not the org, so this deliberately does
// NOT check them despite being printed as plain labeled fields same as
// everything else on the form. What it does check, all filled in on that
// real example:
//   - Contractor Name, Address Line 1, City/State/Zip
//   - Period of Service From/To, Rate of Pay or Flat Fee
//   - Contractor Signature (the actual "this is filled in" signal from the
//     vendor's side)
// Deliberately NOT checked: the University Approvals table and the
// University Payment Request section (both blank on the real example too
// -- SOFO's own internal processing, added after upload -- see
// docs/BUSINESS_RULES.md#document-requirements--requesting-documents on
// the org filling in "their side" before sending it on), the Check
// Handling checkboxes, Additional Description of Services (filled on the
// real example but conditional per the form's own text -- "for sponsored
// project, also describe..." -- so not assumed required), and the "Date"
// next to the contractor's signature (the form has several other
// Date-labeled cells in the approvals table that a from-text match can't
// reliably tell apart from this one without real position data to
// disambiguate by, the same way the RSO Agreement check's Section 3/5
// fields are).
import { checkFieldsPresent, FormField, PresenceFlag } from '../_shared/documentAi.ts';

export function checkContractedServices(
  documentText: string,
  formFields: FormField[],
): PresenceFlag[] {
  return checkFieldsPresent(documentText, formFields, [
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
      matchName: (n) => n.includes('city') && n.includes('zip'),
      label: 'City/State/Zip',
      message: "The contractor's city, state, and ZIP look blank.",
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
