// The actual Conflict of Interest Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Unlike the W-9 and RSO Agreement checks, this one was NOT calibrated
// against a real Document AI response (no live sample was available) --
// its field-name matchers are a best effort read of the actual template
// PDF's printed labels (public/forms/conflict-of-interest.pdf).
//
// Deliberately narrow: this one-page form has three near-identical
// "Signature:" / "Date:" pairs (the submitter, the individual(s) who
// selected the vendor, and a conditional COI Manager one required only if
// any Yes/No question was answered "Yes"), none of them individually
// labeled, so there's no reliable text-only way to tell them apart the way
// the RSO Agreement check's Section 3/5 fields are disambiguated -- that
// disambiguation needed real page-position data from a feasibility spike
// this check never had. Rather than guess, this only checks the three
// fields that ARE uniquely labeled: the vendor name, and the name lines
// that precede each of the first two signature blocks (which, unlike the
// signatures themselves, do have distinct label text). The Yes/No/Comments
// table and the conditional COI Manager sign-off are not checked at all.
import { checkFieldsPresent, FormField, PresenceFlag } from '../_shared/documentAi.ts';

export function checkConflictOfInterest(
  documentText: string,
  formFields: FormField[],
): PresenceFlag[] {
  return checkFieldsPresent(documentText, formFields, [
    {
      matchName: (n) => n.includes('proposed vendor name'),
      label: 'Vendor Name',
      message: 'Proposed Vendor Name looks blank.',
    },
    {
      matchName: (n) => n.includes('individual submitting the form'),
      label: 'Submitted By',
      message: 'The name of the individual submitting the form looks blank.',
    },
    {
      matchName: (n) => n.includes('selected or directed the vendor'),
      label: 'Selected/Directed By',
      message:
        'The name of the individual(s) who selected or directed the vendor looks blank.',
    },
  ]);
}
