import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask } from '../../../../../test/mocks';
import { TaskFormModal } from './TaskFormModal';

const rosterEmails = ['approver@u.northwestern.edu', 'officer@u.northwestern.edu'];
const peopleNames = { 'approver@u.northwestern.edu': 'Jane Approver' };

const renderModal = (overrides: Partial<ComponentProps<typeof TaskFormModal>> = {}) =>
  render(
    <TaskFormModal
      isOpen
      onClose={vi.fn()}
      rosterEmails={rosterEmails}
      peopleNames={peopleNames}
      onSave={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  );

describe('TaskFormModal', () => {
  test('renders nothing when closed', () => {
    const { container } = renderModal({ isOpen: false });
    expect(container).toBeEmptyDOMElement();
  });

  test('shows "Add Task" and starts blank when there is no task prop', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Add Task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Due Date')).toHaveValue('');
    expect(screen.getByLabelText('Assign to (optional)')).toHaveValue('');
  });

  test('shows "Edit Task" and pre-fills fields from the task prop', () => {
    const task = buildMockFinancialTask({
      title: 'Submit Contract',
      description: 'Send to SOFO',
      dueDate: '2026-09-15',
      assigneeEmail: 'approver@u.northwestern.edu',
    });
    renderModal({ task });
    expect(screen.getByRole('heading', { name: 'Edit Task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Submit Contract');
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('Send to SOFO');
    expect(screen.getByLabelText('Due Date')).toHaveValue('2026-09-15');
    expect(screen.getByLabelText('Assign to (optional)')).toHaveValue(
      'approver@u.northwestern.edu',
    );
  });

  test('resolves roster emails to names via peopleNames, falling back to the email', () => {
    renderModal();
    const select = screen.getByLabelText('Assign to (optional)');
    expect(screen.getByRole('option', { name: 'Jane Approver' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'officer@u.northwestern.edu' }),
    ).toBeInTheDocument();
    expect(select).toHaveValue('');
  });

  test("includes the task's current assignee as an option even if they've left the roster", () => {
    const task = buildMockFinancialTask({ assigneeEmail: 'former@u.northwestern.edu' });
    renderModal({ task, rosterEmails: ['approver@u.northwestern.edu'] });
    expect(
      screen.getByRole('option', { name: 'former@u.northwestern.edu' }),
    ).toBeInTheDocument();
  });

  test('shows a validation error and does not save when title is missing', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSave });
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-09-15' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(
      await screen.findByText('Title and due date are required.'),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('shows a validation error and does not save when due date is missing', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSave });
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Submit Contract' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(
      await screen.findByText('Title and due date are required.'),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('calls onSave with the entered values, trimmed, and closes on success', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderModal({ onSave, onClose });

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: '  Submit Contract  ' },
    });
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-09-15' },
    });
    fireEvent.change(screen.getByLabelText('Assign to (optional)'), {
      target: { value: 'officer@u.northwestern.edu' },
    });
    fireEvent.click(screen.getByText('Save'));

    await screen.findByText('Save'); // let the async save settle
    expect(onSave).toHaveBeenCalledWith({
      title: 'Submit Contract',
      description: undefined,
      dueDate: '2026-09-15',
      assigneeEmail: 'officer@u.northwestern.edu',
    });
    expect(onClose).toHaveBeenCalled();
  });

  test('shows an error message when onSave rejects, and does not close', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Failed to save. Try again.'));
    const onClose = vi.fn();
    renderModal({ onSave, onClose });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-09-15' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Failed to save. Try again.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('Cancel closes without saving', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderModal({ onSave, onClose });
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
