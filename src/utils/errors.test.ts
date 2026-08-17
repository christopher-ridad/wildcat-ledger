import { describe, expect, test } from 'vitest';

import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  test('returns the message of a real Error instance', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  test('returns the message of a Supabase-style PostgrestError-shaped plain object', () => {
    // Not `instanceof Error` -- exactly what a failed .rpc()/.from() call
    // actually returns, despite PostgrestError's own source declaring
    // `extends Error`. Confirmed directly against a local Supabase
    // instance; see errors.ts's comment for the full story.
    const postgrestError = {
      message: 'Cannot mark as Approved — missing required documents: W-9',
      details: null,
      hint: null,
      code: 'P0001',
    };
    expect(getErrorMessage(postgrestError, 'fallback')).toBe(
      'Cannot mark as Approved — missing required documents: W-9',
    );
  });

  test('falls back for a non-string message field', () => {
    expect(getErrorMessage({ message: 42 }, 'fallback')).toBe('fallback');
  });

  test('falls back for null, undefined, and primitives', () => {
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(getErrorMessage('a string', 'fallback')).toBe('fallback');
    expect(getErrorMessage(42, 'fallback')).toBe('fallback');
  });
});
