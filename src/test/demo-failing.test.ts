import { describe, expect, test } from 'vitest';

// DEMO: intentionally failing to show the inline annotation the
// github-actions/github reporters add on the Files changed tab. Delete
// this file once you've seen it.
describe('demo failing test', () => {
  test('deliberately wrong assertion', () => {
    expect(1 + 1).toBe(3);
  });
});
