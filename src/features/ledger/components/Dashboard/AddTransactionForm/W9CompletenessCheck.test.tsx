import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { supabase } from '../../../../../config/supabase';
import { W9CompletenessCheck } from './W9CompletenessCheck';

vi.mock('../../../../../config/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      getPage: vi.fn(() =>
        Promise.resolve({
          getViewport: () => ({ width: 200, height: 260 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
      ),
    }),
  })),
}));

const mockInvoke = vi.mocked(supabase.functions.invoke);
const file = new File(['%PDF-1.4'], 'w9.pdf', { type: 'application/pdf' });

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom doesn't implement canvas 2D rendering -- stub just enough of the
  // context surface this component actually calls.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    strokeRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe('W9CompletenessCheck', () => {
  test('renders nothing when there is no file', () => {
    const { container } = render(
      <W9CompletenessCheck file={null} onBlockingChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('shows "Looks complete" and does not block when there are no flags', async () => {
    mockInvoke.mockResolvedValue({ data: { flags: [] }, error: null } as never);
    const onBlockingChange = vi.fn();
    render(<W9CompletenessCheck file={file} onBlockingChange={onBlockingChange} />);

    expect(await screen.findByText('✓ Looks complete.')).toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('shows each flag and blocks until acknowledged', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        flags: [{ label: 'Date', message: 'Signature date looks blank.', box: null }],
      },
      error: null,
    } as never);
    const onBlockingChange = vi.fn();
    render(<W9CompletenessCheck file={file} onBlockingChange={onBlockingChange} />);

    expect(await screen.findByText('⚠ Signature date looks blank.')).toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(
      screen.getByRole('checkbox', { name: "I've reviewed this and it's correct as-is" }),
    );
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('re-blocks if the acknowledgment is unchecked again', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        flags: [{ label: 'Date', message: 'Signature date looks blank.', box: null }],
      },
      error: null,
    } as never);
    const onBlockingChange = vi.fn();
    render(<W9CompletenessCheck file={file} onBlockingChange={onBlockingChange} />);

    const checkbox = await screen.findByRole('checkbox', {
      name: "I've reviewed this and it's correct as-is",
    });
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(onBlockingChange).toHaveBeenLastCalledWith(true);
  });

  test('fails open (does not block) when the check itself errors', async () => {
    mockInvoke.mockRejectedValue(new Error('network error'));
    const onBlockingChange = vi.fn();
    render(<W9CompletenessCheck file={file} onBlockingChange={onBlockingChange} />);

    expect(
      await screen.findByText(/Couldn't run the automatic check/),
    ).toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('shows a loading indicator while the check is in flight', async () => {
    let resolveInvoke: (value: unknown) => void = () => {};
    mockInvoke.mockReturnValue(
      new Promise((resolve) => {
        resolveInvoke = resolve;
      }) as never,
    );
    render(<W9CompletenessCheck file={file} onBlockingChange={vi.fn()} />);

    expect(await screen.findByText('Checking for common gaps…')).toBeInTheDocument();
    resolveInvoke({ data: { flags: [] }, error: null });
    expect(await screen.findByText('✓ Looks complete.')).toBeInTheDocument();
  });

  test('clicking the preview expands it, and clicking again collapses it', async () => {
    mockInvoke.mockResolvedValue({ data: { flags: [] }, error: null } as never);
    render(<W9CompletenessCheck file={file} onBlockingChange={vi.fn()} />);
    await screen.findByText('✓ Looks complete.');

    const preview = screen.getByRole('button', { name: 'Expand preview' });
    expect(
      screen.getByText('Click the preview to see it full size.'),
    ).toBeInTheDocument();

    fireEvent.click(preview);
    expect(screen.getByRole('button', { name: 'Collapse preview' })).toBeInTheDocument();
    expect(
      screen.getByText('Click the preview to shrink it back down.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse preview' }));
    expect(screen.getByRole('button', { name: 'Expand preview' })).toBeInTheDocument();
  });

  test('resets to a clean state when the file is cleared', async () => {
    mockInvoke.mockResolvedValue({ data: { flags: [] }, error: null } as never);
    const onBlockingChange = vi.fn();
    const { rerender } = render(
      <W9CompletenessCheck file={file} onBlockingChange={onBlockingChange} />,
    );
    await screen.findByText('✓ Looks complete.');

    rerender(<W9CompletenessCheck file={null} onBlockingChange={onBlockingChange} />);
    expect(screen.queryByText('✓ Looks complete.')).not.toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });
});
