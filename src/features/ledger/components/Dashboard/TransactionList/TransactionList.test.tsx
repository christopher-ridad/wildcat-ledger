import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { buildMockTransaction, buildMockUser } from '../../../../../test/mocks';
import { useAuth } from '../../../../authentication/hooks/useAuth';
import { useLedger } from '../../../hooks/useLedger';
import { TransactionList } from './TransactionList';

vi.mock('../../../hooks/useLedger');
vi.mock('../../../../authentication/hooks/useAuth');
vi.mock('../TransactionModal', () => ({
  TransactionModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="transaction-modal">
        <button onClick={onClose}>Close edit modal</button>
      </div>
    ) : null,
}));
vi.mock('../TransactionFilesModal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../TransactionFilesModal')>()),
  TransactionFilesModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="files-modal">
      <button onClick={onClose}>Close files modal</button>
    </div>
  ),
}));

const mockUseLedger = vi.mocked(useLedger);
const mockUseAuth = vi.mocked(useAuth);

const baseLedger = {
  filteredTransactions: [] as ReturnType<typeof buildMockTransaction>[],
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  userRole: 'sofoApprover' as const,
  canEdit: true,
  pendingChangeForTransaction: vi.fn(() => undefined),
  approvePendingChange: vi.fn().mockResolvedValue(undefined),
  rejectPendingChange: vi.fn().mockResolvedValue(undefined),
  cancelPendingChange: vi.fn().mockResolvedValue(undefined),
  updatePaymentStatus: vi.fn().mockResolvedValue(undefined),
};

describe('TransactionList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: buildMockUser(),
      loading: false,
      sendLoginLink: vi.fn(),
    });
  });

  test('shows an empty state when there are no matching transactions', () => {
    mockUseLedger.mockReturnValue({ ...baseLedger, filteredTransactions: [] } as never);
    render(<TransactionList />);
    expect(screen.getByText('No transactions match this filter.')).toBeInTheDocument();
  });

  test('renders a table row per transaction and an Actions column when the viewer can edit', () => {
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      userRole: 'sofoApprover',
      canEdit: true,
      filteredTransactions: [
        buildMockTransaction({ id: 't1', title: 'Pizza' }),
        buildMockTransaction({ id: 't2', title: 'Banners' }),
      ],
    } as never);
    render(<TransactionList />);
    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.getByText('Banners')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  test('hides the Actions column for officers who cannot edit', () => {
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      userRole: 'officer',
      canEdit: false,
      filteredTransactions: [buildMockTransaction()],
    } as never);
    render(<TransactionList />);
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
  });

  test('clicking delete shows an inline confirmation, and confirming calls deleteTransaction', () => {
    const deleteTransaction = vi.fn().mockResolvedValue(undefined);
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      userRole: 'sofoApprover',
      canEdit: true,
      deleteTransaction,
      filteredTransactions: [buildMockTransaction({ id: 't1', title: 'Pizza' })],
    } as never);
    render(<TransactionList />);

    fireEvent.click(screen.getByLabelText('Delete transaction'));
    expect(screen.getByText(/Submit a delete request for/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Submit Request'));
    expect(deleteTransaction).toHaveBeenCalledWith('t1');
  });

  test('clicking Cancel on the delete confirmation dismisses it without deleting', () => {
    const deleteTransaction = vi.fn().mockResolvedValue(undefined);
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      userRole: 'sofoApprover',
      canEdit: true,
      deleteTransaction,
      filteredTransactions: [buildMockTransaction({ id: 't1', title: 'Pizza' })],
    } as never);
    render(<TransactionList />);

    fireEvent.click(screen.getByLabelText('Delete transaction'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText(/Submit a delete request for/)).not.toBeInTheDocument();
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  test('opens the TransactionModal when a row requests edit, and closing it clears the editing state', () => {
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      userRole: 'sofoApprover',
      canEdit: true,
      filteredTransactions: [buildMockTransaction({ id: 't1', title: 'Pizza' })],
    } as never);
    render(<TransactionList />);

    expect(screen.queryByTestId('transaction-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Edit transaction'));
    expect(screen.getByTestId('transaction-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close edit modal'));
    expect(screen.queryByTestId('transaction-modal')).not.toBeInTheDocument();
  });

  test('opens the files modal when a row requests it, and closing it dismisses it', () => {
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      userRole: 'sofoApprover',
      canEdit: true,
      filteredTransactions: [
        buildMockTransaction({
          id: 't1',
          title: 'Pizza',
          receiptFileUrl: 'orgs/1/receipt.png',
        }),
      ],
    } as never);
    render(<TransactionList />);

    expect(screen.queryByTestId('files-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('View 1 attached file'));
    expect(screen.getByTestId('files-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close files modal'));
    expect(screen.queryByTestId('files-modal')).not.toBeInTheDocument();
  });

  test("changing a row's payment status calls updatePaymentStatus", () => {
    const updatePaymentStatus = vi.fn().mockResolvedValue(undefined);
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      userRole: 'sofoApprover',
      canEdit: true,
      updatePaymentStatus,
      filteredTransactions: [
        buildMockTransaction({
          id: 't1',
          type: 'Payment Request',
          budgetLine: 'Operating',
          paymentStatus: 'Pending',
        }),
      ],
    } as never);
    render(<TransactionList />);

    fireEvent.change(screen.getByLabelText('Payment status'), {
      target: { value: 'Approved' },
    });
    expect(updatePaymentStatus).toHaveBeenCalledWith('t1', 'Approved');
  });
});
