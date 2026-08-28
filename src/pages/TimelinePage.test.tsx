import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useAuth } from '../features/authentication/hooks/useAuth';
import { useLedger } from '../features/ledger/hooks/useLedger';
import {
  buildMockFinancialTask,
  buildMockOrganization,
  renderWithRouter,
} from '../test/mocks';
import { TimelinePage } from './TimelinePage';

vi.mock('../features/authentication/hooks/useAuth');
vi.mock('../features/ledger/hooks/useLedger');

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const mockUseAuth = vi.mocked(useAuth);
const mockUseLedger = vi.mocked(useLedger);

const baseLedger = {
  financialTasks: [] as ReturnType<typeof buildMockFinancialTask>[],
  financialTaskRequirements: [],
  activeOrganization: null,
  peopleNames: {},
  canEdit: true,
  addFinancialTask: vi.fn().mockResolvedValue(undefined),
  updateFinancialTask: vi.fn().mockResolvedValue(undefined),
  deleteFinancialTask: vi.fn().mockResolvedValue(undefined),
  toggleFinancialTaskComplete: vi.fn().mockResolvedValue(undefined),
  toggleFinancialTaskRequirement: vi.fn().mockResolvedValue(undefined),
};

const renderPage = () => renderWithRouter(<TimelinePage />);

describe('TimelinePage', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    } as never);
  });

  test('renders the Financial Tasks heading and an empty state with no tasks', () => {
    mockUseLedger.mockReturnValue(baseLedger as never);
    renderPage();
    expect(screen.getByRole('heading', { name: 'Financial Tasks' })).toBeInTheDocument();
    expect(screen.getByText('No tasks this quarter.')).toBeInTheDocument();
  });

  test('shows the active organization name and SOFO approvers in the header', () => {
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      activeOrganization: buildMockOrganization({
        name: 'Wildcat Club',
        sofoApprovers: ['approver@u.northwestern.edu'],
      }),
      peopleNames: { 'approver@u.northwestern.edu': 'Jane Approver' },
    } as never);
    renderPage();
    expect(screen.getByText('Wildcat Club')).toBeInTheDocument();
    expect(screen.getByText('SOFO Approvers: Jane Approver')).toBeInTheDocument();
  });

  test('renders financial tasks via the TimelineBoard', () => {
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      financialTasks: [
        buildMockFinancialTask({ title: 'Submit Contract', dueDate: '2026-09-05' }),
      ],
    } as never);
    renderPage();
    expect(screen.getByText('Submit Contract')).toBeInTheDocument();
  });

  test('"Back to Dashboard" navigates to /dashboard', () => {
    mockUseLedger.mockReturnValue(baseLedger as never);
    renderPage();
    fireEvent.click(screen.getByText('← Back to Dashboard'));
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  test('"Audit History" navigates to /audit-log', () => {
    mockUseLedger.mockReturnValue(baseLedger as never);
    renderPage();
    fireEvent.click(screen.getByText('Audit History'));
    expect(navigateMock).toHaveBeenCalledWith('/audit-log');
  });

  test('"Sign Out" calls signOut', () => {
    const signOut = vi.fn();
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut,
    } as never);
    mockUseLedger.mockReturnValue(baseLedger as never);
    renderPage();
    fireEvent.click(screen.getByText('Sign Out'));
    expect(signOut).toHaveBeenCalled();
  });
});
