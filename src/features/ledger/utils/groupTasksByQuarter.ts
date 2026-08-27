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

// Academic quarters, not calendar quarters -- this app tracks student-org
// budget activity against Northwestern's own academic calendar, not Jan-Mar/
// Apr-Jun/etc. Jul-Aug (summer) has no quarter of its own here; it's bucketed
// with the upcoming Fall since that's when org activity actually resumes
// (RSO renewal, room booking, etc.), not a real season of its own for SOFO
// purposes. Each quarter is labeled by the calendar year its months fall in
// (e.g. "Fall Quarter 2026" = Jul-Dec 2026, followed by "Winter Quarter
// 2027" = Jan-Mar 2027) -- ordering this way means a plain `${year}-${order}`
// string sort is already chronologically correct with no cross-year
// juggling, since Winter/Spring/Fall of the same labeled year occur in that
// order within the year, and Fall of year Y always precedes Winter of Y+1.
const ACADEMIC_QUARTERS = ['Winter', 'Spring', 'Fall'] as const;

const academicQuarterOrderOf = (month: number) => {
  if (month <= 3) return 0; // Jan-Mar -> Winter
  if (month <= 6) return 1; // Apr-Jun -> Spring
  return 2; // Jul-Dec -> Fall
};

const quarterKeyOf = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return `${year}-${academicQuarterOrderOf(month)}`;
};

const quarterLabelOf = (quarterKey: string) => {
  const [year, order] = quarterKey.split('-');
  return `${ACADEMIC_QUARTERS[Number(order)]} Quarter ${year}`;
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
