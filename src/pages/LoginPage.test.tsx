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
  });

  test('renders the login form when there is no user', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, sendLoginLink: vi.fn() });
    renderLoginPage();
    expect(screen.getByRole('heading', { name: /wildcatledger/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send me a link/i })).toBeInTheDocument();
  });

  test('redirects to /organizations and clears the stored org when already logged in', () => {
    localStorage.setItem('activeOrganizationId', 'org-1');
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' } as never,
      loading: false,
      sendLoginLink: vi.fn(),
    });
    renderLoginPage();
    expect(navigateMock).toHaveBeenCalledWith('/organizations', { replace: true });
    expect(localStorage.getItem('activeOrganizationId')).toBeNull();
  });

  test('shows an error for an invalid email without calling sendLoginLink', () => {
    const sendLoginLink = vi.fn();
    mockUseAuth.mockReturnValue({ user: null, loading: false, sendLoginLink });
    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send me a link/i }));

    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(sendLoginLink).not.toHaveBeenCalled();
  });

  test('submits a valid email and shows the "check your email" screen', async () => {
    const sendLoginLink = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ user: null, loading: false, sendLoginLink });
    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'person@northwestern.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send me a link/i }));

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText('person@northwestern.edu')).toBeInTheDocument();
    expect(sendLoginLink).toHaveBeenCalledWith('person@northwestern.edu');
  });

  test('submits on Enter keydown in the email field', async () => {
    const sendLoginLink = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ user: null, loading: false, sendLoginLink });
    renderLoginPage();

    const input = screen.getByLabelText(/email address/i);
    fireEvent.change(input, { target: { value: 'person@northwestern.edu' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  test('shows an error message when sendLoginLink rejects', async () => {
    const sendLoginLink = vi.fn().mockRejectedValue(new Error('Rate limited'));
    mockUseAuth.mockReturnValue({ user: null, loading: false, sendLoginLink });
    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'person@northwestern.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send me a link/i }));

    expect(await screen.findByText('Rate limited')).toBeInTheDocument();
  });

  test('"Use a different email" returns to the form view', async () => {
    const sendLoginLink = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ user: null, loading: false, sendLoginLink });
    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'person@northwestern.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send me a link/i }));
    await screen.findByText('Check your email');

    fireEvent.click(screen.getByText('Use a different email'));
    expect(screen.getByRole('button', { name: /send me a link/i })).toBeInTheDocument();
  });
});
