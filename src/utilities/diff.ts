// Returns the keys present in `after` whose value differs from `before`.
// Used to render before/after diffs for pending changes and audit log entries.
export function diffChangedKeys(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): string[] {
  if (!before || !after) return [];
  return Object.keys(after).filter((k) => before[k] !== after[k]);
}
