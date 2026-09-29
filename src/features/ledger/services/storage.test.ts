import { beforeEach, describe, expect, test, vi } from 'vitest';

import { supabase } from '../../../config/supabase';
import {
  documentPath,
  removeTransactionDocuments,
  transactionDocumentPaths,
} from './storage';

vi.mock('../../../config/supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));

const mockInvoke = vi.mocked(supabase.functions.invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('documentPath', () => {
  test('builds a path scoped to the org and transaction, prefixed and timestamped', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-01-15T00:00:00Z'));
    const file = new File(['content'], 'w9.pdf');

    const path = documentPath('org-1', 'txn-1', file, 'w9');

    expect(path).toBe(`clubs/org-1/transactions/txn-1/w9_${Date.now()}_w9.pdf`);
    vi.useRealTimers();
  });

  test('two uploads of the same file a moment apart get distinct paths', async () => {
    const file = new File(['content'], 'receipt.jpg');

    const first = documentPath('org-1', 'txn-1', file, 'receipt');
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = documentPath('org-1', 'txn-1', file, 'receipt');

    expect(first).not.toBe(second);
  });

  test('different orgs/transactions/prefixes each land in their own path segment', () => {
    const file = new File(['content'], 'form.pdf');

    const path = documentPath('org-2', 'txn-9', file, 'exemption-form');

    expect(path.startsWith('clubs/org-2/transactions/txn-9/exemption-form_')).toBe(true);
  });
});

describe('transactionDocumentPaths', () => {
  test('collects every populated document url field', () => {
    const paths = transactionDocumentPaths({
      receiptFileUrl: 'clubs/org-1/transactions/t1/receipt.pdf',
      contractFileUrl: undefined,
      w9FileUrl: 'clubs/org-1/transactions/t1/w9.pdf',
      contractedServicesFileUrl: undefined,
      conflictOfInterestFileUrl: undefined,
      specialPayFormUrl: undefined,
      exemptionFormUrl: undefined,
    });

    expect(paths).toEqual([
      'clubs/org-1/transactions/t1/receipt.pdf',
      'clubs/org-1/transactions/t1/w9.pdf',
    ]);
  });

  test('returns an empty array when no documents were uploaded', () => {
    const paths = transactionDocumentPaths({
      receiptFileUrl: undefined,
      contractFileUrl: undefined,
      w9FileUrl: undefined,
      contractedServicesFileUrl: undefined,
      conflictOfInterestFileUrl: undefined,
      specialPayFormUrl: undefined,
      exemptionFormUrl: undefined,
    });

    expect(paths).toEqual([]);
  });
});

describe('removeTransactionDocuments', () => {
  test('invokes the delete-transaction-documents function with the org and paths', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null } as never);

    await removeTransactionDocuments('org-1', [
      'clubs/org-1/transactions/t1/receipt.pdf',
    ]);

    expect(mockInvoke).toHaveBeenCalledWith('delete-transaction-documents', {
      body: { orgId: 'org-1', paths: ['clubs/org-1/transactions/t1/receipt.pdf'] },
    });
  });

  test('does nothing when there are no paths to remove', async () => {
    await removeTransactionDocuments('org-1', []);

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test('throws when the function call fails', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('unauthorized'),
    } as never);

    await expect(
      removeTransactionDocuments('org-1', ['clubs/org-1/transactions/t1/receipt.pdf']),
    ).rejects.toThrow('unauthorized');
  });
});
