import {
  DocumentTypeKey,
  getRequiredDocuments,
} from '../../ledger/utils/documentRequirements';
import { FinancialTaskInput } from '../types';

export interface RequirementSeed {
  key: DocumentTypeKey;
  label: string;
}

// The requirement checklist a financial task should have for its payment
// type -- a thin wrapper around getRequiredDocuments (the app's one source
// of truth for "what documents does type X need") so financial_tasks
// doesn't grow a second, parallel copy of that logic.
export const requirementSeedsForTask = ({
  paymentType,
  isIndividualVendor,
  isExistingVendor,
}: Pick<
  FinancialTaskInput,
  'paymentType' | 'isIndividualVendor' | 'isExistingVendor'
>): RequirementSeed[] => {
  if (!paymentType) return [];
  return getRequiredDocuments({
    type: paymentType,
    isIndividualVendor,
    isExistingVendor,
  }).map(({ key, label }) => ({ key, label }));
};
