import { describe, expect, test } from 'vitest';

import { buildMockFinancialTask } from '../../../test/mocks';
import {
  computeMarkerLayout,
  EDGE_PADDING_DAYS,
  MIN_MARKER_GAP_PX,
  MIN_TRACK_WIDTH,
  PX_PER_DAY,
} from './timelinePositions';

const TODAY = '2026-09-10';

describe('computeMarkerLayout', () => {
  test('falls back to MIN_TRACK_WIDTH with no tasks, and centers todayX', () => {
    const { positions, trackWidth, todayX } = computeMarkerLayout([], TODAY);
    expect(positions).toEqual([]);
    expect(trackWidth).toBe(MIN_TRACK_WIDTH);
    expect(todayX).toBeCloseTo(MIN_TRACK_WIDTH / 2, 0);
  });

  test('falls back to MIN_TRACK_WIDTH for a single task near today', () => {
    const { trackWidth } = computeMarkerLayout(
      [buildMockFinancialTask({ dueDate: '2026-09-12' })],
      TODAY,
    );
    expect(trackWidth).toBe(MIN_TRACK_WIDTH);
  });

  test('trackWidth grows past the floor for a widely-spread task list', () => {
    const { trackWidth } = computeMarkerLayout(
      [buildMockFinancialTask({ id: 't1', dueDate: '2027-09-10' })],
      TODAY,
    );
    const expectedSpanDays = 365 + EDGE_PADDING_DAYS * 2;
    expect(trackWidth).toBe(expectedSpanDays * PX_PER_DAY);
  });

  test('positions come back sorted by dueDate ascending regardless of input order', () => {
    const { positions } = computeMarkerLayout(
      [
        buildMockFinancialTask({ id: 't-late', dueDate: '2026-12-01' }),
        buildMockFinancialTask({ id: 't-early', dueDate: '2026-09-15' }),
      ],
      TODAY,
    );
    expect(positions.map((p) => p.task.id)).toEqual(['t-early', 't-late']);
    expect(positions[0].x).toBeLessThan(positions[1].x);
  });

  test('two tasks sharing the same dueDate end up at least MIN_MARKER_GAP_PX apart', () => {
    const { positions } = computeMarkerLayout(
      [
        buildMockFinancialTask({ id: 't1', dueDate: '2026-09-15' }),
        buildMockFinancialTask({ id: 't2', dueDate: '2026-09-15' }),
      ],
      TODAY,
    );
    expect(positions[1].x - positions[0].x).toBeGreaterThanOrEqual(MIN_MARKER_GAP_PX);
  });

  test('a tight cluster of 3+ tasks stays pairwise at least MIN_MARKER_GAP_PX apart', () => {
    const { positions } = computeMarkerLayout(
      [
        buildMockFinancialTask({ id: 't1', dueDate: '2026-09-15' }),
        buildMockFinancialTask({ id: 't2', dueDate: '2026-09-15' }),
        buildMockFinancialTask({ id: 't3', dueDate: '2026-09-16' }),
        buildMockFinancialTask({ id: 't4', dueDate: '2026-09-16' }),
      ],
      TODAY,
    );
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].x - positions[i - 1].x).toBeGreaterThanOrEqual(
        MIN_MARKER_GAP_PX,
      );
    }
  });

  test('an overdue task extends the range leftward instead of being clipped', () => {
    const { positions, todayX } = computeMarkerLayout(
      [buildMockFinancialTask({ id: 't1', dueDate: '2026-08-01' })],
      TODAY,
    );
    expect(positions[0].x).toBeGreaterThanOrEqual(0);
    expect(positions[0].x).toBeLessThan(todayX);
  });

  test('todayX stays within [0, trackWidth] and moves between min/max task dates', () => {
    const past = computeMarkerLayout(
      [buildMockFinancialTask({ id: 't1', dueDate: '2026-01-01' })],
      TODAY,
    );
    const future = computeMarkerLayout(
      [buildMockFinancialTask({ id: 't1', dueDate: '2027-01-01' })],
      TODAY,
    );
    expect(past.todayX).toBeGreaterThanOrEqual(0);
    expect(past.todayX).toBeLessThanOrEqual(past.trackWidth);
    expect(future.todayX).toBeGreaterThanOrEqual(0);
    expect(future.todayX).toBeLessThanOrEqual(future.trackWidth);
    // Today sits further right (proportionally) when the range extends far
    // into the future than when it extends far into the past.
    expect(future.todayX / future.trackWidth).toBeLessThan(past.todayX / past.trackWidth);
  });
});
