import { describe, expect, test } from 'vitest';

import { buildMockOrganization, buildMockTransaction } from '../../../test/mocks';
import { calculateReconciliationFormData } from './debitCardReconciliationForm';

describe('calculateReconciliationFormData', () => {
  test('a simple first-ever reconciliation with no reimbursements, service fees, or prior history', () => {
    const purchase1 = buildMockTransaction({
      id: 't1',
      amount: 30,
      direction: 'Outflow',
    });
    const purchase2 = buildMockTransaction({
      id: 't2',
      amount: 20,
      direction: 'Outflow',
    });
    const org = buildMockOrganization({
      transactions: [purchase1, purchase2],
      debitCardSettings: { loadBalance: 100 },
      budgetAllocations: { ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 50 },
    });

    const data = calculateReconciliationFormData(org, ['t1', 't2'], 0);

    expect(data.authorizedCharges).toBe(50);
    expect(data.serviceFees).toBe(0);
    expect(data.totalReimbursed).toBe(0);
    expect(data.reconciliationSubtotal).toBe(50);
    expect(data.loadBalance).toBe(100);
    expect(data.balanceAsOf).toBe(50);
    expect(data.completedReconciliationsPendingReload).toBe(0);
    expect(data.pendingTransactions).toBe(0);
    // Load Balance (100) - Balance as of (50) - prior reconciliations (0) -
    // pending (0) = 50, matching authorizedCharges -- the form's own
    // consistency check (Total Expenditures should equal Reconciliation
    // Subtotal) holds here.
    expect(data.totalExpenditures).toBe(50);
    expect(data.reloadAmount).toBe(50);
  });

  test('includes service fees in the subtotal and reload amount', () => {
    const purchase = buildMockTransaction({ id: 't1', amount: 50, direction: 'Outflow' });
    const org = buildMockOrganization({ transactions: [purchase] });

    const data = calculateReconciliationFormData(org, ['t1'], 3);

    expect(data.serviceFees).toBe(3);
    expect(data.reconciliationSubtotal).toBe(53);
    expect(data.reloadAmount).toBe(53);
  });

  test('collects tax reimbursements from the selected transactions into an itemized list and total', () => {
    const taxed1 = buildMockTransaction({
      id: 't1',
      amount: 25,
      taxAmount: 2.5,
      date: '2026-03-01',
      title: 'Coffee Shop',
    });
    const taxed2 = buildMockTransaction({
      id: 't2',
      amount: 15,
      taxAmount: 1.1,
      date: '2026-03-02',
      title: 'Office Supplies',
    });
    const untaxed = buildMockTransaction({ id: 't3', amount: 10, taxAmount: 0 });
    const org = buildMockOrganization({ transactions: [taxed1, taxed2, untaxed] });

    const data = calculateReconciliationFormData(org, ['t1', 't2', 't3'], 0);

    expect(data.reimbursements).toEqual([
      { date: '2026-03-01', description: 'Coffee Shop', amount: 2.5 },
      { date: '2026-03-02', description: 'Office Supplies', amount: 1.1 },
    ]);
    expect(data.totalReimbursed).toBeCloseTo(3.6);
    expect(data.reconciliationSubtotal).toBeCloseTo(50 + 3.6);
  });

  test("excludes a prior round's already-reconciled purchases from authorizedCharges but counts them toward completedReconciliationsPendingReload", () => {
    const priorRound = buildMockTransaction({
      id: 'prior',
      amount: 40,
      reconciledAt: Date.now() - 1000,
    });
    const thisRound = buildMockTransaction({
      id: 'current',
      amount: 10,
      reconciledAt: null,
    });
    const org = buildMockOrganization({ transactions: [priorRound, thisRound] });

    const data = calculateReconciliationFormData(org, ['current'], 0);

    expect(data.authorizedCharges).toBe(10);
    expect(data.completedReconciliationsPendingReload).toBe(40);
  });

  test('a paid reload nets against prior completed reconciliations', () => {
    const priorRound = buildMockTransaction({
      id: 'prior',
      amount: 40,
      reconciledAt: Date.now() - 1000,
    });
    const paidReload = buildMockTransaction({
      id: 'reload-1',
      type: 'Journal',
      direction: 'Inflow',
      paymentStatus: 'Paid',
      amount: 40,
    });
    const thisRound = buildMockTransaction({
      id: 'current',
      amount: 10,
      reconciledAt: null,
    });
    const org = buildMockOrganization({
      transactions: [priorRound, paidReload, thisRound],
    });

    const data = calculateReconciliationFormData(org, ['current'], 0);

    expect(data.completedReconciliationsPendingReload).toBe(0);
    expect(data.reloadAmount).toBe(10);
  });

  // Regression guard: a pending (not yet Paid) reload must NOT reduce
  // completedReconciliationsPendingReload -- the card hasn't actually
  // received the money yet.
  test('a reload that has not reached Paid status does not reduce completedReconciliationsPendingReload', () => {
    const priorRound = buildMockTransaction({
      id: 'prior',
      amount: 40,
      reconciledAt: Date.now() - 1000,
    });
    const pendingReload = buildMockTransaction({
      id: 'reload-1',
      type: 'Journal',
      direction: 'Inflow',
      paymentStatus: 'Pending',
      amount: 40,
    });
    const org = buildMockOrganization({ transactions: [priorRound, pendingReload] });

    const data = calculateReconciliationFormData(org, [], 0);

    expect(data.completedReconciliationsPendingReload).toBe(40);
  });

  test('clamps completedReconciliationsPendingReload at 0 rather than going negative', () => {
    const paidReload = buildMockTransaction({
      id: 'reload-1',
      type: 'Journal',
      direction: 'Inflow',
      paymentStatus: 'Paid',
      amount: 40,
    });
    const org = buildMockOrganization({ transactions: [paidReload] });

    const data = calculateReconciliationFormData(org, [], 0);

    expect(data.completedReconciliationsPendingReload).toBe(0);
  });

  test('unreconciled purchases excluded from this batch count as pendingTransactions', () => {
    const inBatch = buildMockTransaction({ id: 't1', amount: 10, reconciledAt: null });
    const excluded = buildMockTransaction({ id: 't2', amount: 15, reconciledAt: null });
    const org = buildMockOrganization({ transactions: [inBatch, excluded] });

    const data = calculateReconciliationFormData(org, ['t1'], 0);

    expect(data.pendingTransactions).toBe(15);
  });

  test('a Journal reload transaction is never counted as a purchase in any total', () => {
    const reload = buildMockTransaction({
      id: 'reload-1',
      type: 'Journal',
      direction: 'Inflow',
      amount: 100,
      reconciledAt: null,
    });
    const org = buildMockOrganization({ transactions: [reload] });

    const data = calculateReconciliationFormData(org, [], 0);

    expect(data.pendingTransactions).toBe(0);
    expect(data.completedReconciliationsPendingReload).toBe(0);
  });

  test("pulls account info straight from the org's saved debit card settings", () => {
    const org = buildMockOrganization({
      name: 'Ballroom Latin and Swing Team',
      debitCardSettings: {
        accountNumber: '2000-000',
        lastFourDigits: '1234',
        inventoryControlNumber: '12345678-1234567',
        loadBalance: 500,
      },
    });

    const data = calculateReconciliationFormData(org, [], 0);

    expect(data.orgName).toBe('Ballroom Latin and Swing Team');
    expect(data.accountNumber).toBe('2000-000');
    expect(data.lastFourDigits).toBe('1234');
    expect(data.inventoryControlNumber).toBe('12345678-1234567');
    expect(data.loadBalance).toBe(500);
  });
});
