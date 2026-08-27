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
  key: string; // '<academicYearStart>-<order>', order: Fall=0, Winter=1, Spring=2
  label: string; // 'Fall Quarter 2026'
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
// budget activity against Northwestern's own academic calendar. Jul-Aug
// (summer) has no quarter of its own here; it's bucketed with the upcoming
// Fall since that's when org activity actually resumes (RSO renewal, room
// booking, etc.), not a real season of its own for SOFO purposes.
//
// An "academic year" starting in year Y runs Fall(Y) -> Winter(Y+1) ->
// Spring(Y+1), labeled "Y-(Y+1)" (e.g. "2026-2027"). Quarter keys are
// `${academicYearStart}-${order}` (order: Fall=0, Winter=1, Spring=2) so a
// plain string/numeric sort is already chronologically correct with no
// cross-year juggling.
const ACADEMIC_QUARTERS = ['Fall', 'Winter', 'Spring'] as const;

export const academicYearStartOf = (year: number, month: number) =>
  month >= 7 ? year : year - 1;

const academicQuarterOrderOf = (month: number) => {
  if (month >= 7) return 0; // Jul-Dec -> Fall
  if (month <= 3) return 1; // Jan-Mar -> Winter
  return 2; // Apr-Jun -> Spring
};

const quarterKeyOf = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return `${academicYearStartOf(year, month)}-${academicQuarterOrderOf(month)}`;
};

const quarterLabelOf = (quarterKey: string) => {
  const [startStr, orderStr] = quarterKey.split('-');
  const academicYearStart = Number(startStr);
  const order = Number(orderStr);
  // Fall's months fall in the academic year's start year; Winter/Spring's
  // months fall in the following calendar year.
  const calendarYear = order === 0 ? academicYearStart : academicYearStart + 1;
  return `${ACADEMIC_QUARTERS[order]} Quarter ${calendarYear}`;
};

const monthLabelOf = (monthKey: string) => {
  const month = Number(monthKey.slice(5, 7));
  return MONTH_NAMES[month - 1];
};

export const academicYearLabel = (academicYearStart: number) =>
  `${academicYearStart}–${academicYearStart + 1}`;

export const currentAcademicYearLabel = (todayStr: string) => {
  const [year, month] = todayStr.split('-').map(Number);
  return academicYearLabel(academicYearStartOf(year, month));
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

  // Today always gets a landmark, even in an otherwise-empty month.
  const todayMonth = getOrCreateMonth(monthKeyOf(todayStr));
  const todayEntryIndex = todayMonth.entries.findIndex(
    (entry) => (entry.task?.dueDate ?? '') >= todayStr,
  );
  const insertAt = todayEntryIndex === -1 ? todayMonth.entries.length : todayEntryIndex;
  todayMonth.entries.splice(insertAt, 0, { isToday: true });

  // Quarters are the fixed structure of an academic year, not something
  // that only appears when task data exists -- scaffold Fall/Winter/Spring
  // for every academic year touched by either a task or "today", even the
  // ones with zero months of their own.
  const [todayYear, todayMonthNum] = todayStr.split('-').map(Number);
  const academicYearStarts = new Set<number>([
    academicYearStartOf(todayYear, todayMonthNum),
  ]);
  for (const monthKey of monthsByKey.keys()) {
    const [year, month] = monthKey.split('-').map(Number);
    academicYearStarts.add(academicYearStartOf(year, month));
  }

  const quartersByKey = new Map<string, QuarterGroup>();
  for (const start of [...academicYearStarts].sort((a, b) => a - b)) {
    for (let order = 0; order < ACADEMIC_QUARTERS.length; order += 1) {
      const key = `${start}-${order}`;
      quartersByKey.set(key, { key, label: quarterLabelOf(key), months: [] });
    }
  }

  const sortedMonthKeys = [...monthsByKey.keys()].sort();
  for (const monthKey of sortedMonthKeys) {
    const quarter = quartersByKey.get(quarterKeyOf(monthKey))!;
    quarter.months.push(monthsByKey.get(monthKey)!);
  }

  return [...quartersByKey.keys()]
    .sort((a, b) => {
      const [aStart, aOrder] = a.split('-').map(Number);
      const [bStart, bOrder] = b.split('-').map(Number);
      return aStart === bStart ? aOrder - bOrder : aStart - bStart;
    })
    .map((key) => quartersByKey.get(key)!);
};
