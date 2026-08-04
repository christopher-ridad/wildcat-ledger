import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';

import { TopNav } from './TopNav';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

describe('TopNav', () => {
  test('renders the WildcatLedger logo and brand name', () => {
    render(
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>,
    );
    expect(screen.getByText('WildcatLedger')).toBeInTheDocument();
  });

  test('clicking the logo navigates to /organizations', () => {
    render(
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /go to home/i }));
    expect(navigateMock).toHaveBeenCalledWith('/organizations');
  });
});
