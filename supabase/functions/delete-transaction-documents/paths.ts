// Pure path-validation logic, kept separate from index.ts's HTTP/auth
// wrapper so it can be unit tested directly (see paths.test.ts) -- matching
// every other Edge Function in this project, where a check.ts holds the
// testable logic and index.ts is a thin, untested scaffold around it.

// Defense in depth: even though the caller is already verified to manage
// orgId (see index.ts), only ever remove paths that actually live under
// that org's own Storage prefix (see documentPath in storage.ts) -- a bug
// or bad input elsewhere shouldn't be able to turn this into an
// arbitrary-path deletion.
export function filterPathsForOrg(paths: unknown, orgId: string): string[] {
  if (!Array.isArray(paths)) return [];
  const prefix = `clubs/${orgId}/`;
  return paths.filter(
    (path): path is string => typeof path === 'string' && path.startsWith(prefix),
  );
}
