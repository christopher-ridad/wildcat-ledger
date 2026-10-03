/**
 * debitCardReconciliationForm.ts
 * Computes the numbers that go on SOFO's "Student Organization Debit Card
 * Reconciliation" form (public/forms/debit-card-reconciliation.pdf),
 * matching that form's own printed definitions (see its page 2 guide) --
 * not a WildcatLedger-specific interpretation.
 */

import { localDateString, todayDateString } from '../../../utils/today';
import { Organization, Transaction } from '../types';
import { isDebitCardPurchase, reloadedThrough } from '../utils/debitCardReloads';

interface ReconciliationFormReimbursement {
  date?: string;
  description: string;
  amount: number;
}

export interface ReconciliationFormData {
  orgName: string;
  // YYYY-MM-DD. The most recent earlier reconciliation recorded in the app,
  // or undefined if this is the first one here.
  lastReconciliationDate?: string;
  // YYYY-MM-DD. When the card balance below was read, i.e. today.
  balanceAsOfDate: string;
  accountNumber?: string;
  lastFourDigits?: string;
  inventoryControlNumber?: string;
  reimbursements: ReconciliationFormReimbursement[];
  totalReimbursed: number;
  loadBalance: number;
  balanceAsOf: number;
  // "The total amount of money from any previous reconciliations that have
  // not been reloaded" (the guide's own words) -- prior rounds only, not
  // including the batch being reconciled right now. See
  // utils/debitCardReloads.ts for what counts as reloaded.
  completedReconciliationsPendingReload: number;
  // Unreconciled debit card purchases NOT part of this reconciliation batch.
  pendingTransactions: number;
  totalExpenditures: number;
  authorizedCharges: number;
  serviceFees: number;
  reconciliationSubtotal: number;
  reloadAmount: number;
}

// IL sales tax is never an authorized charge (see the form's page 2 guide):
// it's split out of the purchase and paid back to SOFO separately.
const salesTax = (t: Transaction) => t.taxAmount ?? 0;

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

  // Only tax already marked as paid back counts as deposited.
  const reimbursements: ReconciliationFormReimbursement[] = selectedTxns
    .filter((t) => t.taxReimbursed && salesTax(t) > 0)
    .map((t) => ({ date: t.date, description: t.title, amount: salesTax(t) }));
  const totalReimbursed = reimbursements.reduce((sum, r) => sum + r.amount, 0);

  // "Do not include any reimbursements or service fees" (page 2 guide).
  const authorizedCharges = selectedTxns
    .filter((t) => t.direction === 'Outflow')
    .reduce((sum, t) => sum + t.amount - salesTax(t), 0);

  const reconciliationSubtotal = authorizedCharges + serviceFees + totalReimbursed;

  // Prior rounds whose money isn't back on the card yet. A round is
  // reloaded in full or not at all, so this is every purchase reconciled
  // after the most recent Paid reload was requested.
  const cardReloadedThrough = reloadedThrough(transactions);
  const completedReconciliationsPendingReload = transactions
    .filter(
      (t) =>
        isDebitCardPurchase(t) &&
        t.reconciledAt != null &&
        t.reconciledAt > cardReloadedThrough &&
        !selectedIds.has(t.id),
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingTransactions = transactions
    .filter(
      (t) => isDebitCardPurchase(t) && t.reconciledAt == null && !selectedIds.has(t.id),
    )
    .reduce((sum, t) => sum + t.amount, 0);

  // From the purchases themselves rather than the org's
  // lastReconciliationDate, which reconciling this round has already
  // overwritten by the time the form is generated.
  const lastReconciledAt = Math.max(
    0,
    ...transactions
      .filter(
        (t) => isDebitCardPurchase(t) && t.reconciledAt != null && !selectedIds.has(t.id),
      )
      .map((t) => t.reconciledAt ?? 0),
  );

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
    lastReconciliationDate: lastReconciledAt
      ? localDateString(lastReconciledAt)
      : undefined,
    balanceAsOfDate: todayDateString(),
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
