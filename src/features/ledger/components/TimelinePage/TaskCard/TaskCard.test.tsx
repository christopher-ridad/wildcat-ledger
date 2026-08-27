import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask } from '../../../../../test/mocks';
import { TaskCard } from './TaskCard';

const renderCard = (overrides: Partial<ComponentProps<typeof TaskCard>> = {}) =>
  render(
    <TaskCard
      task={buildMockFinancialTask()}
      peopleNames={{}}
      canEdit
      pending={false}
      onToggleComplete={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );

describe('TaskCard', () => {
  test('renders the title and due date', () => {
    renderCard({ task: buildMockFinancialTask({ title: 'Submit Contract' }) });
    expect(screen.getByText('Submit Contract')).toBeInTheDocument();
    expect(screen.getByText(/Due 2026-09-15/)).toBeInTheDocument();
  });

  test('shows overdue styling and text for an incomplete, past-due task', () => {
    renderCard({ task: buildMockFinancialTask({ dueDate: '2020-01-01' }) });
    expect(screen.getByText(/\(overdue\)/)).toBeInTheDocument();
  });

  test('does not show overdue for a completed task, even if past due', () => {
    renderCard({
      task: buildMockFinancialTask({
        dueDate: '2020-01-01',
        completedAt: '2020-01-02T00:00:00.000Z',
      }),
    });
    expect(screen.queryByText(/\(overdue\)/)).not.toBeInTheDocument();
  });

  test('does not show overdue for a future due date', () => {
    renderCard({ task: buildMockFinancialTask({ dueDate: '2099-01-01' }) });
    expect(screen.queryByText(/\(overdue\)/)).not.toBeInTheDocument();
  });

  describe('urgency labelling, pinned to a fixed "today"', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-10T12:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('shows "(due soon)" for a task due within 3 days', () => {
      renderCard({ task: buildMockFinancialTask({ dueDate: '2026-09-12' }) });
      expect(screen.getByText(/\(due soon\)/)).toBeInTheDocument();
    });

    test('shows "(this week)" for a task due 4-7 days out', () => {
      renderCard({ task: buildMockFinancialTask({ dueDate: '2026-09-16' }) });
      expect(screen.getByText(/\(this week\)/)).toBeInTheDocument();
    });

    test('shows no urgency label for a task due more than a week out', () => {
      renderCard({ task: buildMockFinancialTask({ dueDate: '2026-09-25' }) });
      expect(screen.queryByText(/\(due soon\)/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\(this week\)/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\(overdue\)/)).not.toBeInTheDocument();
    });

    test('shows no urgency label for a completed task even when its due date is imminent', () => {
      renderCard({
        task: buildMockFinancialTask({
          dueDate: '2026-09-11',
          completedAt: '2026-09-01T00:00:00Z',
        }),
      });
      expect(screen.queryByText(/\(due soon\)/)).not.toBeInTheDocument();
    });
  });

  test('checkbox reflects completedAt, and toggling calls onToggleComplete', () => {
    const onToggleComplete = vi.fn();
    renderCard({
      task: buildMockFinancialTask({ completedAt: null }),
      onToggleComplete,
    });
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(onToggleComplete).toHaveBeenCalledWith(true);
  });

  test('shows as checked when completedAt is set', () => {
    renderCard({ task: buildMockFinancialTask({ completedAt: '2026-09-01T00:00:00Z' }) });
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  test('disables the checkbox and action buttons while pending', () => {
    renderCard({ pending: true });
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Edit/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeDisabled();
  });

  test('shows the assignee name via peopleNames, falling back to the email', () => {
    const { rerender } = render(
      <TaskCard
        task={buildMockFinancialTask({ assigneeEmail: 'officer@u.northwestern.edu' })}
        peopleNames={{ 'officer@u.northwestern.edu': 'Jane Officer' }}
        canEdit
        pending={false}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Jane Officer')).toBeInTheDocument();

    rerender(
      <TaskCard
        task={buildMockFinancialTask({ assigneeEmail: 'unknown@u.northwestern.edu' })}
        peopleNames={{}}
        canEdit
        pending={false}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('unknown@u.northwestern.edu')).toBeInTheDocument();
  });

  test('hides Edit/Delete buttons when canEdit is false', () => {
    renderCard({ canEdit: false });
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  test('Edit and Delete buttons call their handlers', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderCard({
      onEdit,
      onDelete,
      task: buildMockFinancialTask({ title: 'Submit Contract' }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Submit Contract' }));
    expect(onEdit).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Submit Contract' }));
    expect(onDelete).toHaveBeenCalled();
  });

  test('shows an error message when given one', () => {
    renderCard({ error: 'Failed to delete.' });
    expect(screen.getByText('Failed to delete.')).toBeInTheDocument();
  });
});
