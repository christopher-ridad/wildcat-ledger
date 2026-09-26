// The actual Special Pay Request Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Field-name matchers are a best effort read of the actual template PDF's
// printed labels (public/forms/special-pay-request-form.pdf), covering the
// Employee Information / Payment Information fields plus who filled the
// form out, all of which are uniquely labeled on the page.
//
// Uses checkLabeledFieldsRobust (see its own header comment in
// _shared/documentAi.ts) rather than a plain formFields lookup, on the
// assumption that this form -- also Northwestern-designed, also run
// through the same generic Document AI processor -- has the same
// unreliable formFields pairing a real Contracted Services Form upload
// confirmed (its Name and Address fields never got paired at all). Not
// independently confirmed for this specific form yet, but cheap insurance
// against the same class of false positive.
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
import {
  checkLabeledFieldsRobust,
  FormField,
  Line,
  PresenceFlag,
} from '../_shared/documentAi.ts';

export function checkSpecialPayForm(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
): PresenceFlag[] {
  return checkLabeledFieldsRobust(documentText, formFields, lines, [
    {
      matchFieldName: (n) => n.includes('university id number'),
      lineLabel: 'university id number',
      valueLocation: 'sameLine',
      label: 'University ID Number',
      message: 'University ID Number looks blank.',
    },
    {
      matchFieldName: (n) => n === 'last name:',
      lineLabel: 'last name:',
      valueLocation: 'sameLine',
      label: 'Last Name',
      message: 'Last Name looks blank.',
    },
    {
      matchFieldName: (n) => n === 'first name:',
      lineLabel: 'first name:',
      valueLocation: 'sameLine',
      label: 'First Name',
      message: 'First Name looks blank.',
    },
    {
      matchFieldName: (n) => n.includes('hr department id'),
      lineLabel: 'hr department id',
      valueLocation: 'sameLine',
      label: 'HR Department ID',
      message: 'HR Department ID looks blank.',
    },
    {
      matchFieldName: (n) => n === 'department name:',
      lineLabel: 'department name:',
      valueLocation: 'sameLine',
      label: 'Department Name',
      message: 'Department Name looks blank.',
    },
    {
      matchFieldName: (n) => n.includes('period of service begin date'),
      lineLabel: 'period of service begin date',
      valueLocation: 'sameLine',
      label: 'Period of Service (Begin)',
      message: 'Period of Service Begin Date looks blank.',
    },
    {
      matchFieldName: (n) => n.includes('period of service end date'),
      lineLabel: 'period of service end date',
      valueLocation: 'sameLine',
      label: 'Period of Service (End)',
      message: 'Period of Service End Date looks blank.',
    },
    {
      matchFieldName: (n) => n.includes('earnings amount'),
      lineLabel: 'earnings amount',
      valueLocation: 'sameLine',
      label: 'Earnings Amount',
      message: 'Earnings Amount looks blank.',
    },
    {
      matchFieldName: (n) => n.includes('name of person completing form'),
      lineLabel: 'name of person completing form',
      valueLocation: 'sameLine',
      label: 'Completed By',
      message: 'The name of the person completing this form looks blank.',
    },
  ]);
}
