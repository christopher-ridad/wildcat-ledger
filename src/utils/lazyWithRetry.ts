import { ComponentType, lazy } from 'react';

// Vite's built chunk filenames are content-hashed, so they change with
// every deploy. A browser tab left open across a deploy will 404 the first
// time it navigates to a route it hasn't loaded yet in that session, since
// it's still asking for the old (now-deleted) filename -- unlike the
// initial index.html fetch, there's no implicit "get the current one"
// fallback for a chunk import. Force a one-time reload when that happens,
// which picks up the current index.html (and therefore the current chunk
// filenames) instead of leaving the user stuck on a dead page. Tracked in
// sessionStorage, keyed per component, so a genuinely broken import doesn't
// reload forever and one page's retry doesn't suppress another's.
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>,
  storageKey: string,
) {
  return lazy(async () => {
    try {
      const module = await importer();
      sessionStorage.removeItem(storageKey);
      return module;
    } catch (error) {
      const alreadyRetried = sessionStorage.getItem(storageKey) === 'true';
      if (alreadyRetried) throw error;

      sessionStorage.setItem(storageKey, 'true');
      window.location.reload();
      // The reload is in flight; never resolve so Suspense's fallback stays
      // up rather than briefly rendering an error state before navigation
      // actually happens.
      return new Promise<{ default: T }>(() => {});
    }
  });
}
