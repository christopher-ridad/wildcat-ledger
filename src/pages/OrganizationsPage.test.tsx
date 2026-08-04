import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useLedger } from '../features/ledger/hooks/useLedger';
import { buildMockOrganization } from '../test/mocks';
import { OrganizationsPage } from './OrganizationsPage';

vi.mock('../features/ledger/hooks/useLedger');

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const mockUseLedger = vi.mocked(useLedger);

const renderPage = () =>
  render(
    <MemoryRouter>
      <OrganizationsPage />
    </MemoryRouter>,
  );

describe('OrganizationsPage', () => {
  beforeEach(() => navigateMock.mockClear());

  test('shows an empty state when the user has no organizations', () => {
    mockUseLedger.mockReturnValue({
      organizations: [],
      setActiveOrganizationId: vi.fn(),
    } as never);
    renderPage();
    expect(
      screen.getByText('No organizations found for your account.'),
    ).toBeInTheDocument();
  });

  test('lists each organization by name', () => {
    mockUseLedger.mockReturnValue({
      organizations: [
        buildMockOrganization({ id: 'org-1', name: 'Wildcat Club' }),
        buildMockOrganization({ id: 'org-2', name: 'Debate Team' }),
      ],
      setActiveOrganizationId: vi.fn(),
    } as never);
    renderPage();
    expect(screen.getByText('Wildcat Club')).toBeInTheDocument();
    expect(screen.getByText('Debate Team')).toBeInTheDocument();
  });

  test('selecting an org with budget lines set navigates to the dashboard', () => {
    const setActiveOrganizationId = vi.fn();
    mockUseLedger.mockReturnValue({
      organizations: [
        buildMockOrganization({
          id: 'org-1',
          name: 'Wildcat Club',
          isBudgetLinesSet: true,
        }),
      ],
      setActiveOrganizationId,
    } as never);
    renderPage();
    fireEvent.click(screen.getByText('Wildcat Club'));
    expect(setActiveOrganizationId).toHaveBeenCalledWith('org-1');
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  test('selecting an org without budget lines set navigates to budget setup', () => {
    const setActiveOrganizationId = vi.fn();
    mockUseLedger.mockReturnValue({
      organizations: [
        buildMockOrganization({ id: 'org-2', name: 'New Club', isBudgetLinesSet: false }),
      ],
      setActiveOrganizationId,
    } as never);
    renderPage();
    fireEvent.click(screen.getByText('New Club'));
    expect(setActiveOrganizationId).toHaveBeenCalledWith('org-2');
    expect(navigateMock).toHaveBeenCalledWith('/budget-setup');
  });
});
