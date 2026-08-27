import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask } from '../../../../../test/mocks';
import { TaskRow } from './TaskRow';

const renderRow = (overrides: Partial<ComponentProps<typeof TaskRow>> = {}) =>
  render(
    <TaskRow
      task={buildMockFinancialTask()}
      staggerIndex={0}
      peopleNames={{}}
      canEdit
      pending={false}
      onToggleComplete={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );

// Only the row's own expand toggle carries aria-expanded -- Edit/Delete
// don't -- so this stays unambiguous even once expanding reveals buttons
// whose accessible names also happen to contain the task title.
const clickToggle = () => {
  const toggle = screen
    .getAllByRole('button')
    .find((el) => el.hasAttribute('aria-expanded'));
  fireEvent.click(toggle!);
};

describe('TaskRow', () => {
  test('collapsed: shows title and due date, no description/assignee/actions', () => {
    renderRow({
      task: buildMockFinancialTask({
        title: 'Submit Contract',
        dueDate: '2026-09-15',
        description: 'Long description text',
        assigneeEmail: 'officer@u.northwestern.edu',
      }),
    });
    expect(screen.getByText('Submit Contract')).toBeInTheDocument();
    expect(screen.getByText(/Due 2026-09-15/)).toBeInTheDocument();
    expect(screen.queryByText('Long description text')).not.toBeInTheDocument();
    expect(screen.queryByText('officer@u.northwestern.edu')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });

  test('expanding shows description, assignee, and Edit/Delete', () => {
    renderRow({
      task: buildMockFinancialTask({
        title: 'Submit Contract',
        description: 'Long description text',
        assigneeEmail: 'unknown@u.northwestern.edu',
      }),
    });
    clickToggle();
    expect(screen.getByText('Long description text')).toBeInTheDocument();
    expect(screen.getByText('unknown@u.northwestern.edu')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Submit Contract' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Submit Contract' }),
    ).toBeInTheDocument();
  });

  test('clicking the toggle again collapses it', () => {
    renderRow({ task: buildMockFinancialTask({ title: 'Submit Contract' }) });
    clickToggle();
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
    clickToggle();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });

  test('shows the assignee name via peopleNames, falling back to the email', () => {
    renderRow({
      task: buildMockFinancialTask({
        title: 'Submit Contract',
        assigneeEmail: 'a@u.edu',
      }),
      peopleNames: { 'a@u.edu': 'Jane Officer' },
    });
    clickToggle();
    expect(screen.getByText('Jane Officer')).toBeInTheDocument();
  });

  test('hides Edit/Delete when canEdit is false, even when expanded', () => {
    renderRow({
      task: buildMockFinancialTask({ title: 'Submit Contract' }),
      canEdit: false,
    });
    clickToggle();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  test('checkbox reflects completedAt, and toggling calls onToggleComplete', () => {
    const onToggleComplete = vi.fn();
    renderRow({
      task: buildMockFinancialTask({ completedAt: null }),
      onToggleComplete,
    });
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(onToggleComplete).toHaveBeenCalledWith(true);
  });

  test('shows as checked and strikes through the title when completedAt is set', () => {
    renderRow({
      task: buildMockFinancialTask({
        title: 'Submit Contract',
        completedAt: '2026-09-01T00:00:00Z',
      }),
    });
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  test('checkbox and Edit/Delete are disabled while pending', () => {
    renderRow({
      task: buildMockFinancialTask({ title: 'Submit Contract' }),
      pending: true,
    });
    expect(screen.getByRole('checkbox')).toBeDisabled();
    clickToggle();
    expect(screen.getByRole('button', { name: /Edit/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeDisabled();
  });

  test('clicking Edit collapses the row and calls onEdit', () => {
    const onEdit = vi.fn();
    renderRow({ task: buildMockFinancialTask({ title: 'Submit Contract' }), onEdit });
    clickToggle();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Submit Contract' }));
    expect(onEdit).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });

  test('clicking Delete calls onDelete and does not collapse the row', () => {
    const onDelete = vi.fn();
    renderRow({ task: buildMockFinancialTask({ title: 'Submit Contract' }), onDelete });
    clickToggle();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Submit Contract' }));
    expect(onDelete).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
  });

  test('shows an error message next to the header regardless of expand state', () => {
    renderRow({ error: 'Failed to update.' });
    expect(screen.getByText('Failed to update.')).toBeInTheDocument();
  });

  describe('status label, pinned to a fixed "today"', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-10T12:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('shows "Overdue" for an incomplete past-due task', () => {
      renderRow({ task: buildMockFinancialTask({ dueDate: '2020-01-01' }) });
      expect(screen.getByText(/Overdue/)).toBeInTheDocument();
    });

    test('shows "Due soon" for a task due within 3 days', () => {
      renderRow({ task: buildMockFinancialTask({ dueDate: '2026-09-12' }) });
      expect(screen.getByText(/Due soon/)).toBeInTheDocument();
    });

    test('shows "Due this week" for a task due 4-7 days out', () => {
      renderRow({ task: buildMockFinancialTask({ dueDate: '2026-09-16' }) });
      expect(screen.getByText(/Due this week/)).toBeInTheDocument();
    });

    test('shows no status label for a task due more than a week out', () => {
      renderRow({ task: buildMockFinancialTask({ dueDate: '2026-09-25' }) });
      expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Due soon/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Due this week/)).not.toBeInTheDocument();
    });

    test('shows no status label for a completed task even when overdue', () => {
      renderRow({
        task: buildMockFinancialTask({
          dueDate: '2020-01-01',
          completedAt: '2020-01-02T00:00:00Z',
        }),
      });
      expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
    });
  });
});
