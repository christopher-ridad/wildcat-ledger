import { describe, expect, test } from 'vitest';

import { buildMockFinancialTask } from '../../../test/mocks';
import { assignTaskSides, groupTasksByQuarter } from './groupTasksByQuarter';

const TODAY = '2026-09-10';

describe('groupTasksByQuarter', () => {
  test('with no tasks, still produces a single quarter/month holding only the Today landmark', () => {
    const quarters = groupTasksByQuarter([], TODAY);
    expect(quarters).toHaveLength(1);
    expect(quarters[0].label).toBe('Q3 2026');
    expect(quarters[0].months).toHaveLength(1);
    expect(quarters[0].months[0].label).toBe('September');
    expect(quarters[0].months[0].entries).toEqual([{ isToday: true }]);
  });

  test('groups tasks by quarter and month, sorted chronologically regardless of input order', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 't-dec', dueDate: '2026-12-05' }),
        buildMockFinancialTask({ id: 't-jan', dueDate: '2027-01-10' }),
        buildMockFinancialTask({ id: 't-feb', dueDate: '2026-02-01' }),
      ],
      '2026-06-15', // today, in a gap quarter with no tasks
    );

    const quarterKeys = quarters.map((q) => q.label);
    expect(quarterKeys).toEqual(['Q1 2026', 'Q2 2026', 'Q4 2026', 'Q1 2027']);

    expect(quarters[0].months[0].label).toBe('February');
    expect(quarters[0].months[0].entries[0].task?.id).toBe('t-feb');

    expect(quarters[3].months[0].label).toBe('January');
    expect(quarters[3].months[0].entries[0].task?.id).toBe('t-jan');
  });

  test('omits empty months/quarters between populated ones, except one holding the Today landmark', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 't1', dueDate: '2026-01-15' }),
        buildMockFinancialTask({ id: 't2', dueDate: '2026-11-01' }),
      ],
      TODAY, // September -- a gap month between January and November
    );

    const allMonthLabels = quarters.flatMap((q) => q.months.map((m) => m.label));
    expect(allMonthLabels).toEqual(['January', 'September', 'November']);

    const septMonth = quarters.find((q) => q.label === 'Q3 2026')!.months[0];
    expect(septMonth.entries).toEqual([{ isToday: true }]);
  });

  test("inserts the Today landmark in correct chronological order among that month's tasks", () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 'before', dueDate: '2026-09-05' }),
        buildMockFinancialTask({ id: 'after', dueDate: '2026-09-20' }),
      ],
      TODAY, // 2026-09-10, between the two
    );
    const entries = quarters[0].months[0].entries;
    expect(entries.map((e) => e.task?.id ?? 'today')).toEqual([
      'before',
      'today',
      'after',
    ]);
  });

  test('tasks sharing a due date are ordered by id as a stable tie-break', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 'b', dueDate: '2026-09-05' }),
        buildMockFinancialTask({ id: 'a', dueDate: '2026-09-05' }),
      ],
      TODAY,
    );
    const taskEntries = quarters[0].months[0].entries.filter((e) => e.task);
    expect(taskEntries.map((e) => e.task?.id)).toEqual(['a', 'b']);
  });

  test('assignTaskSides alternates left/right by a single running index across quarter/month boundaries', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 't1', dueDate: '2026-01-05' }), // Q1, odd count in month
        buildMockFinancialTask({ id: 't2', dueDate: '2026-01-06' }),
        buildMockFinancialTask({ id: 't3', dueDate: '2026-01-07' }),
        buildMockFinancialTask({ id: 't4', dueDate: '2026-04-01' }), // Q2 -- would flip if reset per quarter
      ],
      '2099-01-01', // today far away, doesn't land in either populated month
    );
    const sides = assignTaskSides(quarters);
    expect(sides.get('t1')).toBe('left');
    expect(sides.get('t2')).toBe('right');
    expect(sides.get('t3')).toBe('left');
    expect(sides.get('t4')).toBe('right'); // continues the running count, not reset at the quarter seam
  });

  test('a year boundary does not merge Q4 of one year with Q1 of the next', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 't-dec', dueDate: '2025-12-01' }),
        buildMockFinancialTask({ id: 't-jan', dueDate: '2026-01-01' }),
      ],
      TODAY,
    );
    const labels = quarters.map((q) => q.label);
    expect(labels).toContain('Q4 2025');
    expect(labels).toContain('Q1 2026');
    expect(labels.indexOf('Q4 2025')).toBeLessThan(labels.indexOf('Q1 2026'));
  });
});
