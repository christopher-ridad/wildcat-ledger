import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { supabase } from '../../../../../config/supabase';
import {
  deriveFlags,
  RSOAgreementCompletenessCheck,
} from './RSOAgreementCompletenessCheck';

vi.mock('../../../../../config/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const pdfMock = vi.hoisted(() => ({ numPages: 2 }));

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
const file = new File(['%PDF-1.4'], 'rso.pdf', { type: 'application/pdf' });

const trivialBox = {
  normalizedVertices: [
    { x: 0, y: 0 },
    { x: 0.1, y: 0 },
    { x: 0.1, y: 0.1 },
    { x: 0, y: 0.1 },
  ],
};

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

const rowsFixture = () =>
  ROW_KEYS.map((key) => ({
    key,
    label: `Row ${key}`,
    page: 1,
    yesBox: trivialBox,
    noBox: trivialBox,
  }));

// getImageData is called twice per row (yesBox darkness, then noBox
// darkness), in the exact order the server returned section4Rows -- this
// queue feeds back canned "dark" (checked) or "light" (unchecked) pixel
// data for each call in that order, so a test can dictate each row's
// answer without depending on real coordinates.
function makeImageDataQueue(sequence: ('dark' | 'light')[]) {
  let i = 0;
  return vi.fn(() => {
    const value = sequence[i] ?? 'light';
    i += 1;
    const v = value === 'dark' ? 0 : 255;
    return { data: new Uint8ClampedArray([v, v, v, 255]) };
  });
}

const ALL_NO_SEQUENCE: ('dark' | 'light')[] = Array(7)
  .fill(null)
  .flatMap(() => ['light', 'dark'] as const);

function baseResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sectionFlags: [],
    section4Box: { page: 1, box: trivialBox },
    section4Rows: rowsFixture(),
    reservationSubsection: { filled: true, page: 1, box: trivialBox },
    ...overrides,
  };
}

// jsdom doesn't implement canvas 2D rendering -- stub just enough of the
// context surface this component actually calls.
function mockCanvasContext(getImageData: ReturnType<typeof makeImageDataQueue>) {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    strokeRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    getImageData,
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  pdfMock.numPages = 2;
  mockCanvasContext(makeImageDataQueue(ALL_NO_SEQUENCE));
});

