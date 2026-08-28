import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getTaskUrgency } from './taskUrgency';

// Boundary-precise, so pin "today" rather than relying on whatever day the
// suite happens to run on.
const TODAY = '2026-09-10';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getTaskUrgency', () => {
  test('returns "complete" whenever completedAt is set, regardless of due date', () => {
    expect(getTaskUrgency('2020-01-01', '2026-09-01T00:00:00Z')).toBe('complete');
    expect(getTaskUrgency('2099-01-01', '2026-09-01T00:00:00Z')).toBe('complete');
  });

  test('returns "overdue" for any incomplete past due date, including yesterday', () => {
    expect(getTaskUrgency('2020-01-01')).toBe('overdue');
    expect(getTaskUrgency('2026-09-09')).toBe('overdue');
  });

  test('returns "overdue" for today itself once it has passed, but "dueSoon" for today\'s own date', () => {
    // dueDate === today is NOT overdue (< comparison, not <=) -- it's the
    // most urgent "dueSoon" case instead.
    expect(getTaskUrgency(TODAY)).toBe('dueSoon');
  });

  test('returns "dueSoon" for 1-3 days out', () => {
    expect(getTaskUrgency('2026-09-11')).toBe('dueSoon');
    expect(getTaskUrgency('2026-09-13')).toBe('dueSoon');
  });

  test('returns "dueThisWeek" for 4-7 days out', () => {
    expect(getTaskUrgency('2026-09-14')).toBe('dueThisWeek');
    expect(getTaskUrgency('2026-09-17')).toBe('dueThisWeek');
  });

  test('returns "normal" for more than 7 days out', () => {
    expect(getTaskUrgency('2026-09-18')).toBe('normal');
    expect(getTaskUrgency('2099-01-01')).toBe('normal');
  });
});
