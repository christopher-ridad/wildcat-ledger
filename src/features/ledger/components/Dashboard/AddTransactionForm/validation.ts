import { BudgetLine, Transaction } from '../../../types';
import { FormState, FundingOption, SupportedType } from './types';

export const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

export const ZELLE_REGEX =
  /^([^\s@]+@[^\s@]+\.[^\s@]+|\+?1?\s*[-.]?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})$/;

export const deriveBudgetLine = (
  type: SupportedType,
  funding: FundingOption,
): BudgetLine => {
  if (type === 'Debit Card') return 'Debit Card';
  return funding;
};

export const deriveDirection = (type: SupportedType): 'Inflow' | 'Outflow' =>
  type === 'Deposit' ? 'Inflow' : 'Outflow';

// Returns an error message if the form isn't ready to submit, or null if it is.
// Each document requirement can be satisfied by an attached file OR by
// checking "I don't have this yet" -- the transaction still saves, but is
// flagged as missing that document (see documentRequirements.ts) and can't
// move to Approved/Paid until the file is actually uploaded, either
// directly or via a request sent from the transaction's Files modal
// after creation.
export const validateTransactionForm = (
  form: FormState,
  isEditing: boolean,
  existingTransaction: Transaction | undefined,
): string | null => {
  const amount = parseFloat(form.amount);

  if (!form.title.trim()) {
    return 'Title is required.';
  }
  if (!AMOUNT_REGEX.test(form.amount) || amount <= 0) {
    return 'Enter a valid dollar amount (e.g. 12.50). No negative values or scientific notation.';
  }

  if (form.type === 'Debit Card') {
    const hasExistingReceipt = isEditing && !!existingTransaction?.receiptFileUrl;
    if (!form.receiptFile && !hasExistingReceipt && !form.noReceiptAcknowledged) {
      return 'Upload a receipt or check "I don\'t have a receipt".';
    }
  }

  if (form.type === 'Payment Request') {
    if (!form.contractFile && !isEditing && !form.contractAcknowledgedMissing) {
      return 'Upload the RSO Agreement or check "I don\'t have this yet".';
    }
    if (!form.w9File && !isEditing && !form.w9AcknowledgedMissing) {
      return 'Upload the W-9 or check "I don\'t have this yet".';
    }
    if (form.isIndividualVendor) {
      if (
        !form.contractedServicesFile &&
        !isEditing &&
        !form.contractedServicesAcknowledgedMissing
      ) {
        return 'Upload the Contracted Services Form or check "I don\'t have this yet".';
      }
      if (
        !form.conflictOfInterestFile &&
        !isEditing &&
        !form.conflictOfInterestAcknowledgedMissing
      ) {
        return 'Upload the Conflict of Interest Form or check "I don\'t have this yet".';
      }
    }
  }

  if (form.type === 'Payment to NU Employee') {
    if (!form.contractFile && !isEditing && !form.contractAcknowledgedMissing) {
      return 'Upload the RSO Agreement or check "I don\'t have this yet".';
    }
    if (!form.w9File && !isEditing && !form.w9AcknowledgedMissing) {
      return 'Upload the W-9 or check "I don\'t have this yet".';
    }
    if (
      !form.specialPayFormFile &&
      !isEditing &&
      !form.specialPayFormAcknowledgedMissing
    ) {
      return 'Upload the Special Pay Form or check "I don\'t have this yet".';
    }
  }

  if (form.type === 'Non-Officer Reimbursement') {
    if (!form.reimbursedMemberName.trim()) {
      return 'Name of the member being reimbursed is required.';
    }
    const hasExistingReceipt = isEditing && !!existingTransaction?.receiptFileUrl;
    if (!form.receiptFile && !hasExistingReceipt && !form.noReceiptAcknowledged) {
      return 'Upload a receipt photo or check "I don\'t have a receipt".';
    }
    if (!form.zelleInfo.trim()) {
      return 'Zelle information (email or phone number) is required.';
    }
    if (!ZELLE_REGEX.test(form.zelleInfo.trim())) {
      return 'Enter a valid Zelle email address or US phone number.';
    }
  }

  return null;
};
