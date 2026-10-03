import { describe, expect, test, vi } from 'vitest';

import { buildMockOrganization, buildMockTransaction } from '../../../test/mocks';
import { Transaction } from '../types';
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

  test('collects reimbursed tax from the selected transactions into an itemized list and total', () => {
    const taxed1 = buildMockTransaction({
      id: 't1',
      amount: 25,
      taxAmount: 2.5,
      taxReimbursed: true,
      date: '2026-03-01',
      title: 'Coffee Shop',
    });
    const taxed2 = buildMockTransaction({
      id: 't2',
      amount: 15,
      taxAmount: 1.1,
      taxReimbursed: true,
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
    // Tax comes out of the authorized charges and back in as reimbursements,
    // so the subtotal is just what was charged to the card.
    expect(data.authorizedCharges).toBeCloseTo(50 - 3.6);
    expect(data.reconciliationSubtotal).toBeCloseTo(50);
  });

  test('splits a taxed purchase into its authorized part and the reimbursed tax, so the totals match', () => {
    // $20 charged, $5 of it tax, paid back to SOFO.
    const purchase = buildMockTransaction({
      id: 't1',
      amount: 20,
      taxAmount: 5,
      taxReimbursed: true,
    });
    const org = buildMockOrganization({
      transactions: [purchase],
      debitCardSettings: { loadBalance: 100 },
      budgetAllocations: { ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 80 },
    });

    const data = calculateReconciliationFormData(org, ['t1'], 0);

    expect(data.authorizedCharges).toBe(15);
    expect(data.totalReimbursed).toBe(5);
    expect(data.reconciliationSubtotal).toBe(20);
    expect(data.totalExpenditures).toBe(20);
  });

  test('tax not yet marked reimbursed stays out of both authorized charges and reimbursements', () => {
    const purchase = buildMockTransaction({
      id: 't1',
      amount: 20,
      taxAmount: 5,
      taxReimbursed: false,
    });
    const org = buildMockOrganization({ transactions: [purchase] });

    const data = calculateReconciliationFormData(org, ['t1'], 0);

    expect(data.authorizedCharges).toBe(15);
    expect(data.reimbursements).toEqual([]);
    expect(data.totalReimbursed).toBe(0);
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

  describe('completed reconciliations pending reload', () => {
    // Round A was reconciled on day 1, round B on day 3.
    const DAY = 24 * 60 * 60 * 1000;
    const roundA = buildMockTransaction({ id: 'a', amount: 150, reconciledAt: 1 * DAY });
    const roundB = buildMockTransaction({ id: 'b', amount: 40, reconciledAt: 3 * DAY });
    const thisRound = buildMockTransaction({
      id: 'current',
      amount: 10,
      reconciledAt: null,
    });
    const reload = (overrides: Parameters<typeof buildMockTransaction>[0]) =>
      buildMockTransaction({ type: 'Journal', direction: 'Inflow', ...overrides });

    const pendingReloadFor = (...transactions: Transaction[]) =>
      calculateReconciliationFormData(
        buildMockOrganization({ transactions: [...transactions, thisRound] }),
        ['current'],
        0,
      ).completedReconciliationsPendingReload;

    test('counts every prior round in full when nothing has been reloaded', () => {
      expect(pendingReloadFor(roundA, roundB)).toBe(190);
    });

    test('a Paid reload covers every round reconciled before it was requested', () => {
      const paid = reload({
        id: 'r1',
        paymentStatus: 'Paid',
        reloadRequestedAt: 2 * DAY,
      });
      expect(pendingReloadFor(roundA, roundB, paid)).toBe(40);
    });

    test('a round is reloaded in full or not at all, whatever the reload amount', () => {
      const paid = reload({
        id: 'r1',
        amount: 100,
        paymentStatus: 'Paid',
        reloadRequestedAt: 2 * DAY,
      });
      expect(pendingReloadFor(roundA, paid)).toBe(0);
    });

    test('a reload that is still Pending covers nothing yet', () => {
      const pending = reload({
        id: 'r1',
        paymentStatus: 'Pending',
        reloadRequestedAt: 4 * DAY,
      });
      expect(pendingReloadFor(roundA, roundB, pending)).toBe(190);
    });

    test('only the most recent Paid reload matters', () => {
      const older = reload({
        id: 'r1',
        paymentStatus: 'Paid',
        reloadRequestedAt: 2 * DAY,
      });
      const newer = reload({
        id: 'r2',
        paymentStatus: 'Paid',
        reloadRequestedAt: 4 * DAY,
      });
      expect(pendingReloadFor(roundA, roundB, older, newer)).toBe(0);
    });
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

  test('uses the most recent earlier reconciliation as the date of last reconciliation', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 'old',
          reconciledAt: Date.parse('2026-08-01T12:00:00'),
        }),
        buildMockTransaction({
          id: 'recent',
          reconciledAt: Date.parse('2026-09-01T12:00:00'),
        }),
        // This round, already reconciled by the time the form is generated.
        buildMockTransaction({
          id: 'current',
          reconciledAt: Date.parse('2026-10-03T12:00:00'),
        }),
      ],
    });

    const data = calculateReconciliationFormData(org, ['current'], 0);

    expect(data.lastReconciliationDate).toBe('2026-09-01');
  });

  test('has no date of last reconciliation the first time', () => {
    const org = buildMockOrganization({
      transactions: [buildMockTransaction({ id: 'current', reconciledAt: null })],
    });
    expect(
      calculateReconciliationFormData(org, ['current'], 0).lastReconciliationDate,
    ).toBe(undefined);
  });

  test("dates the balance as of today, in the viewer's own timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T22:30:00'));
    const org = buildMockOrganization({ transactions: [] });
    expect(calculateReconciliationFormData(org, [], 0).balanceAsOfDate).toBe(
      '2026-10-03',
    );
    vi.useRealTimers();
  });
});
