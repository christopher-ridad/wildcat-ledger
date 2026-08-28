import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  buildMockFinancialTask,
  buildMockFinancialTaskRequirement,
} from '../../../../test/mocks';
import { TaskRow } from './TaskRow';

const renderRow = (overrides: Partial<ComponentProps<typeof TaskRow>> = {}) =>
  render(
    <TaskRow
      task={buildMockFinancialTask()}
      staggerIndex={0}
      requirements={[]}
      peopleNames={{}}
      canEdit
      pending={false}
      isRequirementPending={() => false}
      onToggleComplete={vi.fn()}
      onToggleRequirement={vi.fn()}
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
        assigneeEmails: ['officer@u.northwestern.edu'],
      }),
    });
    expect(screen.getByText('Submit Contract')).toBeInTheDocument();
    expect(screen.getByText(/Due 2026-09-15/)).toBeInTheDocument();
    expect(screen.queryByText('Long description text')).not.toBeInTheDocument();
    expect(screen.queryByText(/officer@u.northwestern.edu/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });

  test('expanding shows description, assignee, and Edit/Delete', () => {
    renderRow({
      task: buildMockFinancialTask({
        title: 'Submit Contract',
        description: 'Long description text',
        assigneeEmails: ['unknown@u.northwestern.edu'],
      }),
    });
    clickToggle();
    expect(screen.getByText('Long description text')).toBeInTheDocument();
    expect(
      screen.getByText('Assigned to: unknown@u.northwestern.edu'),
    ).toBeInTheDocument();
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
        assigneeEmails: ['a@u.edu'],
      }),
      peopleNames: { 'a@u.edu': 'Jane Officer' },
    });
    clickToggle();
    expect(screen.getByText('Assigned to: Jane Officer')).toBeInTheDocument();
  });

  test('shows multiple assignees joined by comma', () => {
    renderRow({
      task: buildMockFinancialTask({
        title: 'Submit Contract',
        assigneeEmails: ['a@u.edu', 'b@u.edu'],
      }),
      peopleNames: { 'a@u.edu': 'Jane Officer', 'b@u.edu': 'John Officer' },
    });
    clickToggle();
    expect(
      screen.getByText('Assigned to: Jane Officer, John Officer'),
    ).toBeInTheDocument();
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

  test('shows the payment type in the collapsed header when set', () => {
    renderRow({ task: buildMockFinancialTask({ paymentType: 'Payment Request' }) });
    expect(screen.getByText(/Payment Request/)).toBeInTheDocument();
  });

  test('omits payment type text when not set', () => {
    renderRow({ task: buildMockFinancialTask({ paymentType: undefined }) });
    expect(
      screen.queryByText(/Payment Request|Debit Card|Deposit/),
    ).not.toBeInTheDocument();
  });

  test('requirements checklist only renders once expanded, with correct checked state', () => {
    const requirements = [
      buildMockFinancialTaskRequirement({
        id: 'r1',
        key: 'contract',
        label: 'RSO Agreement',
      }),
      buildMockFinancialTaskRequirement({
        id: 'r2',
        key: 'w9',
        label: 'W-9',
        completedAt: '2026-09-01T00:00:00Z',
      }),
    ];
    renderRow({
      task: buildMockFinancialTask({ title: 'Submit Contract' }),
      requirements,
    });
    expect(screen.queryByText('RSO Agreement')).not.toBeInTheDocument();

    clickToggle();
    expect(screen.getByText('RSO Agreement')).toBeInTheDocument();
    expect(screen.getByText('W-9')).toBeInTheDocument();
    const [contractCheckbox, w9Checkbox] = screen.getAllByRole('checkbox').slice(1);
    expect(contractCheckbox).not.toBeChecked();
    expect(w9Checkbox).toBeChecked();
  });

  test('toggling a requirement checkbox calls onToggleRequirement with the right requirement', () => {
    const onToggleRequirement = vi.fn();
    const requirement = buildMockFinancialTaskRequirement({
      id: 'r1',
      key: 'contract',
      label: 'RSO Agreement',
    });
    renderRow({
      task: buildMockFinancialTask({ title: 'Submit Contract' }),
      requirements: [requirement],
      onToggleRequirement,
    });
    clickToggle();
    const [requirementCheckbox] = screen.getAllByRole('checkbox').slice(1);
    fireEvent.click(requirementCheckbox);
    expect(onToggleRequirement).toHaveBeenCalledWith(requirement, true);
  });

  test('a pending requirement disables just its own checkbox', () => {
    const requirements = [
      buildMockFinancialTaskRequirement({
        id: 'r1',
        key: 'contract',
        label: 'RSO Agreement',
      }),
      buildMockFinancialTaskRequirement({ id: 'r2', key: 'w9', label: 'W-9' }),
    ];
    renderRow({
      task: buildMockFinancialTask({ title: 'Submit Contract' }),
      requirements,
      isRequirementPending: (id) => id === 'r1',
    });
    clickToggle();
    const [contractCheckbox, w9Checkbox] = screen.getAllByRole('checkbox').slice(1);
    expect(contractCheckbox).toBeDisabled();
    expect(w9Checkbox).not.toBeDisabled();
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

    test('shows "Upcoming" for a task due more than a week out', () => {
      renderRow({ task: buildMockFinancialTask({ dueDate: '2026-09-25' }) });
      expect(screen.getByText(/Upcoming/)).toBeInTheDocument();
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
