import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { supabase } from '../../../../../config/supabase';
import { GenericCompletenessCheck } from './GenericCompletenessCheck';

vi.mock('../../../../../config/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const pdfMock = vi.hoisted(() => ({ numPages: 1 }));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: pdfMock.numPages,
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
const file = new File(['%PDF-1.4'], 'form.pdf', { type: 'application/pdf' });

const renderCheck = (
  props: Partial<React.ComponentProps<typeof GenericCompletenessCheck>> = {},
) =>
  render(
    <GenericCompletenessCheck
      file={file}
      onBlockingChange={vi.fn()}
      functionName="check-contracted-services-completeness"
      docLabel="Contracted Services Form"
      maxPages={3}
      {...props}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  pdfMock.numPages = 1;
  // jsdom doesn't implement canvas 2D rendering -- stub just enough of the
  // context surface this component actually calls.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    strokeRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe('GenericCompletenessCheck', () => {
  test('renders nothing when there is no file', () => {
    const { container } = renderCheck({ file: null });
    expect(container).toBeEmptyDOMElement();
  });

  test('shows "Looks complete" and does not block when there are no flags', async () => {
    mockInvoke.mockResolvedValue({ data: { flags: [] }, error: null } as never);
    const onBlockingChange = vi.fn();
    renderCheck({ onBlockingChange });

    expect(await screen.findByText('✓ Looks complete.')).toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('shows each flag and blocks until acknowledged', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        flags: [{ label: 'Requestor', message: 'Requestor looks blank.', box: null }],
      },
      error: null,
    } as never);
    const onBlockingChange = vi.fn();
    renderCheck({ onBlockingChange });

    expect(await screen.findByText('⚠ Requestor looks blank.')).toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(
      screen.getByRole('checkbox', { name: "I've reviewed this and it's correct as-is" }),
    );
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('re-blocks if the acknowledgment is unchecked again', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        flags: [{ label: 'Requestor', message: 'Requestor looks blank.', box: null }],
      },
      error: null,
    } as never);
    const onBlockingChange = vi.fn();
    renderCheck({ onBlockingChange });

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
    renderCheck({ onBlockingChange });

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
    renderCheck();

    expect(await screen.findByText('Checking for common gaps…')).toBeInTheDocument();
    resolveInvoke({ data: { flags: [] }, error: null });
    expect(await screen.findByText('✓ Looks complete.')).toBeInTheDocument();
  });

  test('clicking the preview expands it, and clicking again collapses it', async () => {
    mockInvoke.mockResolvedValue({ data: { flags: [] }, error: null } as never);
    renderCheck();
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
    const { rerender } = renderCheck({ onBlockingChange });
    await screen.findByText('✓ Looks complete.');

    rerender(
      <GenericCompletenessCheck
        file={null}
        onBlockingChange={onBlockingChange}
        functionName="check-contracted-services-completeness"
        docLabel="Contracted Services Form"
        maxPages={3}
      />,
    );
    expect(screen.queryByText('✓ Looks complete.')).not.toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('skips the check and shows a size warning when the file is too large', async () => {
    const bigFile = new File(['%PDF-1.4'], 'form.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 16 * 1024 * 1024 });
    const onBlockingChange = vi.fn();
    renderCheck({ file: bigFile, onBlockingChange });

    expect(
      await screen.findByText(/larger than expected for a Contracted Services Form/),
    ).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('skips the check and shows a page-count warning when the document has too many pages', async () => {
    pdfMock.numPages = 12;
    const onBlockingChange = vi.fn();
    renderCheck({ onBlockingChange });

    expect(
      await screen.findByText(/more pages than expected for a Contracted Services Form/),
    ).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('invokes the given Edge Function name with an abort signal, so a superseded check gets cancelled', async () => {
    mockInvoke.mockResolvedValue({ data: { flags: [] }, error: null } as never);
    renderCheck({ functionName: 'check-special-pay-form-completeness' });
    await screen.findByText('✓ Looks complete.');

    expect(mockInvoke).toHaveBeenCalledWith(
      'check-special-pay-form-completeness',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test('labels the canvas preview for screen readers using the given doc label', async () => {
    mockInvoke.mockResolvedValue({ data: { flags: [] }, error: null } as never);
    renderCheck({ docLabel: 'Special Pay Form' });
    await screen.findByText('✓ Looks complete.');

    expect(
      screen.getByRole('img', { name: /Preview of the uploaded Special Pay Form/ }),
    ).toBeInTheDocument();
  });
});
