import { FinancialTask } from '../types';

export interface MonthGroup {
  key: string; // 'YYYY-MM'
  label: string; // 'January'
  tasks: FinancialTask[]; // chronological
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
// budget activity against Northwestern's own academic calendar. Each
// quarter maps to its actual months (Fall: Sep-Dec, Winter: Jan-Mar,
// Spring: Apr-Jun); July/August fall in neither, so tasks due then are
// excluded from every quarter tab entirely -- same treatment as a task due
// in a different academic year (see groupTasksByQuarter below).
//
// An "academic year" starting in year Y runs Fall(Y) -> Winter(Y+1) ->
// Spring(Y+1), labeled "Y-(Y+1)" (e.g. "2026-2027"). Quarter keys are
// `${academicYearStart}-${order}` (order: Fall=0, Winter=1, Spring=2) so a
// plain string/numeric sort is already chronologically correct with no
// cross-year juggling.
const ACADEMIC_QUARTERS = ['Fall', 'Winter', 'Spring'] as const;

export const academicYearStartOf = (year: number, month: number) =>
  month >= 7 ? year : year - 1;

// Fall=0, Winter=1, Spring=2, or null for July/August (no quarter of their
// own).
const academicQuarterOrderOf = (month: number): number | null => {
  if (month >= 9) return 0; // Sep-Dec -> Fall
  if (month <= 3) return 1; // Jan-Mar -> Winter
  if (month <= 6) return 2; // Apr-Jun -> Spring
  return null; // Jul-Aug -> no quarter
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
  `${academicYearStart}-${academicYearStart + 1}`;

// Whether a YYYY-MM-DD date falls within the academic year's actual
// start/end -- September 23 through June 11 -- rather than just the whole
// months those quarters' tasks get bucketed into for display. The month-
// level exclusion (July/August) still applies via academicQuarterOrderOf;
// this additionally trims the partial weeks at both ends of the year that
// fall outside term (before Fall actually starts, after Spring actually
// ends) even though they're still nominally September/June. Used to keep
// the task form from accepting a due date that's outside the school year.
export const isDateInSupportedQuarter = (dateStr: string) => {
  const month = Number(dateStr.slice(5, 7));
  if (academicQuarterOrderOf(month) === null) return false; // July/August
  const day = Number(dateStr.slice(8, 10));
  if (month === 9 && day < 23) return false; // before Fall starts
  if (month === 6 && day > 11) return false; // after Spring ends
  return true;
};

export const currentAcademicYearLabel = (todayStr: string) => {
  const [year, month] = todayStr.split('-').map(Number);
  return academicYearLabel(academicYearStartOf(year, month));
};

// The quarter (of the CURRENT academic year) containing the given date, in
// the same `${academicYearStart}-${order}` shape as QuarterGroup.key -- used
// to pick the default-selected tab. July/August (no quarter of their own)
// default to the upcoming Fall.
export const currentQuarterKey = (todayStr: string) => {
  const [year, month] = todayStr.split('-').map(Number);
  const order = academicQuarterOrderOf(month) ?? 0;
  return `${academicYearStartOf(year, month)}-${order}`;
};

// Always exactly 3 quarters -- Fall/Winter/Spring of the academic year
// containing "today" -- since the UI presents them as a fixed 3-tab
// selector, not an open-ended scroll. Tasks due in any OTHER academic year,
// or in July/August (no quarter of their own), are excluded from the
// result entirely (a confirmed, deliberate choice: a tab selector only
// makes sense for a known, fixed set of tabs, and this is meant to answer
// "what does the org need to do THIS quarter," not archive every task ever
// entered).
export const groupTasksByQuarter = (
  tasks: FinancialTask[],
  todayStr: string,
): QuarterGroup[] => {
  const [todayYear, todayMonthNum] = todayStr.split('-').map(Number);
  const currentYearStart = academicYearStartOf(todayYear, todayMonthNum);

  const quarters: QuarterGroup[] = ACADEMIC_QUARTERS.map((_, order) => {
    const key = `${currentYearStart}-${order}`;
    return { key, label: quarterLabelOf(key), months: [] };
  });

  const tasksInCurrentYear = tasks.filter((task) => {
    const [year, month] = task.dueDate.split('-').map(Number);
    return academicYearStartOf(year, month) === currentYearStart;
  });

  const sortedTasks = [...tasksInCurrentYear].sort((a, b) =>
    a.dueDate === b.dueDate
      ? a.id.localeCompare(b.id)
      : a.dueDate.localeCompare(b.dueDate),
  );

  const monthsByKey = new Map<string, MonthGroup>();
  for (const task of sortedTasks) {
    const [, monthNum] = task.dueDate.split('-').map(Number);
    const order = academicQuarterOrderOf(monthNum);
    if (order === null) continue; // July/August -- no quarter of their own

    const monthKey = monthKeyOf(task.dueDate);
    let month = monthsByKey.get(monthKey);
    if (!month) {
      month = { key: monthKey, label: monthLabelOf(monthKey), tasks: [] };
      monthsByKey.set(monthKey, month);
      // sortedTasks is date-ascending, so a month is always first seen in
      // chronological order -- no separate sort of quarters[].months needed.
      quarters[order].months.push(month);
    }
    month.tasks.push(task);
  }

  return quarters;
};
