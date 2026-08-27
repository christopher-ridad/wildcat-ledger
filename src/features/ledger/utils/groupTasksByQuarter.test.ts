import { describe, expect, test } from 'vitest';

import { buildMockFinancialTask } from '../../../test/mocks';
import { assignTaskSides, groupTasksByQuarter } from './groupTasksByQuarter';

const TODAY = '2026-09-10'; // September -> Fall Quarter 2026

describe('groupTasksByQuarter', () => {
  test('with no tasks, still produces a single quarter/month holding only the Today landmark', () => {
    const quarters = groupTasksByQuarter([], TODAY);
    expect(quarters).toHaveLength(1);
    expect(quarters[0].label).toBe('Fall Quarter 2026');
    expect(quarters[0].months).toHaveLength(1);
    expect(quarters[0].months[0].label).toBe('September');
    expect(quarters[0].months[0].entries).toEqual([{ isToday: true }]);
  });

  test('groups tasks by academic quarter and month, sorted chronologically regardless of input order', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 't-dec', dueDate: '2026-12-05' }), // Fall 2026
        buildMockFinancialTask({ id: 't-jan', dueDate: '2027-01-10' }), // Winter 2027
        buildMockFinancialTask({ id: 't-feb', dueDate: '2026-02-01' }), // Winter 2026
      ],
      '2026-06-15', // today, June -> Spring 2026, a gap quarter with no tasks
    );

    const quarterLabels = quarters.map((q) => q.label);
    expect(quarterLabels).toEqual([
      'Winter Quarter 2026',
      'Spring Quarter 2026',
      'Fall Quarter 2026',
      'Winter Quarter 2027',
    ]);

    expect(quarters[0].months[0].label).toBe('February');
    expect(quarters[0].months[0].entries[0].task?.id).toBe('t-feb');

    expect(quarters[3].months[0].label).toBe('January');
    expect(quarters[3].months[0].entries[0].task?.id).toBe('t-jan');
  });

  test('omits empty months/quarters between populated ones, except one holding the Today landmark', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 't1', dueDate: '2026-01-15' }), // Winter 2026
        buildMockFinancialTask({ id: 't2', dueDate: '2026-11-01' }), // Fall 2026
      ],
      '2026-05-10', // today, May -> Spring 2026, a genuine gap quarter
    );

    const quarterLabels = quarters.map((q) => q.label);
    expect(quarterLabels).toEqual([
      'Winter Quarter 2026',
      'Spring Quarter 2026',
      'Fall Quarter 2026',
    ]);

    const allMonthLabels = quarters.flatMap((q) => q.months.map((m) => m.label));
    expect(allMonthLabels).toEqual(['January', 'May', 'November']);

    const mayMonth = quarters.find((q) => q.label === 'Spring Quarter 2026')!.months[0];
    expect(mayMonth.entries).toEqual([{ isToday: true }]);
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
        buildMockFinancialTask({ id: 't1', dueDate: '2026-01-05' }), // Winter, odd count in month
        buildMockFinancialTask({ id: 't2', dueDate: '2026-01-06' }),
        buildMockFinancialTask({ id: 't3', dueDate: '2026-01-07' }),
        buildMockFinancialTask({ id: 't4', dueDate: '2026-04-01' }), // Spring -- would flip if reset per quarter
      ],
      '2099-01-01', // today far away, doesn't land in either populated month
    );
    const sides = assignTaskSides(quarters);
    expect(sides.get('t1')).toBe('left');
    expect(sides.get('t2')).toBe('right');
    expect(sides.get('t3')).toBe('left');
    expect(sides.get('t4')).toBe('right'); // continues the running count, not reset at the quarter seam
  });

  test('Jul-Aug (summer) is bucketed with the upcoming Fall quarter, not left as its own', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 't-jul', dueDate: '2026-07-10' }),
        buildMockFinancialTask({ id: 't-aug', dueDate: '2026-08-15' }),
        buildMockFinancialTask({ id: 't-sep', dueDate: '2026-09-01' }),
      ],
      '2099-01-01', // today, far away -- lands in its own separate Winter Quarter 2099
    );
    const fallQuarter = quarters.find((q) => q.label === 'Fall Quarter 2026')!;
    expect(fallQuarter.months.map((m) => m.label)).toEqual([
      'July',
      'August',
      'September',
    ]);
  });

  test('a year boundary does not merge Fall Quarter of one year with Winter Quarter of the next', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 't-dec', dueDate: '2025-12-01' }),
        buildMockFinancialTask({ id: 't-jan', dueDate: '2026-01-01' }),
      ],
      TODAY,
    );
    const labels = quarters.map((q) => q.label);
    expect(labels).toContain('Fall Quarter 2025');
    expect(labels).toContain('Winter Quarter 2026');
    expect(labels.indexOf('Fall Quarter 2025')).toBeLessThan(
      labels.indexOf('Winter Quarter 2026'),
    );
  });
});
