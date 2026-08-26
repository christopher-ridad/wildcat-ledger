import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { MockAuthContextOptions, renderWithRouter } from '../../test/mocks';
import { TopNav } from './TopNav';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const renderTopNav = (authOverrides: MockAuthContextOptions = {}) =>
  renderWithRouter(<TopNav />, '/', authOverrides);

describe('TopNav', () => {
  test('renders the WildcatLedger logo and brand name', () => {
    renderTopNav();
    expect(screen.getByText('WildcatLedger')).toBeInTheDocument();
  });

  test('clicking the logo navigates to /organizations', () => {
    renderTopNav();
    fireEvent.click(screen.getByRole('button', { name: /go to home/i }));
    expect(navigateMock).toHaveBeenCalledWith('/organizations');
  });

  test('clicking Sign Out calls signOut', () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    renderTopNav({ signOut });
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });
});
