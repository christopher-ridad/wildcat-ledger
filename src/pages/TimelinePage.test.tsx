import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useLedger } from '../features/ledger/hooks/useLedger';
import {
  buildMockFinancialTask,
  buildMockOrganization,
  renderWithRouter,
} from '../test/mocks';
import { TimelinePage } from './TimelinePage';

vi.mock('../features/ledger/hooks/useLedger');

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const mockUseLedger = vi.mocked(useLedger);

const baseLedger = {
  financialTasks: [] as ReturnType<typeof buildMockFinancialTask>[],
  activeOrganization: null,
  peopleNames: {},
  canEdit: true,
  addFinancialTask: vi.fn().mockResolvedValue(undefined),
  updateFinancialTask: vi.fn().mockResolvedValue(undefined),
  deleteFinancialTask: vi.fn().mockResolvedValue(undefined),
  toggleFinancialTaskComplete: vi.fn().mockResolvedValue(undefined),
};

const renderPage = () => renderWithRouter(<TimelinePage />);

describe('TimelinePage', () => {
  beforeEach(() => navigateMock.mockClear());

  test('renders the Timeline heading and an empty state with no tasks', () => {
    mockUseLedger.mockReturnValue(baseLedger as never);
    renderPage();
    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeInTheDocument();
    expect(screen.getByText(/No tasks yet/)).toBeInTheDocument();
  });

  test('shows the active organization name badge when set', () => {
    mockUseLedger.mockReturnValue({
      ...baseLedger,
      activeOrganization: buildMockOrganization({ name: 'Wildcat Club' }),
    } as never);
    renderPage();
    expect(screen.getByText('Wildcat Club')).toBeInTheDocument();
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
});
