import { TransactionType } from '../types';
import { DocumentTypeKey, getRequiredDocuments } from './documentRequirements';

export interface RequirementSeed {
  key: DocumentTypeKey;
  label: string;
}

// The requirement checklist a financial task should have for a given
// payment type -- a thin wrapper around getRequiredDocuments (the app's one
// existing source of truth for "what documents does type X need") so
// financial_tasks doesn't grow a second, parallel copy of that logic.
export const requirementSeedsForPaymentType = (
  paymentType: TransactionType | undefined,
  isIndividualVendor: boolean,
): RequirementSeed[] =>
  paymentType
    ? getRequiredDocuments({ type: paymentType, isIndividualVendor }).map((doc) => ({
        key: doc.key,
        label: doc.label,
      }))
    : [];
