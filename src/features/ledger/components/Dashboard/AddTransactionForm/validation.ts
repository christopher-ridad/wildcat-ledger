import { BudgetLine, Transaction } from '../../../types';
import { getRequiredDocuments } from '../../../utils/documentRequirements';
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

// Returns an error message if the form isn't ready to submit, or null if it
// is. Document requirements mirror documentRequirements.ts -- see
// docs/BUSINESS_RULES.md#document-requirements--requesting-documents.
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

  if (form.type === 'Non-Officer Reimbursement' && !form.reimbursedMemberName.trim()) {
    return 'Name of the member being reimbursed is required.';
  }

  for (const doc of getRequiredDocuments(form)) {
    const hasExistingFile =
      isEditing && (!doc.checkExistingFileOnEdit || !!existingTransaction?.[doc.field]);
    const acknowledgedMissing = doc.formAcknowledgedMissingField
      ? form[doc.formAcknowledgedMissingField]
      : false;
    if (!form[doc.formField] && !hasExistingFile && !acknowledgedMissing) {
      return doc.missingMessage;
    }
  }

  if (form.type === 'Non-Officer Reimbursement') {
    if (!form.zelleInfo.trim()) {
      return 'Zelle information (email or phone number) is required.';
    }
    if (!ZELLE_REGEX.test(form.zelleInfo.trim())) {
      return 'Enter a valid Zelle email address or US phone number.';
    }
  }

  return null;
};
