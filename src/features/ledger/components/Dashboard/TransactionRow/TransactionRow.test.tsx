import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  buildMockPendingChange,
  buildMockTransaction,
  buildMockUser,
} from '../../../../../test/mocks';
import { useAuth } from '../../../../authentication/hooks/useAuth';
import { TransactionRow } from './TransactionRow';

vi.mock('../../../../authentication/hooks/useAuth');
const mockUseAuth = vi.mocked(useAuth);

const noop = vi.fn();
const asyncNoop = vi.fn().mockResolvedValue(undefined);

const renderRow = (props: Partial<ComponentProps<typeof TransactionRow>> = {}) =>
  render(
    <table>
      <tbody>
        <TransactionRow
          t={buildMockTransaction()}
          canEdit={false}
          pending={undefined}
          onEdit={noop}
          onDelete={noop}
          onApprove={asyncNoop}
          onReject={asyncNoop}
          onCancel={asyncNoop}
          onViewFiles={noop}
          onUpdatePaymentStatus={asyncNoop}
          {...props}
        />
      </tbody>
    </table>,
  );

describe('TransactionRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: buildMockUser({ email: 'treasurer@example.com' }),
      loading: false,
      sendLoginLink: vi.fn(),
    });
  });

  test('renders the title, amount, and type', () => {
    renderRow({
      t: buildMockTransaction({ title: 'Pizza', amount: 42.5, direction: 'Outflow' }),
    });
    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.getByText('-$42.50')).toBeInTheDocument();
  });

  test('shows a "+" prefix for inflows', () => {
    renderRow({ t: buildMockTransaction({ amount: 100, direction: 'Inflow' }) });
    expect(screen.getByText('+$100.00')).toBeInTheDocument();
  });

  test('renders no Actions cell when canEdit is false', () => {
    renderRow({ canEdit: false });
    expect(screen.queryByLabelText('Edit transaction')).not.toBeInTheDocument();
  });

  test('shows Edit/Delete actions when canEdit and no pending change', () => {
    renderRow({ canEdit: true });
    expect(screen.getByLabelText('Edit transaction')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete transaction')).toBeInTheDocument();
  });

  test('hides Edit/Delete once the transaction is reconciled', () => {
    renderRow({
      canEdit: true,
      t: buildMockTransaction({ budgetLine: 'Debit Card', reconciledAt: Date.now() }),
    });
    expect(screen.queryByLabelText('Edit transaction')).not.toBeInTheDocument();
    expect(screen.getByText('Reconciled')).toBeInTheDocument();
  });

  test('shows a file-count button only when files are attached', () => {
    renderRow({
      canEdit: true,
      t: buildMockTransaction({ receiptFileUrl: 'orgs/1/receipt.png' }),
    });
    expect(screen.getByLabelText('View 1 attached file')).toBeInTheDocument();
  });

  test('clicking Edit calls onEdit with the transaction', () => {
    const onEdit = vi.fn();
    const t = buildMockTransaction();
    renderRow({ canEdit: true, onEdit, t });
    fireEvent.click(screen.getByLabelText('Edit transaction'));
    expect(onEdit).toHaveBeenCalledWith(t);
  });

  test('clicking Delete calls onDelete with the transaction', () => {
    const onDelete = vi.fn();
    const t = buildMockTransaction();
    renderRow({ canEdit: true, onDelete, t });
    fireEvent.click(screen.getByLabelText('Delete transaction'));
    expect(onDelete).toHaveBeenCalledWith(t);
  });

  describe('debit card reconciliation status', () => {
    test('shows "Not Reconciled" by default for a Debit Card transaction', () => {
      renderRow({
        t: buildMockTransaction({ budgetLine: 'Debit Card', reconciledAt: null }),
      });
      expect(screen.getByText('Not Reconciled')).toBeInTheDocument();
    });

    test('shows "Reconciled" once reconciledAt is set', () => {
      renderRow({
        t: buildMockTransaction({ budgetLine: 'Debit Card', reconciledAt: Date.now() }),
      });
      expect(screen.getByText('Reconciled')).toBeInTheDocument();
      expect(screen.queryByText('Not Reconciled')).not.toBeInTheDocument();
    });

    test('shows an empty dash for a transaction outside the Debit Card budget line with no payment status', () => {
      renderRow({
        t: buildMockTransaction({ type: 'Deposit', budgetLine: 'Operating' }),
      });
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    test('a Deposit (reload) on the Debit Card line shows payment status, not a reconciliation badge', () => {
      renderRow({
        canEdit: false,
        t: buildMockTransaction({
          type: 'Deposit',
          budgetLine: 'Debit Card',
          paymentStatus: 'Approved',
        }),
      });
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.queryByText('Not Reconciled')).not.toBeInTheDocument();
      expect(screen.queryByText('Reconciled')).not.toBeInTheDocument();
    });
  });

  describe('payment status', () => {
    test('does not show a payment-status control for Debit Card transactions', () => {
      renderRow({
        canEdit: true,
        t: buildMockTransaction({ type: 'Debit card purchase' }),
      });
      expect(screen.queryByLabelText('Payment status')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    });

    test('defaults to Pending when a Direct Payment transaction has no status set', () => {
      renderRow({
        canEdit: false,
        t: buildMockTransaction({
          type: 'Direct payment',
          budgetLine: 'Operating',
          paymentStatus: undefined,
        }),
      });
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    test('shows a read-only badge (not a select) when the viewer cannot edit', () => {
      renderRow({
        canEdit: false,
        t: buildMockTransaction({
          type: 'Reimbursement',
          budgetLine: 'Operating',
          paymentStatus: 'Approved',
        }),
      });
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.queryByLabelText('Payment status')).not.toBeInTheDocument();
    });

    test('shows an editable select for Treasurer/President with no pending change', () => {
      renderRow({
        canEdit: true,
        t: buildMockTransaction({
          type: 'Reimbursement',
          budgetLine: 'Operating',
          paymentStatus: 'Paid',
        }),
      });
      expect(screen.getByLabelText('Payment status')).toHaveValue('Paid');
    });

    test('shows an editable select for a Debit Card reload deposit, with no Approved option', () => {
      renderRow({
        canEdit: true,
        t: buildMockTransaction({
          type: 'Deposit',
          budgetLine: 'Debit Card',
          paymentStatus: 'Pending',
        }),
      });
      const select = screen.getByLabelText('Payment status');
      expect(select).toHaveValue('Pending');
      expect(screen.queryByText('Approved')).not.toBeInTheDocument();
      expect(screen.getByText('Reloaded')).toBeInTheDocument();
    });

    test('labels a Paid reload deposit as "Reloaded" rather than "Paid"', () => {
      renderRow({
        canEdit: false,
        t: buildMockTransaction({
          type: 'Deposit',
          budgetLine: 'Debit Card',
          paymentStatus: 'Paid',
        }),
      });
      expect(screen.getByText('Reloaded')).toBeInTheDocument();
      expect(screen.queryByText('Paid')).not.toBeInTheDocument();
    });

    test('falls back to a read-only badge while a pending edit/delete exists', () => {
      renderRow({
        canEdit: true,
        t: buildMockTransaction({
          type: 'Direct payment',
          budgetLine: 'Operating',
          paymentStatus: 'Pending',
        }),
        pending: buildMockPendingChange(),
      });
      expect(screen.queryByLabelText('Payment status')).not.toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    test('changing the select calls onUpdatePaymentStatus with the transaction id and new status', () => {
      const onUpdatePaymentStatus = vi.fn().mockResolvedValue(undefined);
      const t = buildMockTransaction({
        id: 'txn-42',
        type: 'Direct payment',
        budgetLine: 'Operating',
        paymentStatus: 'Pending',
      });
      renderRow({ canEdit: true, t, onUpdatePaymentStatus });
      fireEvent.change(screen.getByLabelText('Payment status'), {
        target: { value: 'Approved' },
      });
      expect(onUpdatePaymentStatus).toHaveBeenCalledWith('txn-42', 'Approved');
    });
  });

  describe('pending changes', () => {
    test('shows "Awaiting Approval" with a Cancel button for the requester\'s own pending change', () => {
      mockUseAuth.mockReturnValue({
        user: buildMockUser({ email: 'requester@example.com' }),
        loading: false,
        sendLoginLink: vi.fn(),
      });
      const pending = buildMockPendingChange({ requestedBy: 'requester@example.com' });
      renderRow({ canEdit: true, pending });
      expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    });

    test('shows Approve/Reject for a pending change from someone else', () => {
      const pending = buildMockPendingChange({ requestedBy: 'someone-else@example.com' });
      renderRow({ canEdit: true, pending });
      expect(screen.getByText('Approve')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    test('does not show approve/reject when the viewer cannot edit', () => {
      const pending = buildMockPendingChange({ requestedBy: 'someone-else@example.com' });
      renderRow({ canEdit: false, pending });
      expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    });

    test('clicking Approve calls onApprove with the pending id', () => {
      const onApprove = vi.fn().mockResolvedValue(undefined);
      const pending = buildMockPendingChange({
        id: 'pending-42',
        requestedBy: 'someone-else@example.com',
      });
      renderRow({ canEdit: true, pending, onApprove });
      fireEvent.click(screen.getByText('Approve'));
      expect(onApprove).toHaveBeenCalledWith('pending-42');
    });

    test('clicking Cancel calls onCancel with the pending id', () => {
      const onCancel = vi.fn().mockResolvedValue(undefined);
      mockUseAuth.mockReturnValue({
        user: buildMockUser({ email: 'requester@example.com' }),
        loading: false,
        sendLoginLink: vi.fn(),
      });
      const pending = buildMockPendingChange({
        id: 'pending-7',
        requestedBy: 'requester@example.com',
      });
      renderRow({ canEdit: true, pending, onCancel });
      fireEvent.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledWith('pending-7');
    });

    test('"View details" toggles a before/after diff for edit-type pending changes', () => {
      const pending = buildMockPendingChange({
        type: 'edit',
        requestedBy: 'someone-else@example.com',
        before: buildMockTransaction({ amount: 10 }),
        after: buildMockTransaction({ amount: 20 }),
      });
      renderRow({ canEdit: true, pending });
      expect(screen.queryByText('Before')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('View details'));
      expect(screen.getByText('Before')).toBeInTheDocument();
      expect(screen.getByText('After')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    test('shows a delete-warning message for delete-type pending changes when viewing details', () => {
      const pending = buildMockPendingChange({
        type: 'delete',
        requestedBy: 'someone-else@example.com',
      });
      renderRow({ canEdit: true, pending });
      expect(screen.queryByText('View details')).not.toBeInTheDocument();
      expect(screen.getByText('Delete requested')).toBeInTheDocument();
    });

    test('disables action buttons while an action is in flight', async () => {
      let resolveApprove: () => void = () => {};
      const onApprove = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveApprove = resolve;
          }),
      );
      const pending = buildMockPendingChange({ requestedBy: 'someone-else@example.com' });
      renderRow({ canEdit: true, pending, onApprove });

      fireEvent.click(screen.getByText('Approve'));
      expect(await screen.findAllByText('…')).toHaveLength(2);

      resolveApprove();
      await screen.findByText('Approve');
    });
  });
});
