// The actual Special Pay Request Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Unlike the W-9 and RSO Agreement checks, this one was NOT calibrated
// against a real Document AI response (no live sample was available) --
// its field-name matchers are a best effort read of the actual template
// PDF's printed labels (public/forms/special-pay-request-form.pdf), and it
// only covers the Employee Information / Payment Information fields plus
// who filled the form out, all of which are uniquely labeled on the page.
//
// Deliberately NOT checked:
//   - Hours of Work per Week: conditionally optional (not required for
//     Honorarium/Student Award payments), which this has no way to tell
//     apart from the other job titles without reading the Nature of
//     Service checkboxes below.
//   - Funding (Fund/FN Dept/Project/Activity/Chartfield1/Account/Percent):
//     a repeated two-row table, not a set of uniquely labeled fields.
//   - Nature of Service: ~17 job-title checkboxes. Checking any of them
//     reliably would need the same kind of visualElements-position
//     calibration the W-9's tax-classification checkboxes got from a real
//     feasibility spike -- see check-w9-completeness/check.ts's header
//     comment for why that's not something this attempts without one.
//   - Employee Certification / DCFS Acknowledgement: two separate
//     "Employee's Signature:" lines on the same page with no other
//     distinguishing label text, the same kind of ambiguity the Conflict
//     of Interest check's header comment describes for its own repeated
//     Signature/Date pairs.
import { checkFieldsPresent, FormField, PresenceFlag } from '../_shared/documentAi.ts';

export function checkSpecialPayForm(
  documentText: string,
  formFields: FormField[],
): PresenceFlag[] {
  return checkFieldsPresent(documentText, formFields, [
    {
      matchName: (n) => n.includes('university id number'),
      label: 'University ID Number',
      message: 'University ID Number looks blank.',
    },
    {
      matchName: (n) => n === 'last name:',
      label: 'Last Name',
      message: 'Last Name looks blank.',
    },
    {
      matchName: (n) => n === 'first name:',
      label: 'First Name',
      message: 'First Name looks blank.',
    },
    {
      matchName: (n) => n.includes('hr department id'),
      label: 'HR Department ID',
      message: 'HR Department ID looks blank.',
    },
    {
      matchName: (n) => n === 'department name:',
      label: 'Department Name',
      message: 'Department Name looks blank.',
    },
    {
      matchName: (n) => n.includes('period of service begin date'),
      label: 'Period of Service (Begin)',
      message: 'Period of Service Begin Date looks blank.',
    },
    {
      matchName: (n) => n.includes('period of service end date'),
      label: 'Period of Service (End)',
      message: 'Period of Service End Date looks blank.',
    },
    {
      matchName: (n) => n.includes('earnings amount'),
      label: 'Earnings Amount',
      message: 'Earnings Amount looks blank.',
    },
    {
      matchName: (n) => n.includes('name of person completing form'),
      label: 'Completed By',
      message: 'The name of the person completing this form looks blank.',
    },
  ]);
}
