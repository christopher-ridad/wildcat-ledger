import { FinancialTask } from '../types';

export interface MonthEntry {
  task?: FinancialTask;
  isToday?: boolean;
}

export interface MonthGroup {
  key: string; // 'YYYY-MM'
  label: string; // 'January'
  entries: MonthEntry[]; // chronological
}

export interface QuarterGroup {
  key: string; // 'YYYY-Q1'
  label: string; // 'Q1 2026'
  months: MonthGroup[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const monthKeyOf = (dateStr: string) => dateStr.slice(0, 7);

const quarterKeyOf = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `${year}-Q${quarter}`;
};

const quarterLabelOf = (quarterKey: string) => {
  const [year, quarter] = quarterKey.split('-Q');
  return `Q${quarter} ${year}`;
};

const monthLabelOf = (monthKey: string) => {
  const month = Number(monthKey.slice(5, 7));
  return MONTH_NAMES[month - 1];
};

export const groupTasksByQuarter = (
  tasks: FinancialTask[],
  todayStr: string,
): QuarterGroup[] => {
  const monthsByKey = new Map<string, MonthGroup>();

  const getOrCreateMonth = (monthKey: string) => {
    let month = monthsByKey.get(monthKey);
    if (!month) {
      month = { key: monthKey, label: monthLabelOf(monthKey), entries: [] };
      monthsByKey.set(monthKey, month);
    }
    return month;
  };

  const sortedTasks = [...tasks].sort((a, b) =>
    a.dueDate === b.dueDate
      ? a.id.localeCompare(b.id)
      : a.dueDate.localeCompare(b.dueDate),
  );

  for (const task of sortedTasks) {
    getOrCreateMonth(monthKeyOf(task.dueDate)).entries.push({ task });
  }

  // Today always gets a landmark, even in an otherwise-empty month -- the
  // one exception to "skip empty months between populated ones."
  const todayMonth = getOrCreateMonth(monthKeyOf(todayStr));
  const todayEntryIndex = todayMonth.entries.findIndex(
    (entry) => (entry.task?.dueDate ?? '') >= todayStr,
  );
  const insertAt = todayEntryIndex === -1 ? todayMonth.entries.length : todayEntryIndex;
  todayMonth.entries.splice(insertAt, 0, { isToday: true });

  const quartersByKey = new Map<string, QuarterGroup>();
  const sortedMonthKeys = [...monthsByKey.keys()].sort();
  for (const monthKey of sortedMonthKeys) {
    const qKey = quarterKeyOf(monthKey);
    let quarter = quartersByKey.get(qKey);
    if (!quarter) {
      quarter = { key: qKey, label: quarterLabelOf(qKey), months: [] };
      quartersByKey.set(qKey, quarter);
    }
    quarter.months.push(monthsByKey.get(monthKey)!);
  }

  return [...quartersByKey.keys()].sort().map((key) => quartersByKey.get(key)!);
};

export type TaskSide = 'left' | 'right';

// One running index across the *whole* flattened, chronological task list
// (not reset per month/quarter) so the left/right rhythm never desyncs at a
// month or quarter boundary. Today landmarks don't consume a side.
export const assignTaskSides = (quarters: QuarterGroup[]): Map<string, TaskSide> => {
  const sides = new Map<string, TaskSide>();
  let index = 0;
  for (const quarter of quarters) {
    for (const month of quarter.months) {
      for (const entry of month.entries) {
        if (!entry.task) continue;
        sides.set(entry.task.id, index % 2 === 0 ? 'left' : 'right');
        index += 1;
      }
    }
  }
  return sides;
};
