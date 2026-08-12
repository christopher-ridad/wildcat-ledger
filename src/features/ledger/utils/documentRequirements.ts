import { Transaction } from '../types';

// The doc-type keys used end-to-end for the request-via-email flow: as the
// query param on the emailed upload link (UploadReceiptPage.tsx) and as the
// key into a transaction's upload_tokens (submit_document_upload RPC).
export type DocumentTypeKey =
  | 'receipt'
  | 'contract'
  | 'w9'
  | 'contractedServices'
  | 'conflictOfInterest'
  | 'specialPayForm';

export interface DocumentRequirement {
  key: DocumentTypeKey;
  field: keyof Transaction;
  acknowledgedMissingField?: keyof Transaction;
  label: string;
  templatePath?: string;
}

const RECEIPT: DocumentRequirement = {
  key: 'receipt',
  field: 'receiptFileUrl',
  label: 'Receipt',
};
const CONTRACT: DocumentRequirement = {
  key: 'contract',
  field: 'contractFileUrl',
  acknowledgedMissingField: 'contractAcknowledgedMissing',
  label: 'RSO Agreement',
  templatePath: '/forms/rso-agreement.pdf',
};
const W9: DocumentRequirement = {
  key: 'w9',
  field: 'w9FileUrl',
  acknowledgedMissingField: 'w9AcknowledgedMissing',
  label: 'W-9',
  templatePath: '/forms/w9.pdf',
};
const CONTRACTED_SERVICES: DocumentRequirement = {
  key: 'contractedServices',
  field: 'contractedServicesFileUrl',
  acknowledgedMissingField: 'contractedServicesAcknowledgedMissing',
  label: 'Contracted Services Form',
  templatePath: '/forms/contracted-services.pdf',
};
const CONFLICT_OF_INTEREST: DocumentRequirement = {
  key: 'conflictOfInterest',
  field: 'conflictOfInterestFileUrl',
  acknowledgedMissingField: 'conflictOfInterestAcknowledgedMissing',
  label: 'Conflict of Interest Form',
  templatePath: '/forms/conflict-of-interest.pdf',
};
const SPECIAL_PAY_FORM: DocumentRequirement = {
  key: 'specialPayForm',
  field: 'specialPayFormUrl',
  acknowledgedMissingField: 'specialPayFormAcknowledgedMissing',
  label: 'Special Pay Form',
  templatePath: '/forms/special-pay-request-form.pdf',
};

// The documents a transaction needs, based on its type (and, for Payment
// Request, whether the vendor is an individual). Mirrors the requirements
// enforced in validation.ts (form-time) and the Approved/Paid gate in
// update_payment_status_with_audit (server-side) -- keep all three in sync.
export const getRequiredDocuments = (t: Transaction): DocumentRequirement[] => {
  switch (t.type) {
    case 'Debit Card':
      return [RECEIPT];
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
  getRequiredDocuments(t).filter((doc) => !t[doc.field]);
