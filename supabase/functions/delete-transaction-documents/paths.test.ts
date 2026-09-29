import { assertEquals } from 'jsr:@std/assert@1';

import { filterPathsForOrg } from './paths.ts';

Deno.test('filterPathsForOrg keeps only paths under the given org prefix', () => {
  const result = filterPathsForOrg(
    [
      'clubs/org-1/transactions/t1/receipt.pdf',
      'clubs/org-2/transactions/t1/receipt.pdf',
      'clubs/org-1/transactions/t2/w9.pdf',
    ],
    'org-1',
  );

  assertEquals(result, [
    'clubs/org-1/transactions/t1/receipt.pdf',
    'clubs/org-1/transactions/t2/w9.pdf',
  ]);
});

Deno.test('filterPathsForOrg drops non-string entries', () => {
  const result = filterPathsForOrg(
    ['clubs/org-1/transactions/t1/receipt.pdf', null, 42, {}],
    'org-1',
  );

  assertEquals(result, ['clubs/org-1/transactions/t1/receipt.pdf']);
});

Deno.test('filterPathsForOrg returns an empty array for non-array input', () => {
  assertEquals(filterPathsForOrg(undefined, 'org-1'), []);
  assertEquals(filterPathsForOrg('clubs/org-1/transactions/t1/receipt.pdf', 'org-1'), []);
  assertEquals(filterPathsForOrg(null, 'org-1'), []);
});

Deno.test(
  "filterPathsForOrg rejects a path that only resembles another org's prefix",
  () => {
    // "org-10" must not match a filter for "org-1" -- a naive
    // startsWith('clubs/org-1') (no trailing slash) would let this through.
    const result = filterPathsForOrg(
      ['clubs/org-10/transactions/t1/receipt.pdf'],
      'org-1',
    );

    assertEquals(result, []);
  },
);
