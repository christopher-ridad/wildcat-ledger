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

// The quarter (of the CURRENT academic year) containing the given date, in
// the same `${academicYearStart}-${order}` shape as QuarterGroup.key -- used
// to pick the default-selected tab.
export const currentQuarterKey = (todayStr: string) => {
  const [year, month] = todayStr.split('-').map(Number);
  return `${academicYearStartOf(year, month)}-${academicQuarterOrderOf(month)}`;
};

// Always exactly 3 quarters -- Fall/Winter/Spring of the academic year
// containing "today" -- since the UI presents them as a fixed 3-tab
// selector, not an open-ended scroll. Tasks due in any OTHER academic year
// are excluded from the result entirely (a confirmed, deliberate choice: a
// tab selector only makes sense for a known, fixed set of tabs, and this is
// meant to answer "what does the org need to do THIS year," not archive
// every task ever entered).
export const groupTasksByQuarter = (
  tasks: FinancialTask[],
  todayStr: string,
): QuarterGroup[] => {
  const [todayYear, todayMonthNum] = todayStr.split('-').map(Number);
  const currentYearStart = academicYearStartOf(todayYear, todayMonthNum);

  const monthsByKey = new Map<string, MonthGroup>();

  const getOrCreateMonth = (monthKey: string) => {
    let month = monthsByKey.get(monthKey);
    if (!month) {
      month = { key: monthKey, label: monthLabelOf(monthKey), entries: [] };
      monthsByKey.set(monthKey, month);
    }
    return month;
  };

  const tasksInCurrentYear = tasks.filter((task) => {
    const [year, month] = task.dueDate.split('-').map(Number);
    return academicYearStartOf(year, month) === currentYearStart;
  });

  const sortedTasks = [...tasksInCurrentYear].sort((a, b) =>
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

  const quarters: QuarterGroup[] = [];
  for (let order = 0; order < ACADEMIC_QUARTERS.length; order += 1) {
    const key = `${currentYearStart}-${order}`;
    quarters.push({ key, label: quarterLabelOf(key), months: [] });
  }

  const sortedMonthKeys = [...monthsByKey.keys()].sort();
  for (const monthKey of sortedMonthKeys) {
    const quarter = quarters[academicQuarterOrderOf(Number(monthKey.slice(5, 7)))];
    quarter.months.push(monthsByKey.get(monthKey)!);
  }

  return quarters;
};
