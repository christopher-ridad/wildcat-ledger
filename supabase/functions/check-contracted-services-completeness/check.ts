// The actual Contracted Services Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Grounded in a real correctly-filled example and a live test
// (Christopher, September 2026), not a guess from the blank template:
//   - Requestor and Department are left blank on a genuinely complete
//     submission (filled in by SOFO staff, not the org) -- not checked.
//   - Name and Address Line 1 never appear in formFields on this form
//     despite being filled in -- falls back to scanning raw OCR'd lines
//     (see findLabeledFieldStatuses in _shared/documentAi.ts).
//   - "To:" OCRs as "Το:" (Greek Tau + omicron) -- see normalizeHomoglyphs.
//   - Additional Description of Services' value prints on the line below
//     its label, and the label's own trailing text would otherwise read
//     as a value -- checks the next line instead, excluding the
//     "Contractor's Acknowledgement" heading that follows a blank box
//     (nextLineBoilerplate).
//
// Per Christopher: flags are grouped by the form's two printed sections --
// "Contractor Information" (Name through Description of Services) and
// "Contractor's Acknowledgement" (Signature, Date) -- rather than one per
// field, the same pattern RSO Agreement's numbered sections use.
//
// SECTION_BOXES here is a visual estimate read off a reference image
// Christopher marked up on the blank template, not a Document AI
// feasibility spike like RSO Agreement's -- expect it to need a nudge once
// seen against a real render.
import {
  Box,
  boxFrom,
  findLabeledFieldStatuses,
  FormField,
  Line,
  PresenceFlag,
  RobustFieldSpec,
} from '../_shared/documentAi.ts';

export const SECTION_BOXES: Record<'contractorInformation' | 'acknowledgement', Box> = {
  contractorInformation: boxFrom(0.04, 0.97, 0.198, 0.391),
  acknowledgement: boxFrom(0.04, 0.97, 0.391, 0.526),
};

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
    // The label itself prints "City, State  Zip:" as one combined run (note
    // the real double space before "Zip", confirmed off a live upload) --
    // 'city, state' alone left "Zip:" itself in the post-label remainder,
    // which read as a non-empty value even on a genuinely blank line.
    lineLabel: 'city, state  zip',
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
    // Blank box has no OCR'd line of its own -- "next line" is really the
    // "Contractor's Acknowledgement" heading regardless of fill state.
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
    // The only other "Date:" cells (University Approvals table) aren't
    // picked up as formFields while blank, so this is the first real
    // match -- not position-disambiguated like RSO Agreement's, since
    // there's no filled Approvals sample to confirm how that would come
    // through.
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
  box: Box,
  sectionLabel: string,
  sectionMessage: string,
): PresenceFlag[] {
  const statuses = findLabeledFieldStatuses(documentText, formFields, lines, specs);
  if (statuses.every((s) => s.filled)) return [];
  return [{ label: sectionLabel, message: sectionMessage, box }];
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
      SECTION_BOXES.contractorInformation,
      'Contractor Information',
      'Contractor Information looks incomplete.',
    ),
    ...checkSection(
      documentText,
      formFields,
      lines,
      ACKNOWLEDGEMENT_SPECS,
      SECTION_BOXES.acknowledgement,
      "Contractor's Acknowledgement",
      "Contractor's Acknowledgement looks incomplete.",
    ),
  ];
}
