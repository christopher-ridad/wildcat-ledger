import { describe, expect, test } from 'vitest';

// DEMO: intentionally failing to verify the Integration check actually
// blocks the merge button on a real failure. Delete this file once you've
// seen it go red on the PR.
describe('demo failing test', () => {
  test('deliberately wrong assertion', () => {
    expect(1 + 1).toBe(3);
  });
});
