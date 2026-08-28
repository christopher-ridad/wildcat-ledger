import { todayDateString } from './today';

export type TaskUrgency = 'complete' | 'overdue' | 'dueSoon' | 'dueThisWeek' | 'normal';

// Both dates are YYYY-MM-DD with no time component, so parsing as UTC on
// both sides cancels out any timezone offset -- only the calendar-day gap
// matters here.
const daysBetween = (fromDate: string, toDate: string) =>
  Math.round(
    (new Date(`${toDate}T00:00:00Z`).getTime() -
      new Date(`${fromDate}T00:00:00Z`).getTime()) /
      86_400_000,
  );

export const getTaskUrgency = (
  dueDate: string,
  completedAt?: string | null,
): TaskUrgency => {
  if (completedAt) return 'complete';
  const today = todayDateString();
  if (dueDate < today) return 'overdue';
  const daysUntilDue = daysBetween(today, dueDate);
  if (daysUntilDue <= 3) return 'dueSoon';
  if (daysUntilDue <= 7) return 'dueThisWeek';
  return 'normal';
};
