import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import App from './App';
import { useAuth } from './features/authentication/hooks/useAuth';
import { buildMockLedgerContext, buildMockUser } from './test/mocks';

vi.mock('./features/authentication/hooks/useAuth');

// useAuth is mocked above, so AuthProvider's real context value is never
// actually read -- but it still mounts and fires its own real Supabase
// session check otherwise, which is an unrelated async state update these
// tests don't want to wait on (and a real network call this suite
// shouldn't be making at all). Swap it for a passthrough.
vi.mock('./features/authentication/stores/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('./features/authentication/stores/AuthContext')
  >()),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// LedgerProvider's own dependencies (useOrganizationsData, ultimately real
// Supabase calls) have nothing to do with what's under test here --
// App-level routing/auth-gating -- so swap it for a version that hands
// child pages a valid mock context instead, keeping the real LedgerContext
// object so useLedger() inside those pages still resolves normally.
vi.mock('./features/ledger/stores/LedgerContext', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./features/ledger/stores/LedgerContext')>();
  return {
    ...actual,
    LedgerProvider: ({ children }: { children: React.ReactNode }) => (
      <actual.LedgerContext.Provider value={buildMockLedgerContext()}>
        {children}
      </actual.LedgerContext.Provider>
    ),
  };
});

const mockUseAuth = vi.mocked(useAuth);

const setPath = (path: string) => window.history.pushState({}, '', path);

describe('WildcatLedger App', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  test('renders the landing page by default', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    render(<App />);

    // LandingPage is code-split (see App.tsx), so it isn't in the DOM until
    // its chunk resolves -- find* waits for that instead of asserting
    // synchronously.
    expect(
      await screen.findByRole('heading', { name: /SOFO actually reviews your books/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /sign in with northwestern/i }).length,
    ).toBeGreaterThan(0);
  });

  test('renders the login screen at /login', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    setPath('/login');
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /wildcatledger/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sign in with your northwestern google account/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in with google/i }),
    ).toBeInTheDocument();
  });

  describe('ProtectedLayout', () => {
    test('renders nothing while auth is still loading', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
      });
      setPath('/dashboard');
      const { container } = render(<App />);

      expect(container.textContent).toBe('');
    });

    test('redirects to /login when unauthenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
      });
      setPath('/dashboard');
      render(<App />);

      expect(
        await screen.findByRole('heading', { name: /wildcatledger/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/sign in with your northwestern google account/i),
      ).toBeInTheDocument();
    });

    test('renders the protected routes once authenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: buildMockUser(),
        loading: false,
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
      });
      setPath('/organizations');
      render(<App />);

      expect(
        await screen.findByText('No organizations found for your account.'),
      ).toBeInTheDocument();
    });
  });
});
