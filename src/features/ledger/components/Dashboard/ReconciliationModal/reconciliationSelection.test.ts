import { describe, expect, test } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { getIncludableIds, setIncluded } from './reconciliationSelection';

const sep26 = buildMockTransaction({ id: '26', date: '2026-09-26' });
const sep27 = buildMockTransaction({ id: '27', date: '2026-09-27' });
const sep28 = buildMockTransaction({ id: '28', date: '2026-09-28' });
const purchases = [sep28, sep27, sep26];
const all = () => new Set(['26', '27', '28']);

describe('setIncluded', () => {
  test('leaving out the most recent purchase leaves the rest included', () => {
    expect(setIncluded(purchases, all(), sep28, false)).toEqual(new Set(['26', '27']));
  });

  test('leaving out an older purchase also leaves out every newer one', () => {
    expect(setIncluded(purchases, all(), sep27, false)).toEqual(new Set(['26']));
    expect(setIncluded(purchases, all(), sep26, false)).toEqual(new Set());
  });

  test('including a purchase also includes every older one', () => {
    expect(setIncluded(purchases, new Set(), sep27, true)).toEqual(new Set(['26', '27']));
  });

  test('purchases on the same date can be picked independently', () => {
    const sep28b = buildMockTransaction({ id: '28b', date: '2026-09-28' });
    const withTie = [...purchases, sep28b];
    const selected = new Set(['26', '27', '28', '28b']);
    expect(setIncluded(withTie, selected, sep28, false)).toEqual(
      new Set(['26', '27', '28b']),
    );
  });

  test('does not change the set it was given', () => {
    const selected = all();
    setIncluded(purchases, selected, sep28, false);
    expect(selected).toEqual(all());
  });
});

describe('getIncludableIds', () => {
  const blockedIds =
    (...ids: string[]) =>
    (t: { id: string }) =>
      ids.includes(t.id);

  test('everything is includable when nothing is blocked', () => {
    expect(getIncludableIds(purchases, blockedIds())).toEqual(all());
  });

  test('a blocked recent purchase leaves the older ones includable', () => {
    expect(getIncludableIds(purchases, blockedIds('28'))).toEqual(new Set(['26', '27']));
  });

  test('a blocked older purchase holds back everything newer', () => {
    expect(getIncludableIds(purchases, blockedIds('26'))).toEqual(new Set());
  });

  test('a blocked purchase does not hold back others on the same date', () => {
    const sep28b = buildMockTransaction({ id: '28b', date: '2026-09-28' });
    expect(getIncludableIds([...purchases, sep28b], blockedIds('28'))).toEqual(
      new Set(['26', '27', '28b']),
    );
  });
});
