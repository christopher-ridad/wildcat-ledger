import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import App from './App';

describe('WildcatLedger App', () => {
  test('renders the login screen by default', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /wildcatledger/i })).toBeInTheDocument();
    expect(
      screen.getByText(/enter your email to receive a sign-in link/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send me a link/i })).toBeInTheDocument();
  });
});
