import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import App from './App';

describe('WildcatLedger App', () => {
  test('renders the login screen by default', async () => {
    render(<App />);

    // LoginPage is now code-split (see App.tsx), so it isn't in the DOM
    // until its chunk resolves -- find* waits for that instead of asserting
    // synchronously.
    expect(
      await screen.findByRole('heading', { name: /wildcatledger/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/enter your email to receive a sign-in link/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send me a link/i })).toBeInTheDocument();
  });
});
