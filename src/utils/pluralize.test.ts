import { describe, expect, test } from 'vitest';

import { pluralize } from './pluralize';

describe('pluralize', () => {
  test('returns the singular form for a count of 1', () => {
    expect(pluralize(1, 'file')).toBe('file');
  });

  test('returns the default (singular + "s") plural form for any other count', () => {
    expect(pluralize(0, 'file')).toBe('files');
    expect(pluralize(2, 'file')).toBe('files');
  });

  test('uses an explicit irregular plural when given one', () => {
    expect(pluralize(1, 'entry', 'entries')).toBe('entry');
    expect(pluralize(3, 'entry', 'entries')).toBe('entries');
  });
});
