import { act, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { lazyWithRetry } from './lazyWithRetry';

const STORAGE_KEY = 'chunk-retry:TestComponent';

const TestComponent = () => <div>Loaded!</div>;

let reloadSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  reloadSpy = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload: reloadSpy });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lazyWithRetry', () => {
  test('renders normally when the import succeeds, and clears any stale retry flag', async () => {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    const LazyComponent = lazyWithRetry(
      () => Promise.resolve({ default: TestComponent }),
      STORAGE_KEY,
    );

    render(
      <Suspense fallback="loading">
        <LazyComponent />
      </Suspense>,
    );

    expect(await screen.findByText('Loaded!')).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  test('reloads the page once on a failed import instead of surfacing an error', async () => {
    const LazyComponent = lazyWithRetry(
      () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
      STORAGE_KEY,
    );

    render(
      <Suspense fallback="loading">
        <LazyComponent />
      </Suspense>,
    );

    await vi.waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('true');
    // The component never resolves once a reload is triggered -- the
    // fallback should still be showing, not an error boundary's content.
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  test('does not reload again if the retry flag is already set -- lets the error propagate', async () => {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    const error = new TypeError('Failed to fetch dynamically imported module');
    const LazyComponent = lazyWithRetry(() => Promise.reject(error), STORAGE_KEY);

    // React logs the error to console when an error boundary-less component
    // throws during render; silence that expected noise for this test.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // With no error boundary in this test, the second (unretried) failure
    // propagates all the way out instead of being swallowed into a reload.
    await expect(
      act(() =>
        render(
          <Suspense fallback="loading">
            <LazyComponent />
          </Suspense>,
        ),
      ),
    ).rejects.toThrow('Failed to fetch dynamically imported module');

    expect(reloadSpy).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
