import { FinancialTask } from '../types';

export const PX_PER_DAY = 28;
export const EDGE_PADDING_DAYS = 10;
export const MIN_TRACK_WIDTH = 900;
export const MIN_MARKER_GAP_PX = 36;

export interface MarkerPosition {
  task: FinancialTask;
  x: number;
}

export interface TimelineLayout {
  positions: MarkerPosition[];
  trackWidth: number;
  todayX: number;
}

// Both dates are YYYY-MM-DD with no time component, so parsing as UTC on
// both sides cancels out any timezone offset -- only the calendar-day gap
// matters here.
const daysBetween = (fromDate: string, toDate: string) =>
  Math.round(
    (new Date(`${toDate}T00:00:00Z`).getTime() -
      new Date(`${fromDate}T00:00:00Z`).getTime()) /
      86_400_000,
  );

export const computeMarkerLayout = (
  tasks: FinancialTask[],
  todayStr: string,
): TimelineLayout => {
  // YYYY-MM-DD strings sort lexicographically = chronologically, so plain
  // string min/max works without parsing every date up front.
  const allDates = [todayStr, ...tasks.map((t) => t.dueDate)];
  const minDate = allDates.reduce((a, b) => (b < a ? b : a));
  const maxDate = allDates.reduce((a, b) => (b > a ? b : a));

  const spanDays = daysBetween(minDate, maxDate) + EDGE_PADDING_DAYS * 2;
  const trackWidth = Math.max(MIN_TRACK_WIDTH, spanDays * PX_PER_DAY);
  // Sparse-list fallback: when the MIN_TRACK_WIDTH floor kicks in, stretch
  // days to fill it instead of clustering everything at the left edge.
  const effectivePxPerDay = trackWidth / spanDays;

  const xForDate = (date: string) =>
    (daysBetween(minDate, date) + EDGE_PADDING_DAYS) * effectivePxPerDay;

  const sortedTasks = [...tasks].sort((a, b) =>
    a.dueDate === b.dueDate
      ? a.id.localeCompare(b.id)
      : a.dueDate.localeCompare(b.dueDate),
  );

  const positions: MarkerPosition[] = [];
  let prevX = -Infinity;
  for (const task of sortedTasks) {
    let x = xForDate(task.dueDate);
    if (x - prevX < MIN_MARKER_GAP_PX) {
      x = prevX + MIN_MARKER_GAP_PX;
    }
    prevX = x;
    positions.push({ task, x });
  }

  return { positions, trackWidth, todayX: xForDate(todayStr) };
};
