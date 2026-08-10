import { BudgetLine, Transaction } from '../../../types';
import { FormState, FundingOption, SupportedType } from './types';

export const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

export const ZELLE_REGEX =
  /^([^\s@]+@[^\s@]+\.[^\s@]+|\+?1?\s*[-.]?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})$/;

export const deriveBudgetLine = (
  type: SupportedType,
  funding: FundingOption,
): BudgetLine => {
  if (type === 'Debit card purchase') return 'Debit Card';
  return funding;
};

export const deriveDirection = (type: SupportedType): 'Inflow' | 'Outflow' =>
  type === 'Deposit' ? 'Inflow' : 'Outflow';

// Returns an error message if the form isn't ready to submit, or null if it is.
export const validateTransactionForm = (
  form: FormState,
  isEditing: boolean,
  existingTransaction: Transaction | undefined,
  requestedDocTypes: Set<string>,
): string | null => {
  const amount = parseFloat(form.amount);

  if (!form.title.trim()) {
    return 'Title is required.';
  }
  if (!AMOUNT_REGEX.test(form.amount) || amount <= 0) {
    return 'Enter a valid dollar amount (e.g. 12.50). No negative values or scientific notation.';
  }

  if (form.type === 'Debit card purchase') {
    const hasExistingReceipt = isEditing && !!existingTransaction?.receiptFileUrl;
    if (
      !form.receiptFile &&
      !hasExistingReceipt &&
      !form.noReceiptAcknowledged &&
      !requestedDocTypes.has('receipt')
    ) {
      return 'Upload a receipt, request one via email, or check "I don\'t have a receipt".';
    }
  }

  if (form.type === 'Direct payment') {
    if (!form.contractFile && !isEditing && !requestedDocTypes.has('contract')) {
      return 'Upload the RSO Agreement or request it via email.';
    }
    if (!form.w9File && !isEditing && !requestedDocTypes.has('w9')) {
      return 'Upload the W-9 or request it via email.';
    }
    if (form.isIndividualVendor) {
      if (
        !form.contractedServicesFile &&
        !isEditing &&
        !requestedDocTypes.has('contractedServices')
      ) {
        return 'Upload the Contracted Services Form or request it via email.';
      }
      if (
        !form.conflictOfInterestFile &&
        !isEditing &&
        !requestedDocTypes.has('conflictOfInterest')
      ) {
        return 'Upload the Conflict of Interest Form or request it via email.';
      }
    }
    if (form.isNorthwesternEmployee) {
      if (
        !form.specialPayFormFile &&
        !isEditing &&
        !requestedDocTypes.has('specialPayForm')
      ) {
        return 'Upload the Special Pay Form or request it via email.';
      }
    }
  }

  if (form.type === 'Reimbursement') {
    if (!form.receiptFile && !isEditing && !requestedDocTypes.has('receipt')) {
      return 'Upload a receipt photo or request one via email.';
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
