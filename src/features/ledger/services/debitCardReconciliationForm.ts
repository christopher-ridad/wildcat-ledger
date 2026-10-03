/**
 * debitCardReconciliationForm.ts
 * Computes the numbers that go on SOFO's "Student Organization Debit Card
 * Reconciliation" form (public/forms/debit-card-reconciliation.pdf),
 * matching that form's own printed definitions (see its page 2 guide) --
 * not a WildcatLedger-specific interpretation.
 */

import { Organization, Transaction } from '../types';

interface ReconciliationFormReimbursement {
  date?: string;
  description: string;
  amount: number;
}

export interface ReconciliationFormData {
  orgName: string;
  accountNumber?: string;
  lastFourDigits?: string;
  inventoryControlNumber?: string;
  reimbursements: ReconciliationFormReimbursement[];
  totalReimbursed: number;
  loadBalance: number;
  balanceAsOf: number;
  // "The total amount of money from any previous reconciliations that have
  // not been reloaded" (the guide's own words) -- prior rounds only, not
  // including the batch being reconciled right now.
  completedReconciliationsPendingReload: number;
  // Unreconciled debit card purchases NOT part of this reconciliation batch.
  pendingTransactions: number;
  totalExpenditures: number;
  authorizedCharges: number;
  serviceFees: number;
  reconciliationSubtotal: number;
  reloadAmount: number;
}

const isDebitCardPurchase = (t: Transaction) =>
  t.budgetLine === 'Debit Card' && t.type !== 'Journal';

// A reload is a Journal (Inflow) on the Debit Card line -- see
// handleRequestReload in ReconciliationModal.tsx, which is the only place
// one is ever created. Only a Paid one has actually reloaded the card.
const isPaidReload = (t: Transaction) =>
  t.budgetLine === 'Debit Card' &&
  t.type === 'Journal' &&
  t.direction === 'Inflow' &&
  t.paymentStatus === 'Paid';

// selectedTransactionIds is the batch just reconciled (or about to be) --
// by the time this runs in the real flow, those transactions already have
// reconciledAt set, so every other computation here has to explicitly
// exclude them to isolate "prior" activity.
export function calculateReconciliationFormData(
  organization: Organization,
  selectedTransactionIds: string[],
  serviceFees: number,
): ReconciliationFormData {
  const selectedIds = new Set(selectedTransactionIds);
  const transactions = organization.transactions;
  const selectedTxns = transactions.filter((t) => selectedIds.has(t.id));

  const reimbursements: ReconciliationFormReimbursement[] = selectedTxns
    .filter((t) => (t.taxAmount ?? 0) > 0)
    .map((t) => ({ date: t.date, description: t.title, amount: t.taxAmount ?? 0 }));
  const totalReimbursed = reimbursements.reduce((sum, r) => sum + r.amount, 0);

  const authorizedCharges = selectedTxns
    .filter((t) => t.direction === 'Outflow')
    .reduce((sum, t) => sum + t.amount, 0);

  const reconciliationSubtotal = authorizedCharges + serviceFees + totalReimbursed;

  const priorReconciledTotal = transactions
    .filter(
      (t) => isDebitCardPurchase(t) && t.reconciledAt != null && !selectedIds.has(t.id),
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const paidReloadsTotal = transactions
    .filter(isPaidReload)
    .reduce((sum, t) => sum + t.amount, 0);
  // Clamped at 0: a negative value here would only mean more was reloaded
  // than was ever reconciled, which shouldn't happen and isn't a
  // meaningful number to print on the form either way.
  const completedReconciliationsPendingReload = Math.max(
    0,
    priorReconciledTotal - paidReloadsTotal,
  );

  const pendingTransactions = transactions
    .filter(
      (t) => isDebitCardPurchase(t) && t.reconciledAt == null && !selectedIds.has(t.id),
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const loadBalance = organization.debitCardSettings.loadBalance ?? 0;
  const balanceAsOf = organization.budgetAllocations['Debit Card'];

  // The form's own formula (see page 2's "Total Expenditures" definition):
  // how much the group spent this period, backed into from the card's
  // known balances rather than summed directly -- which is also what lets
  // it double as a consistency check against reconciliationSubtotal.
  const totalExpenditures =
    loadBalance -
    balanceAsOf -
    completedReconciliationsPendingReload -
    pendingTransactions;

  // This round's subtotal plus whatever from prior rounds is still owed a
  // reload -- the actual amount that should go back onto the card now.
  const reloadAmount = reconciliationSubtotal + completedReconciliationsPendingReload;

  return {
    orgName: organization.name,
    accountNumber: organization.debitCardSettings.accountNumber,
    lastFourDigits: organization.debitCardSettings.lastFourDigits,
    inventoryControlNumber: organization.debitCardSettings.inventoryControlNumber,
    reimbursements,
    totalReimbursed,
    loadBalance,
    balanceAsOf,
    completedReconciliationsPendingReload,
    pendingTransactions,
    totalExpenditures,
    authorizedCharges,
    serviceFees,
    reconciliationSubtotal,
    reloadAmount,
  };
}
