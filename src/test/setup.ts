import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrollIntoView -- components that call it
// unconditionally (e.g. scrolling a "today" landmark into view on mount)
// would otherwise throw in every test that renders them.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom doesn't implement IntersectionObserver either. jsdom has no real
// layout/viewport (elements always report zero size), so there's nothing
// meaningful to simulate about partial visibility -- just fire "visible"
// synchronously on observe() so useScrollReveal() resolves to revealed=true
// by default in every test, with no bespoke per-test mocking required.
// Tests that specifically need the unrevealed state (useScrollReveal's own
// test) locally override window.IntersectionObserver instead.
class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe = (target: Element) => {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this);
  };

  unobserve = () => {};
  disconnect = () => {};
  takeRecords = () => [];
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

// jsdom doesn't implement matchMedia. Default to "no preference" (false)
// for every query -- useScrollReveal()'s prefers-reduced-motion check calls
// this unconditionally on mount.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
