import { describe, expect, test, vi } from 'vitest';

import { documentPath } from './storage';

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
