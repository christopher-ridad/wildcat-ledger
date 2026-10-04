import { Transaction } from '../types';

// A reload is a Journal on the Debit Card line -- see handleRequestReload in
// ReconciliationModal.tsx, the only place one is ever created.
export const isDebitCardReload = (t: Transaction) =>
  t.budgetLine === 'Debit Card' && t.type === 'Journal';

export const isDebitCardPurchase = (t: Transaction) =>
  t.budgetLine === 'Debit Card' && !isDebitCardReload(t);

const requestedAt = (t: Transaction) => t.reloadRequestedAt ?? 0;

// SOFO reloads in full and only acts on the most recent request, which
// covers everything reconciled before it. So every purchase reconciled at
// or before this moment is back on the card. See
// docs/BUSINESS_RULES.md#reloads.
export const reloadedThrough = (transactions: Transaction[]): number =>
  Math.max(
    0,
    ...transactions
      .filter((t) => isDebitCardReload(t) && t.paymentStatus === 'Paid')
      .map(requestedAt),
  );

// Older reload requests that are still unpaid once a newer one exists.
// SOFO will never process them, and marking one Paid would count the same
// money twice (update_payment_status_with_audit refuses to).
export const getSupersededReloadIds = (transactions: Transaction[]): Set<string> => {
  const reloads = transactions.filter(isDebitCardReload);
  const latest = Math.max(0, ...reloads.map(requestedAt));
  return new Set(
    reloads
      .filter((t) => t.paymentStatus !== 'Paid' && requestedAt(t) < latest)
      .map((t) => t.id),
  );
};
