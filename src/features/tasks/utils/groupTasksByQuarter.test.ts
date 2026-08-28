import { describe, expect, test } from 'vitest';

import { buildMockFinancialTask } from '../../../test/mocks';
import {
  academicYearLabel,
  currentAcademicYearLabel,
  currentQuarterKey,
  groupTasksByQuarter,
  isDateInSupportedQuarter,
} from './groupTasksByQuarter';

const TODAY = '2026-09-10'; // September -> Fall Quarter 2026, academic year 2026-2027

describe('groupTasksByQuarter', () => {
  test('always scaffolds exactly Fall/Winter/Spring for the current academic year, even with no tasks', () => {
    const quarters = groupTasksByQuarter([], TODAY);
    expect(quarters.map((q) => q.label)).toEqual([
      'Fall Quarter 2026',
      'Winter Quarter 2027',
      'Spring Quarter 2027',
    ]);
    expect(quarters[0].months).toEqual([]);
    expect(quarters[1].months).toEqual([]);
    expect(quarters[2].months).toEqual([]);
  });

  test('quarters stay in chronological order even when only one has tasks', () => {
    const quarters = groupTasksByQuarter(
      [buildMockFinancialTask({ id: 't1', dueDate: '2027-02-01' })], // Winter 2027
      TODAY,
    );
    expect(quarters.map((q) => q.label)).toEqual([
      'Fall Quarter 2026',
      'Winter Quarter 2027',
      'Spring Quarter 2027',
    ]);
    expect(quarters[0].months).toEqual([]);
    expect(quarters[1].months.map((m) => m.label)).toEqual(['February']);
    expect(quarters[1].months[0].tasks[0].id).toBe('t1');
    expect(quarters[2].months).toEqual([]);
  });

  test('always returns exactly 3 quarters, excluding tasks due in a different academic year', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 'past', dueDate: '2024-10-15' }), // academic year 2024-2025
        buildMockFinancialTask({ id: 'future', dueDate: '2028-10-15' }), // academic year 2028-2029
        buildMockFinancialTask({ id: 'this-year', dueDate: '2026-11-01' }), // academic year 2026-2027
      ],
      TODAY, // academic year 2026-2027
    );
    expect(quarters).toHaveLength(3);
    expect(quarters.map((q) => q.label)).toEqual([
      'Fall Quarter 2026',
      'Winter Quarter 2027',
      'Spring Quarter 2027',
    ]);
    const allTaskIds = quarters
      .flatMap((q) => q.months)
      .flatMap((m) => m.tasks)
      .map((t) => t.id);
    expect(allTaskIds).toEqual(['this-year']);
  });

  test('groups tasks by month within the correct quarter, sorted chronologically regardless of input order', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 't-dec', dueDate: '2026-12-05' }), // Fall 2026
        buildMockFinancialTask({ id: 't-sep', dueDate: '2026-09-20' }), // Fall 2026
        buildMockFinancialTask({ id: 't-mar', dueDate: '2027-03-10' }), // Winter 2027
        buildMockFinancialTask({ id: 't-may', dueDate: '2027-05-01' }), // Spring 2027
      ],
      TODAY,
    );
    const fall = quarters.find((q) => q.label === 'Fall Quarter 2026')!;
    const winter = quarters.find((q) => q.label === 'Winter Quarter 2027')!;
    const spring = quarters.find((q) => q.label === 'Spring Quarter 2027')!;

    expect(fall.months.map((m) => m.label)).toEqual(['September', 'December']);
    expect(winter.months.map((m) => m.label)).toEqual(['March']);
    expect(spring.months.map((m) => m.label)).toEqual(['May']);
  });

  test('restricts Fall to September-December, excluding July/August entirely', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 't-jul', dueDate: '2026-07-10' }),
        buildMockFinancialTask({ id: 't-aug', dueDate: '2026-08-15' }),
        buildMockFinancialTask({ id: 't-sep', dueDate: '2026-09-01' }),
      ],
      TODAY,
    );
    const fallQuarter = quarters.find((q) => q.label === 'Fall Quarter 2026')!;
    expect(fallQuarter.months.map((m) => m.label)).toEqual(['September']);
    const allTaskIds = quarters
      .flatMap((q) => q.months)
      .flatMap((m) => m.tasks.map((t) => t.id));
    expect(allTaskIds).toEqual(['t-sep']);
  });

  test('restricts Winter to January-March and Spring to April-June', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 't-jan', dueDate: '2027-01-05' }),
        buildMockFinancialTask({ id: 't-mar', dueDate: '2027-03-31' }),
        buildMockFinancialTask({ id: 't-apr', dueDate: '2027-04-01' }),
        buildMockFinancialTask({ id: 't-jun', dueDate: '2027-06-30' }),
      ],
      TODAY,
    );
    const winter = quarters.find((q) => q.label === 'Winter Quarter 2027')!;
    const spring = quarters.find((q) => q.label === 'Spring Quarter 2027')!;
    expect(winter.months.map((m) => m.label)).toEqual(['January', 'March']);
    expect(spring.months.map((m) => m.label)).toEqual(['April', 'June']);
  });

  test('tasks sharing a due date are ordered by id as a stable tie-break', () => {
    const quarters = groupTasksByQuarter(
      [
        buildMockFinancialTask({ id: 'b', dueDate: '2026-09-05' }),
        buildMockFinancialTask({ id: 'a', dueDate: '2026-09-05' }),
      ],
      TODAY,
    );
    const septMonth = quarters[0].months.find((m) => m.label === 'September')!;
    expect(septMonth.tasks.map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('academicYearLabel formats as a hyphenated range', () => {
    expect(academicYearLabel(2026)).toBe('2026-2027');
  });

  test('currentAcademicYearLabel derives the academic year containing the given date', () => {
    expect(currentAcademicYearLabel('2026-09-10')).toBe('2026-2027'); // Fall -> starts this year
    expect(currentAcademicYearLabel('2027-02-01')).toBe('2026-2027'); // Winter -> still 2026-2027
    expect(currentAcademicYearLabel('2027-06-30')).toBe('2026-2027'); // Spring -> still 2026-2027
    expect(currentAcademicYearLabel('2027-07-01')).toBe('2027-2028'); // next Fall -> new academic year
  });

  test('currentQuarterKey matches the key of the quarter actually containing that date', () => {
    const quarters = groupTasksByQuarter([], TODAY);
    const key = currentQuarterKey(TODAY);
    const matching = quarters.find((q) => q.key === key)!;
    expect(matching.label).toBe('Fall Quarter 2026');

    expect(currentQuarterKey('2027-02-01')).toBe(
      groupTasksByQuarter([], '2027-02-01').find(
        (q) => q.label === 'Winter Quarter 2027',
      )!.key,
    );
  });

  test('currentQuarterKey defaults July/August to the upcoming Fall quarter', () => {
    const quarters = groupTasksByQuarter([], '2026-08-15');
    const key = currentQuarterKey('2026-08-15');
    expect(quarters.find((q) => q.key === key)!.label).toBe('Fall Quarter 2026');
  });

  test('isDateInSupportedQuarter is false for July/August, and for the partial weeks outside term at both ends', () => {
    // Before Fall actually starts (still nominally September).
    expect(isDateInSupportedQuarter('2026-09-01')).toBe(false);
    expect(isDateInSupportedQuarter('2026-09-22')).toBe(false);
    expect(isDateInSupportedQuarter('2026-09-23')).toBe(true); // Fall starts here
    expect(isDateInSupportedQuarter('2026-09-30')).toBe(true);
    // Full months in between are entirely in range.
    expect(isDateInSupportedQuarter('2026-12-31')).toBe(true);
    expect(isDateInSupportedQuarter('2027-01-01')).toBe(true);
    expect(isDateInSupportedQuarter('2027-03-31')).toBe(true);
    expect(isDateInSupportedQuarter('2027-04-01')).toBe(true);
    // After Spring actually ends (still nominally June).
    expect(isDateInSupportedQuarter('2027-06-11')).toBe(true); // Spring ends here
    expect(isDateInSupportedQuarter('2027-06-12')).toBe(false);
    expect(isDateInSupportedQuarter('2027-06-30')).toBe(false);
    // No quarter of their own at all.
    expect(isDateInSupportedQuarter('2026-07-01')).toBe(false);
    expect(isDateInSupportedQuarter('2026-08-31')).toBe(false);
  });
});
