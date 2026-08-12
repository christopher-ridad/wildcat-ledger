export const POLICY_EXEMPTION_FORM_URL =
  'https://www.northwestern.edu/financial-operations/policies-procedures/forms/policy_exception.pdf';

// SOFO's external CardPointe payment portal for reimbursing tax mistakenly
// charged on a Debit Card purchase. No integration/callback exists here --
// clearing the reimbursement flag in-app is a separate, self-attested step.
export const SOFO_SALES_TAX_REIMBURSEMENT_URL =
  'https://sofosalestax.securepayments.cardpointe.com/pay';
