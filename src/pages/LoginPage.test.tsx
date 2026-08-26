import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useAuth } from '../features/authentication/hooks/useAuth';
import { renderWithRouter } from '../test/mocks';
import { LoginPage } from './LoginPage';

vi.mock('../features/authentication/hooks/useAuth');

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const mockUseAuth = vi.mocked(useAuth);

const renderLoginPage = () => renderWithRouter(<LoginPage />);

describe('LoginPage', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    localStorage.clear();
    window.location.hash = '';
  });

  test('renders the Google sign-in button when there is no user', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    renderLoginPage();
    expect(screen.getByRole('heading', { name: /wildcatledger/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in with google/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  test('redirects to /organizations and clears the stored org when already logged in', () => {
    localStorage.setItem('activeOrganizationId', 'org-1');
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' } as never,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    renderLoginPage();
    expect(navigateMock).toHaveBeenCalledWith('/organizations', { replace: true });
    expect(localStorage.getItem('activeOrganizationId')).toBeNull();
  });

  test('clicking the button calls signInWithGoogle', () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle,
      signOut: vi.fn(),
    });
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));

    expect(signInWithGoogle).toHaveBeenCalled();
  });

  test('shows an error message when signInWithGoogle rejects', async () => {
    const signInWithGoogle = vi.fn().mockRejectedValue(new Error('Provider unavailable'));
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle,
      signOut: vi.fn(),
    });
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));

    expect(await screen.findByText('Provider unavailable')).toBeInTheDocument();
    // The button re-enables so the user can retry after a failure.
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeEnabled();
  });

  test('shows the error Supabase puts in the URL fragment after a rejected sign-in, decoding Supabase\'s double-encoded "@"', () => {
    window.location.hash =
      '#error=access_denied&error_description=Only%2520%2540u.northwestern.edu%2520email%2520addresses%2520can%2520sign%2520in.';
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    renderLoginPage();

    expect(
      screen.getByText('Only @u.northwestern.edu email addresses can sign in.'),
    ).toBeInTheDocument();
    // The fragment is stripped afterward so refreshing doesn't re-show it.
    expect(window.location.hash).toBe('');
  });

  test('disables the button while the redirect is starting', async () => {
    let resolveSignIn: () => void = () => {};
    const signInWithGoogle = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle,
      signOut: vi.fn(),
    });
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(await screen.findByRole('button', { name: /redirecting/i })).toBeDisabled();

    resolveSignIn();
  });
});
