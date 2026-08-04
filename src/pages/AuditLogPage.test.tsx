import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useLedger } from '../features/ledger/hooks/useLedger';
import { buildMockAuditEntry, buildMockOrganization } from '../test/mocks';
import { AuditLogPage } from './AuditLogPage';

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
      <AuditLogPage />
    </MemoryRouter>,
  );

describe('AuditLogPage', () => {
  beforeEach(() => navigateMock.mockClear());

  test('shows an empty state when there is no audit history', () => {
    mockUseLedger.mockReturnValue({ auditLog: [], activeOrganization: null } as never);
    renderPage();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  test('renders one card per audit entry with a pluralized count', () => {
    mockUseLedger.mockReturnValue({
      auditLog: [
        buildMockAuditEntry({ id: 'a1', transactionTitle: 'Pizza' }),
        buildMockAuditEntry({ id: 'a2', transactionTitle: 'Banners' }),
      ],
      activeOrganization: null,
    } as never);
    renderPage();
    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.getByText('Banners')).toBeInTheDocument();
    expect(screen.getByText('2 entries')).toBeInTheDocument();
  });

  test('uses singular "entry" for exactly one item', () => {
    mockUseLedger.mockReturnValue({
      auditLog: [buildMockAuditEntry()],
      activeOrganization: null,
    } as never);
    renderPage();
    expect(screen.getByText('1 entry')).toBeInTheDocument();
  });

  test('shows the active organization name badge when set', () => {
    mockUseLedger.mockReturnValue({
      auditLog: [],
      activeOrganization: buildMockOrganization({ name: 'Wildcat Club' }),
    } as never);
    renderPage();
    expect(screen.getByText('Wildcat Club')).toBeInTheDocument();
  });

  test('"Back to Dashboard" navigates to /dashboard', () => {
    mockUseLedger.mockReturnValue({ auditLog: [], activeOrganization: null } as never);
    renderPage();
    fireEvent.click(screen.getByText('← Back to Dashboard'));
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });
});
