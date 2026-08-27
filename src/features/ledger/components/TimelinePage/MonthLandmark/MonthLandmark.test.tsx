import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask } from '../../../../../test/mocks';
import { MonthGroup } from '../../../utils/groupTasksByQuarter';
import { MonthLandmark } from './MonthLandmark';

const baseMonth: MonthGroup = {
  key: '2026-09',
  label: 'September',
  entries: [
    {
      task: buildMockFinancialTask({
        id: 't1',
        title: 'Submit Contract',
        dueDate: '2026-09-05',
      }),
    },
    {
      task: buildMockFinancialTask({
        id: 't2',
        title: 'File SOFO Form',
        dueDate: '2026-09-20',
      }),
    },
  ],
};

const renderMonth = (overrides: Partial<ComponentProps<typeof MonthLandmark>> = {}) =>
  render(
    <MonthLandmark
      month={baseMonth}
      taskSides={
        new Map([
          ['t1', 'left'],
          ['t2', 'right'],
        ])
      }
      peopleNames={{}}
      canEdit
      activeTaskId={null}
      onToggleActive={vi.fn()}
      isTaskPending={() => false}
      taskError={() => ''}
      onToggleComplete={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );

describe('MonthLandmark', () => {
  test('renders the month label', () => {
    renderMonth();
    expect(screen.getByText('September')).toBeInTheDocument();
  });

  test('renders one marker per task entry, in order', () => {
    renderMonth();
    expect(screen.getByRole('button', { name: 'Submit Contract' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'File SOFO Form' })).toBeInTheDocument();
  });

  test('renders a Today landmark when the month has one', () => {
    renderMonth({
      month: {
        ...baseMonth,
        entries: [...baseMonth.entries, { isToday: true }],
      },
    });
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  test('does not render a Today landmark when the month has none', () => {
    renderMonth();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });

  test('clicking a marker calls onToggleActive with that task id', () => {
    const onToggleActive = vi.fn();
    renderMonth({ onToggleActive });
    screen.getByRole('button', { name: 'Submit Contract' }).click();
    expect(onToggleActive).toHaveBeenCalledWith('t1');
  });
});
