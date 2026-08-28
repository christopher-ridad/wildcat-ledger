import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ErrorFallback } from './ErrorFallback';

describe('ErrorFallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('shows a reassuring heading and message', () => {
    render(<ErrorFallback eventId="evt-1" resetError={vi.fn()} />);
    expect(
      screen.getByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/your data is safe/i)).toBeInTheDocument();
  });

  test('shows the Sentry event id as a support reference', () => {
    render(<ErrorFallback eventId="evt-123" resetError={vi.fn()} />);
    expect(screen.getByText(/Error reference: evt-123/)).toBeInTheDocument();
  });

  test('omits the reference line when there is no event id', () => {
    render(<ErrorFallback eventId="" resetError={vi.fn()} />);
    expect(screen.queryByText(/Error reference/)).not.toBeInTheDocument();
  });

  test('"Try Again" calls resetError', () => {
    const resetError = vi.fn();
    render(<ErrorFallback eventId="evt-1" resetError={resetError} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(resetError).toHaveBeenCalled();
  });

  test('"Reload Page" reloads the page', () => {
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });
    render(<ErrorFallback eventId="evt-1" resetError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload Page' }));
    expect(reloadSpy).toHaveBeenCalled();
  });
});
