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
type DocumentRequestBehavior = 'simple' | 'prepareFirst' | 'none';

export interface DocumentRequirement {
  key: DocumentTypeKey;
  field: keyof Transaction;
  // An alternate field that also satisfies this requirement -- see
  // docs/BUSINESS_RULES.md#debit-card-reconciliation.
  alternateField?: keyof Transaction;
  label: string;
  templatePath?: string;
  requestBehavior: DocumentRequestBehavior;
  // The form-time equivalent of `field` -- named differently on FormState
  // than on Transaction (e.g. `contractFileUrl` vs `contractFile`), so this
  // bridges the two rather than being derivable by a simple string
  // transform.
  formField: keyof FormState;
  // Set on documents an org may choose not to keep a copy of in
  // WildcatLedger. Marking one not stored counts as having it -- see
  // docs/BUSINESS_RULES.md#documents-kept-outside-wildcatledger. Named the
  // same on Transaction and FormState.
  notStoredField?: keyof Transaction & keyof FormState;
  // Uploads run through a Document AI completeness check (W9/RSO
  // CompletenessCheck), which is still useful on a file that won't be stored.
  hasCompletenessCheck?: boolean;
  // Receipts only: they must be attached, or explicitly acknowledged
  // missing, before the transaction can be saved (an already-uploaded one
  // counts when editing). Every other document can be added after saving
  // and is just flagged missing until then.
  saveRequirement?: {
    formAcknowledgedMissingField: keyof FormState;
    missingMessage: string;
  };
}

const RECEIPT: DocumentRequirement = {
  key: 'receipt',
  field: 'receiptFileUrl',
  label: 'Receipt',
  requestBehavior: 'simple',
  formField: 'receiptFile',
  saveRequirement: {
    formAcknowledgedMissingField: 'noReceiptAcknowledged',
    missingMessage: 'Upload a receipt or check "I don\'t have a receipt".',
  },
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
  label: 'RSO Agreement',
  templatePath: '/forms/rso-agreement.pdf',
  requestBehavior: 'prepareFirst',
  formField: 'contractFile',
  hasCompletenessCheck: true,
  notStoredField: 'contractNotStored',
};
const W9: DocumentRequirement = {
  key: 'w9',
  field: 'w9FileUrl',
  label: 'W-9',
  templatePath: '/forms/w9.pdf',
  requestBehavior: 'simple',
  formField: 'w9File',
  hasCompletenessCheck: true,
  notStoredField: 'w9NotStored',
};
const CONTRACTED_SERVICES: DocumentRequirement = {
  key: 'contractedServices',
  field: 'contractedServicesFileUrl',
  label: 'Contracted Services Form',
  templatePath: '/forms/contracted-services.pdf',
  requestBehavior: 'prepareFirst',
  formField: 'contractedServicesFile',
  hasCompletenessCheck: true,
  notStoredField: 'contractedServicesNotStored',
};
const CONFLICT_OF_INTEREST: DocumentRequirement = {
  key: 'conflictOfInterest',
  field: 'conflictOfInterestFileUrl',
  label: 'Conflict of Interest Form',
  templatePath: '/forms/conflict-of-interest.pdf',
  requestBehavior: 'none',
  formField: 'conflictOfInterestFile',
  hasCompletenessCheck: true,
  notStoredField: 'conflictOfInterestNotStored',
};
const SPECIAL_PAY_FORM: DocumentRequirement = {
  key: 'specialPayForm',
  field: 'specialPayFormUrl',
  label: 'Special Pay Form',
  templatePath: '/forms/special-pay-request-form.pdf',
  requestBehavior: 'simple',
  formField: 'specialPayFormFile',
  hasCompletenessCheck: true,
  notStoredField: 'specialPayFormNotStored',
};

// The documents a transaction needs, based on its type (and, for Payment
// Request, whether the vendor is already on SOFO's Existing Vendor List or
// is an individual). Mirrors the Approved/Paid gate in
// update_payment_status_with_audit (server-side) -- keep the two in sync.
// See docs/BUSINESS_RULES.md#existing-vendors.
export const getRequiredDocuments = (
  t: Pick<Transaction, 'type' | 'isIndividualVendor' | 'isExistingVendor'>,
): DocumentRequirement[] => {
  switch (t.type) {
    case 'Debit Card':
      return [DEBIT_CARD_RECEIPT];
    case 'Non-Officer Reimbursement':
      return [RECEIPT];
    case 'Payment Request':
      if (t.isExistingVendor) return [CONTRACT];
      return t.isIndividualVendor
        ? [CONTRACT, W9, CONTRACTED_SERVICES, CONFLICT_OF_INTEREST]
        : [CONTRACT, W9];
    case 'Payment to NU Employee':
      return [CONTRACT, W9, SPECIAL_PAY_FORM];
    case 'Journal':
      return [];
    default:
      return [];
  }
};

const isNotStored = (t: Transaction, doc: DocumentRequirement) =>
  !!doc.notStoredField && !!t[doc.notStoredField];

export const getMissingDocuments = (t: Transaction): DocumentRequirement[] =>
  getRequiredDocuments(t).filter(
    (doc) =>
      !t[doc.field] &&
      !(doc.alternateField && t[doc.alternateField]) &&
      !isNotStored(t, doc),
  );

// Required documents the org chose not to keep a copy of in WildcatLedger.
export const getNotStoredDocuments = (t: Transaction): DocumentRequirement[] =>
  getRequiredDocuments(t).filter((doc) => !t[doc.field] && isNotStored(t, doc));

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

// See docs/BUSINESS_RULES.md#tax-exemption--sofo-reimbursement.
export const needsTaxReimbursement = (t: Transaction): boolean =>
  t.type === 'Debit Card' &&
  !t.taxExemptFormSubmitted &&
  (t.taxAmount ?? 0) > 0 &&
  !t.taxReimbursed;
