import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrollIntoView -- components that call it
// unconditionally (e.g. scrolling a "today" landmark into view on mount)
// would otherwise throw in every test that renders them.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
