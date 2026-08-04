import { describe, expect, test } from 'vitest';

import { buildMockTransaction } from '../../../test/mocks';
import {
  applyFilters,
  calculateBudgetLineSummaries,
  formatCurrency,
} from './calculations';

describe('formatCurrency', () => {
  test('formats a positive amount as USD', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  test('formats a negative amount', () => {
    expect(formatCurrency(-42)).toBe('-$42.00');
  });

  test('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

describe('applyFilters', () => {
  const txns = [
    buildMockTransaction({ id: 't1', budgetLine: 'ASG', date: '2026-01-01' }),
    buildMockTransaction({ id: 't2', budgetLine: 'Operating', date: '2026-03-01' }),
    buildMockTransaction({ id: 't3', budgetLine: 'ASG', date: '2026-02-01' }),
  ];

  test('returns all transactions sorted by date descending when no line is selected', () => {
    expect(applyFilters(txns, null).map((t) => t.id)).toEqual(['t2', 't3', 't1']);
  });

  test('filters to only the selected budget line', () => {
    expect(applyFilters(txns, 'ASG').map((t) => t.id)).toEqual(['t3', 't1']);
  });

  test('returns an empty array when no transactions match the selected line', () => {
    expect(applyFilters(txns, 'Gifts')).toEqual([]);
  });

  test('does not mutate the input array', () => {
    const copy = [...txns];
    applyFilters(txns, null);
    expect(txns).toEqual(copy);
  });
});

describe('calculateBudgetLineSummaries', () => {
  test('sums inflow and outflow per budget line and carries the allocation as balance', () => {
    const txns = [
      buildMockTransaction({ budgetLine: 'ASG', direction: 'Inflow', amount: 100 }),
      buildMockTransaction({ budgetLine: 'ASG', direction: 'Outflow', amount: 30 }),
      buildMockTransaction({ budgetLine: 'Operating', direction: 'Outflow', amount: 10 }),
    ];
    const allocations = { ASG: 500, Operating: 200, Gifts: 0, 'Debit Card': 0 };

    const summaries = calculateBudgetLineSummaries(txns, allocations);

    expect(summaries).toEqual([
      { line: 'ASG', balance: 500, inflow: 100, outflow: 30 },
      { line: 'Operating', balance: 200, inflow: 0, outflow: 10 },
      { line: 'Gifts', balance: 0, inflow: 0, outflow: 0 },
      { line: 'Debit Card', balance: 0, inflow: 0, outflow: 0 },
    ]);
  });

  test('returns zeroed summaries for every budget line when there are no transactions', () => {
    const allocations = { ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 0 };
    const summaries = calculateBudgetLineSummaries([], allocations);
    expect(summaries).toHaveLength(4);
    expect(summaries.every((s) => s.inflow === 0 && s.outflow === 0)).toBe(true);
  });
});
