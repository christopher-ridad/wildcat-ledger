import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask } from '../../../../../test/mocks';
import { QuarterBoard } from './QuarterBoard';

const renderBoard = (overrides: Partial<ComponentProps<typeof QuarterBoard>> = {}) =>
  render(
    <QuarterBoard
      tasks={[]}
      requirementsByTaskId={new Map()}
      peopleNames={{}}
      canEdit
      isTaskPending={() => false}
      taskError={() => ''}
      isRequirementPending={() => false}
      onToggleComplete={vi.fn()}
      onToggleRequirement={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );

describe('QuarterBoard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('defaults to the quarter containing today, selected', () => {
    renderBoard();
    expect(screen.getByRole('tab', { name: 'Fall Quarter' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('shows the empty-quarter message for a quarter with no tasks and no Today landmark', () => {
    // Fall (the default-selected quarter) always has at least a "Today"
    // landmark month -- Winter genuinely has zero months when there are no
    // tasks in it.
    renderBoard();
    fireEvent.click(screen.getByRole('tab', { name: 'Winter Quarter' }));
    expect(screen.getByText('No tasks this quarter.')).toBeInTheDocument();
  });

  test('switching tabs swaps which months/tasks are shown', () => {
    renderBoard({
      tasks: [
        buildMockFinancialTask({ id: 'fall', title: 'Fall Task', dueDate: '2026-09-15' }),
        buildMockFinancialTask({
          id: 'winter',
          title: 'Winter Task',
          dueDate: '2027-02-01',
        }),
      ],
    });
    expect(screen.getByText('Fall Task')).toBeInTheDocument();
    expect(screen.queryByText('Winter Task')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Winter Quarter' }));
    expect(screen.queryByText('Fall Task')).not.toBeInTheDocument();
    expect(screen.getByText('Winter Task')).toBeInTheDocument();
  });

  test('threads callbacks through to the right task row', () => {
    const onToggleComplete = vi.fn();
    renderBoard({
      tasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-15',
        }),
      ],
      onToggleComplete,
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Submit Contract/ }));
    expect(onToggleComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
      true,
    );
  });
});
