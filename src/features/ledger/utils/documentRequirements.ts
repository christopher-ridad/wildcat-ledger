import { FormState } from '../components/Dashboard/AddTransactionForm/types';
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

// How a missing document actually gets resolved in practice:
//  - 'simple': the other party just fills it out and sends it back --
//    Receipt, W-9, Special Pay Form.
//  - 'prepareFirst': a SOFO Approver downloads the blank template, fills in
//    the org's side first, then sends it to the vendor to sign -- RSO
//    Agreement, Contracted Services Form. Since a mailto link can't attach
//    a file automatically, the UI needs to remind them to attach their
//    filled-in copy before sending.
//  - 'none': nobody else is involved -- a SOFO Approver completes and
//    uploads it themselves, so there's nothing to email. Conflict of
//    Interest Form.
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
  // The form-time equivalents of `field`/`acknowledgedMissingField` -- named
  // differently on FormState than on Transaction (e.g. `contractFileUrl` vs
  // `contractFile`), so this bridges the two rather than being derivable by
  // a simple string transform. Used by validation.ts.
  formField: keyof FormState;
  formAcknowledgedMissingField?: keyof FormState;
  // Whether, when editing, an already-uploaded file on the transaction
  // being edited satisfies this requirement (true), or editing bypasses the
  // check entirely regardless of whether the file was ever uploaded
  // (false). Only the receipt requirement checks the existing file --
  // matches validateTransactionForm's pre-existing behavior.
  checkExistingFileOnEdit: boolean;
  // The exact validation-error message shown when this document is missing
  // and not acknowledged. Not derived from `label` because the receipt
  // message's wording differs from every other requirement's.
  missingMessage: string;
}

const RECEIPT: DocumentRequirement = {
  key: 'receipt',
  field: 'receiptFileUrl',
  label: 'Receipt',
  requestBehavior: 'simple',
  formField: 'receiptFile',
  formAcknowledgedMissingField: 'noReceiptAcknowledged',
  checkExistingFileOnEdit: true,
  missingMessage: 'Upload a receipt or check "I don\'t have a receipt".',
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
  formField: 'contractFile',
  formAcknowledgedMissingField: 'contractAcknowledgedMissing',
  checkExistingFileOnEdit: false,
  missingMessage: 'Upload the RSO Agreement or check "I don\'t have this yet".',
};
const W9: DocumentRequirement = {
  key: 'w9',
  field: 'w9FileUrl',
  acknowledgedMissingField: 'w9AcknowledgedMissing',
  label: 'W-9',
  templatePath: '/forms/w9.pdf',
  requestBehavior: 'simple',
  formField: 'w9File',
  formAcknowledgedMissingField: 'w9AcknowledgedMissing',
  checkExistingFileOnEdit: false,
  missingMessage: 'Upload the W-9 or check "I don\'t have this yet".',
};
const CONTRACTED_SERVICES: DocumentRequirement = {
  key: 'contractedServices',
  field: 'contractedServicesFileUrl',
  acknowledgedMissingField: 'contractedServicesAcknowledgedMissing',
  label: 'Contracted Services Form',
  templatePath: '/forms/contracted-services.pdf',
  requestBehavior: 'prepareFirst',
  formField: 'contractedServicesFile',
  formAcknowledgedMissingField: 'contractedServicesAcknowledgedMissing',
  checkExistingFileOnEdit: false,
  missingMessage:
    'Upload the Contracted Services Form or check "I don\'t have this yet".',
};
const CONFLICT_OF_INTEREST: DocumentRequirement = {
  key: 'conflictOfInterest',
  field: 'conflictOfInterestFileUrl',
  acknowledgedMissingField: 'conflictOfInterestAcknowledgedMissing',
  label: 'Conflict of Interest Form',
  templatePath: '/forms/conflict-of-interest.pdf',
  requestBehavior: 'none',
  formField: 'conflictOfInterestFile',
  formAcknowledgedMissingField: 'conflictOfInterestAcknowledgedMissing',
  checkExistingFileOnEdit: false,
  missingMessage:
    'Upload the Conflict of Interest Form or check "I don\'t have this yet".',
};
const SPECIAL_PAY_FORM: DocumentRequirement = {
  key: 'specialPayForm',
  field: 'specialPayFormUrl',
  acknowledgedMissingField: 'specialPayFormAcknowledgedMissing',
  label: 'Special Pay Form',
  templatePath: '/forms/special-pay-request-form.pdf',
  requestBehavior: 'simple',
  formField: 'specialPayFormFile',
  formAcknowledgedMissingField: 'specialPayFormAcknowledgedMissing',
  checkExistingFileOnEdit: false,
  missingMessage: 'Upload the Special Pay Form or check "I don\'t have this yet".',
};

// The documents a transaction needs, based on its type (and, for Payment
// Request, whether the vendor is an individual). Mirrors the requirements
// enforced in validation.ts (form-time) and the Approved/Paid gate in
// update_payment_status_with_audit (server-side) -- keep all three in sync.
export const getRequiredDocuments = (
  t: Pick<Transaction, 'type' | 'isIndividualVendor'>,
): DocumentRequirement[] => {
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

// Keyed lookup used by UploadDocumentPage.tsx, which only knows a document's
// key (from the emailed link's query param) and needs its field/label/prefix.
export const DOCUMENT_REQUIREMENTS_BY_KEY: Record<DocumentTypeKey, DocumentRequirement> =
  {
    receipt: RECEIPT,
    contract: CONTRACT,
    w9: W9,
    contractedServices: CONTRACTED_SERVICES,
    conflictOfInterest: CONFLICT_OF_INTEREST,
    specialPayForm: SPECIAL_PAY_FORM,
  };
