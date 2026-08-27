import { FinancialTask } from '../types';

export interface MonthGroup {
  monthKey: string; // YYYY-MM
  label: string; // e.g. "September 2026"
  tasks: FinancialTask[];
}

export const groupTasksByMonth = (tasks: FinancialTask[]): MonthGroup[] => {
  const byMonth = new Map<string, FinancialTask[]>();
  for (const task of tasks) {
    const monthKey = task.dueDate.slice(0, 7);
    const group = byMonth.get(monthKey);
    if (group) {
      group.push(task);
    } else {
      byMonth.set(monthKey, [task]);
    }
  }

  return [...byMonth.keys()].sort().map((monthKey) => {
    // Built from numeric parts (not `new Date(monthKey + '-01')`) -- a
    // date-only ISO string parses as UTC midnight, which can display as the
    // previous month once converted to a negative-UTC-offset local time.
    const [year, month] = monthKey.split('-').map(Number);
    return {
      monthKey,
      label: new Date(year, month - 1, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
      tasks: byMonth
        .get(monthKey)!
        .slice()
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    };
  });
};
