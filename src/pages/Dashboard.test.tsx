import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useLedger } from '../features/ledger/hooks/useLedger';
import { buildMockOrganization } from '../test/mocks';
import { Dashboard } from './Dashboard';

vi.mock('../features/ledger/hooks/useLedger');
vi.mock('../features/ledger/components/Dashboard/TransactionList', () => ({
  TransactionList: () => <div data-testid="transaction-list" />,
}));
vi.mock('../features/ledger/components/Dashboard/TransactionModal', () => ({
  TransactionModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="transaction-modal" /> : null,
}));
vi.mock('../features/ledger/components/Dashboard/ReconciliationModal', () => ({
  ReconciliationModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="reconciliation-modal" /> : null,
}));
vi.mock('../features/ledger/components/Dashboard/DebitCardSettingsModal', () => ({
  DebitCardSettingsModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="debit-card-settings-modal" /> : null,
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const mockUseLedger = vi.mocked(useLedger);

const baseLedger = {
  budgetLineSummaries: [
    { line: 'ASG' as const, balance: 100, inflow: 0, outflow: 0 },
    { line: 'Operating' as const, balance: -50, inflow: 0, outflow: 0 },
  ],
  selectedBudgetLine: null,
  setSelectedBudgetLine: vi.fn(),
  activeOrganization: buildMockOrganization({ name: 'Wildcat Club' }),
  userRole: 'treasurer' as const,
  loading: false,
};

describe('Dashboard', () => {
  beforeEach(() => navigateMock.mockClear());

  test('redirects to /organizations when there is no active organization', () => {
    mockUseLedger.mockReturnValue({ ...baseLedger, activeOrganization: null } as never);
    render(<Dashboard />);
    expect(navigateMock).toHaveBeenCalledWith('/organizations', { replace: true });
  });

  test('does not redirect while the ledger is still loading, even with no active organization yet', () => {
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      activeOrganization: null,
      loading: true,
    } as never);
    render(<Dashboard />);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  test('renders the organization name and budget line summaries', () => {
    mockUseLedger.mockReturnValue(baseLedger as never);
    render(<Dashboard />);
    expect(screen.getByRole('heading', { name: 'Wildcat Club' })).toBeInTheDocument();
    // Each summary appears once in the sidebar filter and once in the overview card.
    expect(screen.getAllByText('ASG')).toHaveLength(2);
    expect(screen.getAllByText('$100.00')).toHaveLength(2);
    expect(screen.getAllByText('-$50.00')).toHaveLength(2);
  });

  test('shows Add Transaction and Reconcile buttons for a treasurer', () => {
    mockUseLedger.mockReturnValue(baseLedger as never);
    render(<Dashboard />);
    expect(screen.getByText('+ Add Transaction')).toBeInTheDocument();
    expect(screen.getByText('Reconcile Debit Card')).toBeInTheDocument();
  });

  test('hides Add Transaction and Reconcile buttons for an officer', () => {
    mockUseLedger.mockReturnValue({ ...baseLedger, userRole: 'officer' } as never);
    render(<Dashboard />);
    expect(screen.queryByText('+ Add Transaction')).not.toBeInTheDocument();
    expect(screen.queryByText('Reconcile Debit Card')).not.toBeInTheDocument();
    expect(screen.queryByText('⚙ SOFO / CO Settings')).not.toBeInTheDocument();
  });

  test('clicking a budget line filter selects it', () => {
    const setSelectedBudgetLine = vi.fn();
    mockUseLedger.mockReturnValue({ ...baseLedger, setSelectedBudgetLine } as never);
    render(<Dashboard />);
    fireEvent.click(screen.getAllByText('ASG')[0]);
    expect(setSelectedBudgetLine).toHaveBeenCalledWith('ASG');
  });

  test('"All Transactions" clears the selected budget line', () => {
    const setSelectedBudgetLine = vi.fn();
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      selectedBudgetLine: 'ASG',
      setSelectedBudgetLine,
    } as never);
    render(<Dashboard />);
    fireEvent.click(screen.getByText('All Transactions'));
    expect(setSelectedBudgetLine).toHaveBeenCalledWith(null);
  });

  test('opens the Add Transaction modal', () => {
    mockUseLedger.mockReturnValue(baseLedger as never);
    render(<Dashboard />);
    expect(screen.queryByTestId('transaction-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('+ Add Transaction'));
    expect(screen.getByTestId('transaction-modal')).toBeInTheDocument();
  });

  test('opens the Reconciliation modal', () => {
    mockUseLedger.mockReturnValue(baseLedger as never);
    render(<Dashboard />);
    expect(screen.queryByTestId('reconciliation-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Reconcile Debit Card'));
    expect(screen.getByTestId('reconciliation-modal')).toBeInTheDocument();
  });

  test('opens the SOFO/CO Settings modal', () => {
    mockUseLedger.mockReturnValue(baseLedger as never);
    render(<Dashboard />);
    expect(screen.queryByTestId('debit-card-settings-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('⚙ SOFO / CO Settings'));
    expect(screen.getByTestId('debit-card-settings-modal')).toBeInTheDocument();
  });

  test('"Audit History" navigates to /audit-log', () => {
    mockUseLedger.mockReturnValue(baseLedger as never);
    render(<Dashboard />);
    fireEvent.click(screen.getByText('Audit History'));
    expect(navigateMock).toHaveBeenCalledWith('/audit-log');
  });

  test('"← Back" navigates to /organizations', () => {
    mockUseLedger.mockReturnValue(baseLedger as never);
    render(<Dashboard />);
    fireEvent.click(screen.getByText('← Back'));
    expect(navigateMock).toHaveBeenCalledWith('/organizations');
  });
});
