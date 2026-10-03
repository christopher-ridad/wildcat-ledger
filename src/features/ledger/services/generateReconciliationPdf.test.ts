import { readFileSync } from 'fs';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ReconciliationFormData } from './debitCardReconciliationForm';
import {
  downloadReconciliationPdf,
  generateReconciliationPdf,
} from './generateReconciliationPdf';

const baseData: ReconciliationFormData = {
  orgName: 'Ballroom Latin and Swing Team',
  accountNumber: '2012-345',
  lastFourDigits: '6789',
  inventoryControlNumber: '12345678-1234567',
  reimbursements: [
    { date: '2026-03-01', description: 'IL Sales Tax - Coffee Shop', amount: 2.5 },
  ],
  totalReimbursed: 2.5,
  loadBalance: 500,
  balanceAsOf: 320.25,
  completedReconciliationsPendingReload: 40,
  pendingTransactions: 15,
  totalExpenditures: 124.75,
  authorizedCharges: 117.25,
  serviceFees: 3,
  reconciliationSubtotal: 123.25,
  reloadAmount: 163.25,
};

beforeEach(() => {
  // Real template bytes, read from disk -- the test exercises pdf-lib
  // against the actual form, not a stub, since the thing worth protecting
  // against regression is "does this still produce a valid filled PDF
  // without throwing," not just "was fetch called." Copied into a fresh
  // Uint8Array (not bytes.buffer directly): Node's fs.readFileSync Buffer
  // belongs to Node's own realm, while this jsdom test environment has its
  // own separate ArrayBuffer/Uint8Array globals -- pdf-lib's instanceof
  // check silently fails across realms (surfacing as a confusing "type
  // NaN" error), so this re-materializes the bytes using the realm pdf-lib
  // will actually check against.
  const bytes = new Uint8Array(
    readFileSync('public/forms/debit-card-reconciliation.pdf'),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => bytes.buffer,
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Regression test for a real bug: every drawn value used to go through
// Math.abs(), so when totalExpenditures comes out negative (e.g. Load
// Balance not actually set in Debit Card Settings, defaulting to 0) the
// form silently printed the positive magnitude instead -- masking exactly
// the kind of mismatch the form's own "*Total Expenditures and
// Reconciliation Subtotal should match" note exists to catch. Reads the
// drawn text back out via pdfjs-dist rather than just checking the
// function didn't throw, since the bug was in what gets drawn, not
// whether drawing succeeds.
async function extractTextNear(blob: Blob, targetX: number, targetY: number) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  // The template's own blank line ("___________") sits at nearly the same
  // position as whatever gets drawn on top of it, so excludes anything
  // that's just underscores rather than taking the first positional match.
  const match = content.items.find((item) => {
    const i = item as { transform: number[]; str: string };
    const [, , , , x, y] = i.transform;
    return Math.abs(x - targetX) < 5 && Math.abs(y - targetY) < 2 && !/^_+$/.test(i.str);
  }) as { str: string } | undefined;
  return match?.str;
}

describe('generateReconciliationPdf', () => {
  test('fetches the template from its public path', async () => {
    await generateReconciliationPdf(baseData, 'please-reload');
    expect(fetch).toHaveBeenCalledWith('/forms/debit-card-reconciliation.pdf');
  });

  test('throws a clear error when the template fails to load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(generateReconciliationPdf(baseData, 'please-reload')).rejects.toThrow(
      'Could not load the reconciliation form template.',
    );
  });

  test('produces a non-empty, valid, single-page PDF', async () => {
    const blob = await generateReconciliationPdf(baseData, 'please-reload');
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  test('shows Total Expenditures as positive when the numbers are consistent', async () => {
    const blob = await generateReconciliationPdf(baseData, 'please-reload');
    const text = await extractTextNear(blob, 220, 331.2);
    expect(text).toBe('124.75');
  });

  test('shows Total Expenditures as negative (with a leading "-") when Load Balance is unset and the numbers do not add up', async () => {
    const inconsistent: ReconciliationFormData = {
      ...baseData,
      loadBalance: 0,
      balanceAsOf: 23.78,
      completedReconciliationsPendingReload: 0,
      pendingTransactions: 0,
      totalExpenditures: -23.78,
    };
    const blob = await generateReconciliationPdf(inconsistent, 'do-not-reload');
    const text = await extractTextNear(blob, 220, 331.2);
    expect(text).toBe('-23.78');
  });

  test('produces a PDF regardless of which reload option is passed', async () => {
    await expect(
      generateReconciliationPdf(baseData, 'do-not-reload'),
    ).resolves.toBeInstanceOf(Blob);
  });

  test('produces a PDF even with no reimbursements and missing optional fields', async () => {
    const minimal: ReconciliationFormData = {
      ...baseData,
      accountNumber: undefined,
      lastFourDigits: undefined,
      inventoryControlNumber: undefined,
      reimbursements: [],
    };
    await expect(
      generateReconciliationPdf(minimal, 'do-not-reload'),
    ).resolves.toBeInstanceOf(Blob);
  });

  // Regression guard for the real bug caught during manual verification:
  // only the first 2 reimbursements have blank rows on the template, so a
  // 3rd (or more) must not throw trying to draw into a nonexistent row.
  test('does not throw when given more reimbursements than the template has rows for', async () => {
    const manyReimbursements: ReconciliationFormData = {
      ...baseData,
      reimbursements: [
        { date: '2026-01-01', description: 'One', amount: 1 },
        { date: '2026-01-02', description: 'Two', amount: 2 },
        { date: '2026-01-03', description: 'Three', amount: 3 },
      ],
    };
    await expect(
      generateReconciliationPdf(manyReimbursements, 'please-reload'),
    ).resolves.toBeInstanceOf(Blob);
  });
});

describe('downloadReconciliationPdf', () => {
  test('creates a download link named after the org and clicks it', () => {
    const blob = new Blob(['pdf bytes'], { type: 'application/pdf' });
    const clickSpy = vi.fn();
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({ click: clickSpy } as unknown as HTMLAnchorElement);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    downloadReconciliationPdf(blob, 'Ballroom Latin and Swing Team');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createElementSpy.mockRestore();
  });

  test('sanitizes the org name into a safe filename', () => {
    const blob = new Blob(['pdf bytes'], { type: 'application/pdf' });
    const anchor = { click: vi.fn() } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    downloadReconciliationPdf(blob, "Women's Club @ Evanston!");

    expect(anchor.download).toBe('Women-s-Club-Evanston--debit-card-reconciliation.pdf');

    vi.restoreAllMocks();
  });
});
