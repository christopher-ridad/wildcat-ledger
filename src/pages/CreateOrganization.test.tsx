import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useLedger } from '../features/ledger/hooks/useLedger';
import { parseBudgetAllocation } from '../features/ledger/services/parseBudgetAllocation';
import { buildMockOrganization } from '../test/mocks';
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

const renderPage = () =>
  render(
    <MemoryRouter>
      <CreateOrganization />
    </MemoryRouter>,
  );

describe('CreateOrganization', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.clearAllMocks();
  });

  test('redirects to /organizations when there is no active organization', () => {
    mockUseLedger.mockReturnValue({
      activeOrganization: null,
      initializeBudgetAllocations: vi.fn(),
    } as never);
    renderPage();
    expect(navigateMock).toHaveBeenCalledWith('/organizations', { replace: true });
  });

  test('redirects to /dashboard when budget lines are already set', () => {
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: true }),
      initializeBudgetAllocations: vi.fn(),
    } as never);
    renderPage();
    expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  test('uploading a document scans it and shows the allocation form on success', async () => {
    mockParseBudgetAllocation.mockResolvedValue({ ASG: 100, Operating: 200, Gifts: 50 });
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: false }),
      initializeBudgetAllocations: vi.fn(),
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

  test('submitting saves the allocations and navigates to /dashboard', async () => {
    const initializeBudgetAllocations = vi.fn().mockResolvedValue(undefined);
    mockParseBudgetAllocation.mockResolvedValue({ ASG: 100, Operating: 200, Gifts: 50 });
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: false }),
      initializeBudgetAllocations,
    } as never);
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'budget.png', { type: 'image/png' })] },
    });
    await screen.findByText('Save & Continue');

    fireEvent.click(screen.getByText('Save & Continue'));

    await vi.waitFor(() =>
      expect(initializeBudgetAllocations).toHaveBeenCalledWith({
        ASG: 100,
        Operating: 200,
        Gifts: 50,
        'Debit Card': 0,
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  test('shows an error message when saving fails', async () => {
    const initializeBudgetAllocations = vi.fn().mockRejectedValue(new Error('boom'));
    mockParseBudgetAllocation.mockResolvedValue({ ASG: 100, Operating: 200, Gifts: 50 });
    mockUseLedger.mockReturnValue({
      activeOrganization: buildMockOrganization({ isBudgetLinesSet: false }),
      initializeBudgetAllocations,
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
