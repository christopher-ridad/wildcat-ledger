import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask } from '../../../../../test/mocks';
import { ChapterTimeline } from './ChapterTimeline';

const renderTimeline = (
  overrides: Partial<ComponentProps<typeof ChapterTimeline>> = {},
) =>
  render(
    <ChapterTimeline
      tasks={[]}
      peopleNames={{}}
      canEdit
      isTaskPending={() => false}
      taskError={() => ''}
      onToggleComplete={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );

// Only a task row's own expand toggle carries aria-expanded.
const toggleFor = (title: string) =>
  screen
    .getAllByRole('button')
    .find((el) => el.hasAttribute('aria-expanded') && el.textContent?.includes(title))!;

describe('ChapterTimeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('shows an empty-state message and a Today divider with no tasks', () => {
    renderTimeline();
    expect(screen.getByText('No tasks yet.')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  test('renders quarter and month headings, and one row per task', () => {
    renderTimeline({
      tasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-12',
        }),
        buildMockFinancialTask({
          id: 't2',
          title: 'Reimburse Trip',
          dueDate: '2027-02-01',
        }),
      ],
    });
    expect(
      screen.getByRole('heading', { name: 'Fall Quarter 2026' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Winter Quarter 2027' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Submit Contract')).toBeInTheDocument();
    expect(screen.getByText('Reimburse Trip')).toBeInTheDocument();
  });

  test('expanding a row reveals its checkbox-adjacent detail and wires the mutations', () => {
    const onToggleComplete = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderTimeline({
      tasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-12',
          description: 'Details here',
        }),
      ],
      onToggleComplete,
      onEdit,
      onDelete,
    });

    fireEvent.click(toggleFor('Submit Contract'));
    expect(screen.getByText('Details here')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Submit Contract/ }));
    expect(onToggleComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Submit Contract' }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
    // Edit collapses the row it came from.
    expect(screen.queryByText('Details here')).not.toBeInTheDocument();

    fireEvent.click(toggleFor('Submit Contract'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Submit Contract' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  test('isolates pending/error state per task', () => {
    renderTimeline({
      tasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-12',
        }),
        buildMockFinancialTask({
          id: 't2',
          title: 'Reimburse Trip',
          dueDate: '2026-09-13',
        }),
      ],
      isTaskPending: (id) => id === 't1',
      taskError: (id) => (id === 't2' ? 'Failed.' : ''),
    });
    expect(screen.getByRole('checkbox', { name: /Submit Contract/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Reimburse Trip/ })).not.toBeDisabled();
    expect(screen.getByText('Failed.')).toBeInTheDocument();
  });

  test('two different rows can be expanded at the same time', () => {
    renderTimeline({
      tasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-12',
          description: 'First details',
        }),
        buildMockFinancialTask({
          id: 't2',
          title: 'Reimburse Trip',
          dueDate: '2026-09-13',
          description: 'Second details',
        }),
      ],
    });
    fireEvent.click(toggleFor('Submit Contract'));
    fireEvent.click(toggleFor('Reimburse Trip'));
    expect(screen.getByText('First details')).toBeInTheDocument();
    expect(screen.getByText('Second details')).toBeInTheDocument();
  });
});
