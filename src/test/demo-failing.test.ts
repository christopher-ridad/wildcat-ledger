import { describe, expect, test } from 'vitest';

// DEMO: was deliberately wrong to prove Integration blocks the merge on a
// real failure -- confirmed (see PR history). Fixed now so Integration
// passes and the e2e failure in Dev can be observed in isolation. Delete
// this whole file once that's confirmed too.
describe('demo failing test', () => {
  test('deliberately wrong assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