describe('RSOAgreementCompletenessCheck', () => {
  test('renders nothing when there is no file', () => {
    const { container } = render(
      <RSOAgreementCompletenessCheck file={null} onBlockingChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('shows "Looks complete" and does not block when every row is answered and no section flags', async () => {
    mockInvoke.mockResolvedValue({ data: baseResult(), error: null } as never);
    const onBlockingChange = vi.fn();
    render(
      <RSOAgreementCompletenessCheck file={file} onBlockingChange={onBlockingChange} />,
    );

    expect(await screen.findByText('✓ Looks complete.')).toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('shows section-level flags from the server and blocks until acknowledged', async () => {
    mockInvoke.mockResolvedValue({
      data: baseResult({
        sectionFlags: [
          { section: 1, page: 0, message: 'Section 1 not filled out.', box: trivialBox },
        ],
      }),
      error: null,
    } as never);
    const onBlockingChange = vi.fn();
    render(
      <RSOAgreementCompletenessCheck file={file} onBlockingChange={onBlockingChange} />,
    );

    expect(await screen.findByText('⚠ Section 1 not filled out.')).toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(
      screen.getByRole('checkbox', { name: "I've reviewed this and it's correct as-is" }),
    );
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('flags Section 4 as not filled out when a row is left ambiguous', async () => {
    // Row d comes back light/light (neither circle looks filled in).
    mockCanvasContext(
      makeImageDataQueue([
        'light',
        'dark', // a -> no
        'light',
        'dark', // b -> no
        'light',
        'dark', // c -> no
        'light',
        'light', // d -> unanswered
        'light',
        'dark', // e -> no
        'light',
        'dark', // f -> no
        'light',
        'dark', // g -> no
      ]),
    );

    mockInvoke.mockResolvedValue({ data: baseResult(), error: null } as never);
    const onBlockingChange = vi.fn();
    render(
      <RSOAgreementCompletenessCheck file={file} onBlockingChange={onBlockingChange} />,
    );

    expect(await screen.findByText('⚠ Section 4 not filled out.')).toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(true);
  });

  test('flags the reservation subsection when row b is Yes but it is blank', async () => {
    mockCanvasContext(
      makeImageDataQueue([
        'light',
        'dark', // a -> no
        'dark',
        'light', // b -> yes
        'light',
        'dark', // c -> no
        'light',
        'dark', // d -> no
        'light',
        'dark', // e -> no
        'light',
        'dark', // f -> no
        'light',
        'dark', // g -> no
      ]),
    );

    mockInvoke.mockResolvedValue({
      data: baseResult({
        reservationSubsection: { filled: false, page: 1, box: trivialBox },
      }),
      error: null,
    } as never);
    const onBlockingChange = vi.fn();
    render(
      <RSOAgreementCompletenessCheck file={file} onBlockingChange={onBlockingChange} />,
    );

    expect(
      await screen.findByText(/Section 4 needs the reservation details/),
    ).toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(true);
  });

  test('fails open (does not block) when the check itself errors', async () => {
    mockInvoke.mockRejectedValue(new Error('network error'));
    const onBlockingChange = vi.fn();
    render(
      <RSOAgreementCompletenessCheck file={file} onBlockingChange={onBlockingChange} />,
    );

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
    render(<RSOAgreementCompletenessCheck file={file} onBlockingChange={vi.fn()} />);

    expect(await screen.findByText('Checking for missing sections…')).toBeInTheDocument();
    resolveInvoke({ data: baseResult(), error: null });
    expect(await screen.findByText('✓ Looks complete.')).toBeInTheDocument();
  });

  test('clicking the preview expands it, and clicking again collapses it', async () => {
    mockInvoke.mockResolvedValue({ data: baseResult(), error: null } as never);
    render(<RSOAgreementCompletenessCheck file={file} onBlockingChange={vi.fn()} />);
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
    mockInvoke.mockResolvedValue({ data: baseResult(), error: null } as never);
    const onBlockingChange = vi.fn();
    const { rerender } = render(
      <RSOAgreementCompletenessCheck file={file} onBlockingChange={onBlockingChange} />,
    );
    await screen.findByText('✓ Looks complete.');

    rerender(
      <RSOAgreementCompletenessCheck file={null} onBlockingChange={onBlockingChange} />,
    );
    expect(screen.queryByText('✓ Looks complete.')).not.toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('skips the check and shows a size warning when the file is too large', async () => {
    const bigFile = new File(['%PDF-1.4'], 'rso.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 16 * 1024 * 1024 });
    const onBlockingChange = vi.fn();
    render(
      <RSOAgreementCompletenessCheck
        file={bigFile}
        onBlockingChange={onBlockingChange}
      />,
    );

    expect(
      await screen.findByText(/larger than expected for an RSO Agreement/),
    ).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('skips the check and shows a page-count warning when the document has too many pages', async () => {
    pdfMock.numPages = 6;
    const onBlockingChange = vi.fn();
    render(
      <RSOAgreementCompletenessCheck file={file} onBlockingChange={onBlockingChange} />,
    );

    expect(
      await screen.findByText(/more pages than expected for an RSO Agreement/),
    ).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(onBlockingChange).toHaveBeenLastCalledWith(false);
  });

  test('passes an abort signal to the check invocation, so a superseded check gets cancelled', async () => {
    mockInvoke.mockResolvedValue({ data: baseResult(), error: null } as never);
    render(<RSOAgreementCompletenessCheck file={file} onBlockingChange={vi.fn()} />);
    await screen.findByText('✓ Looks complete.');

    expect(mockInvoke).toHaveBeenCalledWith(
      'check-rso-agreement-completeness',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test('labels each page canvas for screen readers', async () => {
    mockInvoke.mockResolvedValue({ data: baseResult(), error: null } as never);
    render(<RSOAgreementCompletenessCheck file={file} onBlockingChange={vi.fn()} />);
    await screen.findByText('✓ Looks complete.');

    expect(screen.getByRole('img', { name: /RSO Agreement page 1/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /RSO Agreement page 2/ })).toBeInTheDocument();
  });
});

describe('deriveFlags', () => {
  const allNo = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((key) => ({
    key,
    answer: 'no' as const,
  }));

  test('returns no flags when every row is answered and the server found no gaps', () => {
    expect(deriveFlags(baseResult(), allNo)).toEqual([]);
  });

  test("passes through the server's section-level flags", () => {
    const result = baseResult({
      sectionFlags: [
        { section: 1, page: 0, message: 'Section 1 not filled out.', box: trivialBox },
      ],
    });
    expect(deriveFlags(result, allNo)).toEqual([
      {
        key: 'section-1',
        message: 'Section 1 not filled out.',
        page: 0,
        box: trivialBox,
      },
    ]);
  });

  test('flags Section 4 when any row is unanswered, alongside any section flags', () => {
    const rows = [
      ...allNo.slice(0, 3),
      { key: 'd', answer: 'unanswered' as const },
      ...allNo.slice(4),
    ];
    const result = baseResult({
      sectionFlags: [
        { section: 1, page: 0, message: 'Section 1 not filled out.', box: trivialBox },
      ],
    });
    const flags = deriveFlags(result, rows);
    expect(flags.map((f) => f.key)).toEqual(['section-1', 'section-4']);
  });

  test('flags the reservation subsection when row b is Yes and it is blank', () => {
    const rows = [{ key: 'b', answer: 'yes' as const }, ...allNo.slice(1)];
    const result = baseResult({
      reservationSubsection: { filled: false, page: 1, box: trivialBox },
    });
    expect(deriveFlags(result, rows).map((f) => f.key)).toEqual(['section-4b']);
  });

  test('does not flag the reservation subsection when it is already filled', () => {
    const rows = [{ key: 'b', answer: 'yes' as const }, ...allNo.slice(1)];
    const result = baseResult({
      reservationSubsection: { filled: true, page: 1, box: trivialBox },
    });
    expect(deriveFlags(result, rows)).toEqual([]);
  });

  test('does not flag the reservation subsection when row b is No, regardless of its contents', () => {
    const result = baseResult({
      reservationSubsection: { filled: false, page: 1, box: trivialBox },
    });
    expect(deriveFlags(result, allNo)).toEqual([]);
  });

  test('falls back to section-level flags only when no row answers are available', () => {
    const result = baseResult({
      sectionFlags: [
        { section: 3, page: 1, message: 'Section 3 not filled out.', box: trivialBox },
      ],
    });
    expect(deriveFlags(result, []).map((f) => f.key)).toEqual(['section-3']);
  });
});
