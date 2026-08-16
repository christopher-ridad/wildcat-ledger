import { BudgetAllocations } from '../types';

export const POLICY_EXEMPTION_FORM_URL =
  'https://www.northwestern.edu/financial-operations/policies-procedures/forms/policy_exception.pdf';

// See docs/BUSINESS_RULES.md#tax-exemption--sofo-reimbursement.
export const SOFO_SALES_TAX_REIMBURSEMENT_URL =
  'https://sofosalestax.securepayments.cardpointe.com/pay';

export const EMPTY_ALLOCATIONS: BudgetAllocations = {
  ASG: 0,
  Operating: 0,
  Gifts: 0,
  'Debit Card': 0,
};
