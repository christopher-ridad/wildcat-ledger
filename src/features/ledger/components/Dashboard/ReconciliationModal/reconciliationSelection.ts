import { Transaction } from '../../../types';

// Purchases left out of a reconciliation become its Pending Transactions,
// and the form's guide says "these may only be the most recent purchases".
// So including a purchase also includes every older one, and leaving one
// out also leaves out every newer one -- the selection can never break
// that rule. Purchases on the same date can be picked independently.
export const setIncluded = (
  purchases: Transaction[],
  selected: Set<string>,
  purchase: Transaction,
  include: boolean,
): Set<string> => {
  const date = purchase.date ?? '';
  const next = new Set(selected);
  for (const t of purchases) {
    const otherDate = t.date ?? '';
    const affected =
      t.id === purchase.id || (include ? otherDate < date : otherDate > date);
    if (!affected) continue;
    if (include) next.add(t.id);
    else next.delete(t.id);
  }
  return next;
};
