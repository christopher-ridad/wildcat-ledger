import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { useLedger } from '../features/ledger/hooks/useLedger';
import { parseBudgetAllocation } from '../features/ledger/services/parseBudgetAllocation';
import { buildMockOrganization, MockAuthProvider, renderWithRouter } from '../test/mocks';
import { CreateOrganization } from './CreateOrganization';

vi.mock('../features/ledger/hooks/useLedger');
vi.mock('../features/ledger/services/parseBudgetAllocation');

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const mockUseLedger = vi.mocked(useLedger);
const mockParseBudgetAllocation = vi.mocked(parseBudgetAllocation);

const renderPage = () => renderWithRouter(<CreateOrganization />);

describe('CreateOrganization', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.clearAllMocks();
  });

  // Belt-and-suspenders for the fake-timers test below -- if it ever fails
  // partway through, this still restores real timers so the failure doesn't
  // cascade into every test that runs after it in this file.
  afterEach(() => {
    vi.useRealTimers();
  });

  test('redirects to /organizations when there is no active organization', () => {
    mockUseLedger.mockReturnValue({
      activeOrganization: null,
      initializeBudgetAllocations: vi.fn(),
      loading: false,
    } as never);
    renderPage();
    expect(navigateMock).toHaveBeenCalledWith('/organizations', { replace: true });
  });

  test('does not redirect while the ledger is still loading, even with no active organization yet', () => {
    mockUseLedger.mockReturnValue({
      activeOrganization: null,
      initializeBudgetAllocations: vi.fn(),
      loading: true,
    } as never);
    renderPage();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  test('redirects to /dashboard when budget lines are already set', () => {
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: true }),
      initializeBudgetAllocations: vi.fn(),
      loading: false,
      canEdit: true,
    } as never);
    renderPage();
    expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  // Regression test: reported live -- someone was listed as an Officer, not
  // a SOFO Approver, and reached this page, scanned a document, and only
  // found out at save time (via a permission error) that they never had
  // access. Checked up front now instead.
  test('blocks an Officer (non-SOFO-Approver) from the budget setup page, naming who to ask', () => {
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({
        isBudgetLinesSet: false,
        sofoApprovers: ['treasurer@example.com', 'president@example.com'],
      }),
      initializeBudgetAllocations: vi.fn(),
      loading: false,
      canEdit: false,
      peopleNames: { 'treasurer@example.com': 'Jane Treasurer' },
    } as never);
    renderPage();

    expect(
      screen.getByText(/Only a SOFO Approver can set up this organization/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Jane Treasurer/)).toBeInTheDocument();
    expect(screen.getByText(/president@example.com/)).toBeInTheDocument();
    expect(screen.queryByText('Click to upload budget document')).not.toBeInTheDocument();
  });

  test('tells an Officer to contact an administrator when the org has no SOFO Approvers listed', () => {
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({
        isBudgetLinesSet: false,
        sofoApprovers: [],
      }),
      initializeBudgetAllocations: vi.fn(),
      loading: false,
      canEdit: false,
      peopleNames: {},
    } as never);
    renderPage();

    expect(screen.getByText(/contact an administrator/)).toBeInTheDocument();
  });

  test('uploading a document scans it and shows the allocation form on success', async () => {
    mockParseBudgetAllocation.mockResolvedValue({ ASG: 100, Operating: 200, Gifts: 50 });
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: false }),
      initializeBudgetAllocations: vi.fn(),
      canEdit: true,
    } as never);
    const { container } = renderPage();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'budget.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText(/Review and confirm extracted amounts/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('ASG')).toHaveValue('100.00');
    expect(screen.getByText('Save & Continue')).toBeInTheDocument();
  });

  test('shows a scan error and allows manual entry when the scan fails', async () => {
    mockParseBudgetAllocation.mockRejectedValue(new Error('Could not read document'));
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: false }),
      initializeBudgetAllocations: vi.fn(),
      canEdit: true,
    } as never);
    const { container } = renderPage();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'budget.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText(/Could not read document.*enter amounts manually below/),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter amounts manually:')).toBeInTheDocument();
    expect(screen.getByLabelText('ASG')).not.toBeDisabled();
  });

  test('manual allocation input rejects malformed values and accepts valid ones', async () => {
    mockParseBudgetAllocation.mockRejectedValue(new Error('scan failed'));
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: false }),
      initializeBudgetAllocations: vi.fn(),
      canEdit: true,
    } as never);
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'budget.png', { type: 'image/png' })] },
    });
    await screen.findByText('Enter amounts manually:');

    const asgInput = screen.getByLabelText('ASG');
    fireEvent.change(asgInput, { target: { value: 'abc' } });
    expect(asgInput).toHaveValue('');

    fireEvent.change(asgInput, { target: { value: '123.45' } });
    expect(asgInput).toHaveValue('123.45');
  });

  test('submitting saves the allocations, then navigates to /dashboard once the ledger confirms isBudgetLinesSet', async () => {
    const initializeBudgetAllocations = vi.fn().mockResolvedValue(undefined);
    mockParseBudgetAllocation.mockResolvedValue({ ASG: 100, Operating: 200, Gifts: 50 });
    const org = buildMockOrganization({ isBudgetLinesSet: false });
    mockUseLedger.mockReturnValue({
      activeOrganization: org,
      initializeBudgetAllocations,
      loading: false,
      canEdit: true,
    } as never);
    const { container, rerender } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'budget.png', { type: 'image/png' })] },
    });
    await screen.findByText('Save & Continue');

    await act(async () => {
      fireEvent.click(screen.getByText('Save & Continue'));
    });

    expect(initializeBudgetAllocations).toHaveBeenCalledWith({
      ASG: 100,
      Operating: 200,
      Gifts: 50,
      'Debit Card': 0,
    });

    // The save resolving is not, by itself, enough to navigate -- it only
    // confirms the database write, not that this client's own ledger state
    // (Realtime-sourced in the real app) has caught up. Regression test for
    // the bug where the Dashboard would mount on the stale, pre-save
    // organization (every budget line reading $0) because the app navigated
    // right after the save promise resolved instead of waiting for this.
    expect(navigateMock).not.toHaveBeenCalledWith('/dashboard', { replace: true });

    // Simulate the ledger's own state catching up, the way a real Realtime
    // update would.
    mockUseLedger.mockReturnValue({
      activeOrganization: { ...org, isBudgetLinesSet: true },
      initializeBudgetAllocations,
      loading: false,
      canEdit: true,
    } as never);
    rerender(
      <MemoryRouter>
        <MockAuthProvider>
          <CreateOrganization />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  test('shows a fallback message if the ledger never confirms the save', async () => {
    // Fake timers so this doesn't actually wait out the real 10s fallback
    // delay. Deliberately not using screen.findByText/waitFor below --
    // their polling relies on real timers and hangs once those are faked --
    // every state update is instead flushed explicitly via act() and
    // asserted on synchronously.
    vi.useFakeTimers();
    const initializeBudgetAllocations = vi.fn().mockResolvedValue(undefined);
    mockParseBudgetAllocation.mockResolvedValue({ ASG: 100, Operating: 200, Gifts: 50 });
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: false }),
      initializeBudgetAllocations,
      loading: false,
      canEdit: true,
    } as never);
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(['x'], 'budget.png', { type: 'image/png' })] },
      });
    });
    expect(screen.getByText('Save & Continue')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Save & Continue'));
    });
    expect(initializeBudgetAllocations).toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByText(/taking longer than expected/)).toBeInTheDocument();
    expect(screen.getByText('Save & Continue')).not.toBeDisabled();
  });

  test('shows the underlying error message when saving fails', async () => {
    const initializeBudgetAllocations = vi.fn().mockRejectedValue(new Error('boom'));
    mockParseBudgetAllocation.mockResolvedValue({ ASG: 100, Operating: 200, Gifts: 50 });
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: false }),
      initializeBudgetAllocations,
      canEdit: true,
    } as never);
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'budget.png', { type: 'image/png' })] },
    });
    await screen.findByText('Save & Continue');
    fireEvent.click(screen.getByText('Save & Continue'));

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  test('falls back to a generic message when the error has nothing usable', async () => {
    const initializeBudgetAllocations = vi
      .fn()
      .mockRejectedValue('not an Error instance');
    mockParseBudgetAllocation.mockResolvedValue({ ASG: 100, Operating: 200, Gifts: 50 });
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: false }),
      initializeBudgetAllocations,
      canEdit: true,
    } as never);
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'budget.png', { type: 'image/png' })] },
    });
    await screen.findByText('Save & Continue');
    fireEvent.click(screen.getByText('Save & Continue'));

    expect(
      await screen.findByText('Failed to save budget allocations. Please try again.'),
    ).toBeInTheDocument();
  });

  test('"Upload a different image" resets the form back to idle', async () => {
    mockParseBudgetAllocation.mockResolvedValue({ ASG: 100, Operating: 200, Gifts: 50 });
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: false }),
      initializeBudgetAllocations: vi.fn(),
      canEdit: true,
    } as never);
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'budget.png', { type: 'image/png' })] },
    });
    await screen.findByText('Upload a different image');

    fireEvent.click(screen.getByText('Upload a different image'));

    expect(screen.getByText('Click to upload budget document')).toBeInTheDocument();
    expect(screen.queryByText('Save & Continue')).not.toBeInTheDocument();
  });
});
