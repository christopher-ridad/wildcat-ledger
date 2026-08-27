import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { useScrollReveal } from './useScrollReveal';

let intersectionCallback: IntersectionObserverCallback | null = null;
let disconnectSpy: ReturnType<typeof vi.fn<() => void>>;
let observeSpy: ReturnType<typeof vi.fn<(target: Element) => void>>;

class ManualIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }

  observe = (target: Element) => observeSpy(target);
  unobserve = () => {};
  disconnect = () => disconnectSpy();
  takeRecords = () => [];
}

const TestComponent = () => {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="target">
      {revealed ? 'revealed' : 'hidden'}
    </div>
  );
};

describe('useScrollReveal', () => {
  let originalIntersectionObserver: typeof IntersectionObserver;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    intersectionCallback = null;
    disconnectSpy = vi.fn();
    observeSpy = vi.fn();
    originalIntersectionObserver = window.IntersectionObserver;
    originalMatchMedia = window.matchMedia;
    window.IntersectionObserver =
      ManualIntersectionObserver as unknown as typeof IntersectionObserver;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver;
    window.matchMedia = originalMatchMedia;
  });

  test('starts unrevealed, then reveals once the element intersects', () => {
    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('target')).toHaveTextContent('hidden');
    expect(observeSpy).toHaveBeenCalled();

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(getByTestId('target')).toHaveTextContent('revealed');
  });

  test('does not disconnect the observer once revealed -- stays reversible', () => {
    render(<TestComponent />);
    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(disconnectSpy).not.toHaveBeenCalled();
  });

  test('reverses back to hidden once the element leaves the reveal zone', () => {
    const { getByTestId } = render(<TestComponent />);

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(getByTestId('target')).toHaveTextContent('revealed');

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(getByTestId('target')).toHaveTextContent('hidden');
  });

  test('does not reveal on a non-intersecting entry', () => {
    const { getByTestId } = render(<TestComponent />);
    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(getByTestId('target')).toHaveTextContent('hidden');
    expect(disconnectSpy).not.toHaveBeenCalled();
  });

  test('reveals immediately without observing when prefers-reduced-motion is set', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('target')).toHaveTextContent('revealed');
    expect(observeSpy).not.toHaveBeenCalled();
  });

  test('disconnects the observer on unmount', () => {
    const { unmount } = render(<TestComponent />);
    unmount();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
