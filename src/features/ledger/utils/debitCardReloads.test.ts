import { describe, expect, test } from 'vitest';

import { buildMockTransaction } from '../../../test/mocks';
import { getSupersededReloadIds, reloadedThrough } from './debitCardReloads';

const reload = (overrides: Parameters<typeof buildMockTransaction>[0]) =>
  buildMockTransaction({
    type: 'Journal',
    direction: 'Inflow',
    budgetLine: 'Debit Card',
    ...overrides,
  });

describe('getSupersededReloadIds', () => {
  test('an older unpaid request is superseded once a newer one exists', () => {
    const older = reload({ id: 'old', paymentStatus: 'Pending', reloadRequestedAt: 1 });
    const newer = reload({ id: 'new', paymentStatus: 'Pending', reloadRequestedAt: 2 });
    expect(getSupersededReloadIds([older, newer])).toEqual(new Set(['old']));
  });

  test('an older request that was already Paid is not superseded', () => {
    const older = reload({ id: 'old', paymentStatus: 'Paid', reloadRequestedAt: 1 });
    const newer = reload({ id: 'new', paymentStatus: 'Pending', reloadRequestedAt: 2 });
    expect(getSupersededReloadIds([older, newer])).toEqual(new Set());
  });

  test('the most recent request is never superseded', () => {
    const only = reload({ id: 'only', paymentStatus: 'Pending', reloadRequestedAt: 1 });
    expect(getSupersededReloadIds([only])).toEqual(new Set());
  });

  test('ignores Journals on other budget lines', () => {
    const older = reload({ id: 'old', paymentStatus: 'Pending', reloadRequestedAt: 1 });
    const asgJournal = buildMockTransaction({
      id: 'asg',
      type: 'Journal',
      budgetLine: 'ASG',
      reloadRequestedAt: 2,
    });
    expect(getSupersededReloadIds([older, asgJournal])).toEqual(new Set());
  });
});

describe('reloadedThrough', () => {
  test('is when the most recent Paid reload was requested', () => {
    const paid = reload({ id: 'r1', paymentStatus: 'Paid', reloadRequestedAt: 5 });
    const pending = reload({ id: 'r2', paymentStatus: 'Pending', reloadRequestedAt: 9 });
    expect(reloadedThrough([paid, pending])).toBe(5);
  });

  test('is 0 when nothing has been reloaded', () => {
    expect(reloadedThrough([])).toBe(0);
  });
});
