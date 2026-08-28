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
    expect(screen.getByRole('checkbox', { name: 'Jane Approver' })).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'officer@u.northwestern.edu' }),
    ).not.toBeChecked();
  });

  test('shows "Edit Task" and pre-fills fields from the task prop', () => {
    const task = buildMockFinancialTask({
      title: 'Submit Contract',
      description: 'Send to SOFO',
      dueDate: '2026-09-25',
      assigneeEmails: ['approver@u.northwestern.edu'],
    });
    renderModal({ task });
    expect(screen.getByRole('heading', { name: 'Edit Task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Submit Contract');
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('Send to SOFO');
    expect(screen.getByLabelText('Due Date')).toHaveValue('2026-09-25');
    expect(screen.getByRole('checkbox', { name: 'Jane Approver' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'officer@u.northwestern.edu' }),
    ).not.toBeChecked();
  });

  test('resolves roster emails to names via peopleNames, falling back to the email', () => {
    renderModal();
    expect(screen.getByRole('checkbox', { name: 'Jane Approver' })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'officer@u.northwestern.edu' }),
    ).toBeInTheDocument();
  });

  test("includes the task's current assignees as options even if they've left the roster", () => {
    const task = buildMockFinancialTask({
      assigneeEmails: ['former@u.northwestern.edu'],
    });
    renderModal({ task, rosterEmails: ['approver@u.northwestern.edu'] });
    expect(
      screen.getByRole('checkbox', { name: 'former@u.northwestern.edu' }),
    ).toBeInTheDocument();
  });

  test('multiple people can be selected as assignees', () => {
    renderModal();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Jane Approver' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'officer@u.northwestern.edu' }));
    expect(screen.getByRole('checkbox', { name: 'Jane Approver' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'officer@u.northwestern.edu' }),
    ).toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Jane Approver' }));
    expect(screen.getByRole('checkbox', { name: 'Jane Approver' })).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'officer@u.northwestern.edu' }),
    ).toBeChecked();
  });

  test('shows a validation error and does not save when title is missing', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSave });
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-09-25' },
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

  test('rejects a July/August due date, leaving the field unset', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-08-01' },
    });
    expect(
      screen.getByText(/Due date must fall between September 23 and June 11/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Due Date')).toHaveValue('');
  });

  test('rejects dates before Fall starts (Sep 1-22) and after Spring ends (Jun 12-30)', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-09-22' },
    });
    expect(
      screen.getByText(/Due date must fall between September 23 and June 11/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Due Date')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2027-06-12' },
    });
    expect(
      screen.getByText(/Due date must fall between September 23 and June 11/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Due Date')).toHaveValue('');
  });

  test('accepts the exact boundary dates: September 23 and June 11', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-09-23' },
    });
    expect(
      screen.queryByText(/Due date must fall between September 23 and June 11/),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Due Date')).toHaveValue('2026-09-23');

    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2027-06-11' },
    });
    expect(
      screen.queryByText(/Due date must fall between September 23 and June 11/),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Due Date')).toHaveValue('2027-06-11');
  });

  test('a valid due date clears a prior out-of-range error', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-07-15' },
    });
    expect(
      screen.getByText(/Due date must fall between September 23 and June 11/),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-09-25' },
    });
    expect(
      screen.queryByText(/Due date must fall between September 23 and June 11/),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Due Date')).toHaveValue('2026-09-25');
  });

  test('bounds the native date picker itself to the current academic year via min/max', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00'));
    renderModal();
    const input = screen.getByLabelText('Due Date');
    expect(input).toHaveAttribute('min', '2026-09-23');
    expect(input).toHaveAttribute('max', '2027-06-11');
    vi.useRealTimers();
  });

  test('calls onSave with the entered values, trimmed, and closes on success', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderModal({ onSave, onClose });

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: '  Submit Contract  ' },
    });
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-09-25' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'officer@u.northwestern.edu' }));
    fireEvent.click(screen.getByText('Save'));

    await screen.findByText('Save'); // let the async save settle
    expect(onSave).toHaveBeenCalledWith({
      title: 'Submit Contract',
      description: undefined,
      dueDate: '2026-09-25',
      assigneeEmails: ['officer@u.northwestern.edu'],
    });
    expect(onClose).toHaveBeenCalled();
  });

  test('shows an error message when onSave rejects, and does not close', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Failed to save. Try again.'));
    const onClose = vi.fn();
    renderModal({ onSave, onClose });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-09-25' },
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

  test("payment type select is populated from the app's existing supported types, excluding Deposit", () => {
    renderModal();
    expect(screen.getByRole('option', { name: 'No payment type' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Debit Card' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Payment Request' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Non-Officer Reimbursement' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Payment to NU Employee' }),
    ).toBeInTheDocument();
    // Deposits are Debit Card reloads, not something a task's payment type
    // ever needs to represent.
    expect(screen.queryByRole('option', { name: 'Deposit' })).not.toBeInTheDocument();
  });

  test('the individual-vendor checkbox and hint only appear once Payment Request is selected', () => {
    renderModal();
    expect(screen.queryByText(/Is this an individual vendor/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/automatically add the required documents/),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Payment Type (optional)'), {
      target: { value: 'Payment Request' },
    });
    expect(screen.getByText('Is this an individual vendor?')).toBeInTheDocument();
    expect(
      screen.getByText(/automatically add the required documents for Payment Request/),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Payment Type (optional)'), {
      target: { value: 'Debit Card' },
    });
    expect(screen.queryByText(/Is this an individual vendor/)).not.toBeInTheDocument();
  });

  test('onSave receives paymentType and isIndividualVendor', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSave });

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Submit Contract' },
    });
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-09-25' },
    });
    fireEvent.change(screen.getByLabelText('Payment Type (optional)'), {
      target: { value: 'Payment Request' },
    });
    fireEvent.click(screen.getByLabelText('Is this an individual vendor?'));
    fireEvent.click(screen.getByText('Save'));

    await screen.findByText('Save');
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentType: 'Payment Request',
        isIndividualVendor: true,
      }),
    );
  });

  test('isIndividualVendor is omitted from onSave when payment type is not Payment Request', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSave });

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Reload debit card' },
    });
    fireEvent.change(screen.getByLabelText('Due Date'), {
      target: { value: '2026-09-25' },
    });
    fireEvent.change(screen.getByLabelText('Payment Type (optional)'), {
      target: { value: 'Debit Card' },
    });
    fireEvent.click(screen.getByText('Save'));

    await screen.findByText('Save');
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentType: 'Debit Card',
        isIndividualVendor: undefined,
      }),
    );
  });

  test('pre-fills payment type and individual-vendor from the task prop when editing', () => {
    const task = buildMockFinancialTask({
      paymentType: 'Payment Request',
      isIndividualVendor: true,
    });
    renderModal({ task });
    expect(screen.getByLabelText('Payment Type (optional)')).toHaveValue(
      'Payment Request',
    );
    expect(screen.getByLabelText('Is this an individual vendor?')).toBeChecked();
  });
});
