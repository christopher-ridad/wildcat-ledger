import { Transaction } from '../types';

// The doc-type keys used end-to-end for the request-via-email flow: as the
// query param on the emailed upload link (UploadDocumentPage.tsx) and as the
// key into a transaction's upload_tokens (submit_document_upload RPC).
export type DocumentTypeKey =
  | 'receipt'
  | 'contract'
  | 'w9'
  | 'contractedServices'
  | 'conflictOfInterest'
  | 'specialPayForm';

// See docs/BUSINESS_RULES.md#document-requirements--requesting-documents
// for what each behavior means and who acts on it.
export type DocumentRequestBehavior = 'simple' | 'prepareFirst' | 'none';

export interface DocumentRequirement {
  key: DocumentTypeKey;
  field: keyof Transaction;
  // An alternate field that also satisfies this requirement -- see
  // docs/BUSINESS_RULES.md#debit-card-reconciliation.
  alternateField?: keyof Transaction;
  acknowledgedMissingField?: keyof Transaction;
  label: string;
  templatePath?: string;
  requestBehavior: DocumentRequestBehavior;
}

const RECEIPT: DocumentRequirement = {
  key: 'receipt',
  field: 'receiptFileUrl',
  label: 'Receipt',
  requestBehavior: 'simple',
};

// Exemption forms are Debit-Card-specific (tax-exemption at the point of
// purchase); Non-Officer Reimbursement's receipt requirement has no such
// alternate, so this is a separate requirement rather than an addition to
// the shared RECEIPT above.
const DEBIT_CARD_RECEIPT: DocumentRequirement = {
  ...RECEIPT,
  alternateField: 'exemptionFormUrl',
};
const CONTRACT: DocumentRequirement = {
  key: 'contract',
  field: 'contractFileUrl',
  acknowledgedMissingField: 'contractAcknowledgedMissing',
  label: 'RSO Agreement',
  templatePath: '/forms/rso-agreement.pdf',
  requestBehavior: 'prepareFirst',
};
const W9: DocumentRequirement = {
  key: 'w9',
  field: 'w9FileUrl',
  acknowledgedMissingField: 'w9AcknowledgedMissing',
  label: 'W-9',
  templatePath: '/forms/w9.pdf',
  requestBehavior: 'simple',
};
const CONTRACTED_SERVICES: DocumentRequirement = {
  key: 'contractedServices',
  field: 'contractedServicesFileUrl',
  acknowledgedMissingField: 'contractedServicesAcknowledgedMissing',
  label: 'Contracted Services Form',
  templatePath: '/forms/contracted-services.pdf',
  requestBehavior: 'prepareFirst',
};
const CONFLICT_OF_INTEREST: DocumentRequirement = {
  key: 'conflictOfInterest',
  field: 'conflictOfInterestFileUrl',
  acknowledgedMissingField: 'conflictOfInterestAcknowledgedMissing',
  label: 'Conflict of Interest Form',
  templatePath: '/forms/conflict-of-interest.pdf',
  requestBehavior: 'none',
};
const SPECIAL_PAY_FORM: DocumentRequirement = {
  key: 'specialPayForm',
  field: 'specialPayFormUrl',
  acknowledgedMissingField: 'specialPayFormAcknowledgedMissing',
  label: 'Special Pay Form',
  templatePath: '/forms/special-pay-request-form.pdf',
  requestBehavior: 'simple',
};

// See docs/BUSINESS_RULES.md#transaction-types--their-documents -- mirrors
// validation.ts (form-time) and the SQL-side Approved/Paid gate; keep all
// three in sync.
export const getRequiredDocuments = (t: Transaction): DocumentRequirement[] => {
  switch (t.type) {
    case 'Debit Card':
      return [DEBIT_CARD_RECEIPT];
    case 'Non-Officer Reimbursement':
      return [RECEIPT];
    case 'Payment Request':
      return t.isIndividualVendor
        ? [CONTRACT, W9, CONTRACTED_SERVICES, CONFLICT_OF_INTEREST]
        : [CONTRACT, W9];
    case 'Payment to NU Employee':
      return [CONTRACT, W9, SPECIAL_PAY_FORM];
    case 'Deposit':
      return [];
    default:
      return [];
  }
};

export const getMissingDocuments = (t: Transaction): DocumentRequirement[] =>
  getRequiredDocuments(t).filter(
    (doc) => !t[doc.field] && !(doc.alternateField && t[doc.alternateField]),
  );

// See docs/BUSINESS_RULES.md#tax-exemption--sofo-reimbursement.
export const needsTaxReimbursement = (t: Transaction): boolean =>
  t.type === 'Debit Card' &&
  !t.taxExemptFormSubmitted &&
  (t.taxAmount ?? 0) > 0 &&
  !t.taxReimbursed;
