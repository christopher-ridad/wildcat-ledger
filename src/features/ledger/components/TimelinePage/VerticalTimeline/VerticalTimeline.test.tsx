import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask } from '../../../../../test/mocks';
import { VerticalTimeline } from './VerticalTimeline';

const renderTimeline = (
  overrides: Partial<ComponentProps<typeof VerticalTimeline>> = {},
) =>
  render(
    <VerticalTimeline
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

describe('VerticalTimeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('shows an empty-state message and a Today landmark with no tasks', () => {
    renderTimeline();
    expect(screen.getByText(/No tasks yet/)).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  test('renders quarter and month headings, and one marker per task', () => {
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
          dueDate: '2026-10-01',
        }),
      ],
    });
    expect(screen.getByRole('heading', { name: 'Q3 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Q4 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Contract' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reimburse Trip' })).toBeInTheDocument();
  });

  test('clicking a marker opens its popover; clicking again closes it', () => {
    renderTimeline({
      tasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-12',
        }),
      ],
    });
    const dot = screen.getByRole('button', { name: 'Submit Contract' });
    fireEvent.click(dot);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(dot);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('clicking a second marker switches which popover is open', () => {
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
          dueDate: '2026-09-20',
        }),
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Contract' }));
    expect(screen.getByRole('dialog', { name: 'Submit Contract' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reimburse Trip' }));
    expect(screen.getByRole('dialog', { name: 'Reimburse Trip' })).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Submit Contract' }),
    ).not.toBeInTheDocument();
  });

  test('clicking outside any marker closes the open popover', () => {
    renderTimeline({
      tasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-12',
        }),
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Contract' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('pressing Escape closes the open popover', () => {
    renderTimeline({
      tasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-12',
        }),
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Contract' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('checkbox inside the open popover calls onToggleComplete with the task and new state', () => {
    const onToggleComplete = vi.fn();
    renderTimeline({
      tasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-12',
        }),
      ],
      onToggleComplete,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Contract' }));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggleComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
      true,
    );
  });

  test('Edit inside the open popover calls onEdit and closes the popover', () => {
    const onEdit = vi.fn();
    renderTimeline({
      tasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-12',
        }),
      ],
      onEdit,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Contract' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Submit Contract' }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('Delete inside the open popover calls onDelete', () => {
    const onDelete = vi.fn();
    renderTimeline({
      tasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-12',
        }),
      ],
      onDelete,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Contract' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Submit Contract' }));
    expect(screen.getByRole('checkbox')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Submit Contract' })); // close it
    fireEvent.click(screen.getByRole('button', { name: 'Reimburse Trip' }));
    expect(screen.getByRole('checkbox')).not.toBeDisabled();
    expect(screen.getByText('Failed.')).toBeInTheDocument();
  });
});
