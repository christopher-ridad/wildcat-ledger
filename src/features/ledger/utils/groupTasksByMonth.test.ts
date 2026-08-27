import { describe, expect, test } from 'vitest';

import { buildMockFinancialTask } from '../../../test/mocks';
import { groupTasksByMonth } from './groupTasksByMonth';

describe('groupTasksByMonth', () => {
  test('returns an empty array for no tasks', () => {
    expect(groupTasksByMonth([])).toEqual([]);
  });

  test('buckets tasks by their due month', () => {
    const groups = groupTasksByMonth([
      buildMockFinancialTask({ id: 't1', dueDate: '2026-09-05' }),
      buildMockFinancialTask({ id: 't2', dueDate: '2026-10-01' }),
      buildMockFinancialTask({ id: 't3', dueDate: '2026-09-20' }),
    ]);

    expect(groups.map((g) => g.monthKey)).toEqual(['2026-09', '2026-10']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['t1', 't3']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['t2']);
  });

  test('sorts months chronologically regardless of input order', () => {
    const groups = groupTasksByMonth([
      buildMockFinancialTask({ id: 't1', dueDate: '2027-01-01' }),
      buildMockFinancialTask({ id: 't2', dueDate: '2026-09-01' }),
      buildMockFinancialTask({ id: 't3', dueDate: '2026-12-01' }),
    ]);

    expect(groups.map((g) => g.monthKey)).toEqual(['2026-09', '2026-12', '2027-01']);
  });

  test('sorts tasks within a month by due date ascending', () => {
    const groups = groupTasksByMonth([
      buildMockFinancialTask({ id: 't1', dueDate: '2026-09-20' }),
      buildMockFinancialTask({ id: 't2', dueDate: '2026-09-05' }),
    ]);

    expect(groups[0].tasks.map((t) => t.id)).toEqual(['t2', 't1']);
  });

  test('formats the month label as a full month name and year', () => {
    const groups = groupTasksByMonth([buildMockFinancialTask({ dueDate: '2026-09-05' })]);
    expect(groups[0].label).toBe('September 2026');
  });
});
