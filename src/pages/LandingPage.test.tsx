import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { renderWithRouter } from '../test/mocks';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  test('renders the headline and links every sign-in CTA to /login', () => {
    renderWithRouter(<LandingPage />);
    expect(
      screen.getByRole('heading', { name: /Track everything your student org spends/i }),
    ).toBeInTheDocument();

    const signInLinks = screen.getAllByRole('link', {
      name: /sign in with northwestern/i,
    });
    expect(signInLinks.length).toBeGreaterThan(0);
    signInLinks.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
  });

  test('links to the privacy policy', () => {
    renderWithRouter(<LandingPage />);
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  test('previews real budget lines and transaction data shapes from the dashboard', () => {
    renderWithRouter(<LandingPage />);
    expect(screen.getByText('Budget Lines Overview')).toBeInTheDocument();
    expect(screen.getByText('ASG')).toBeInTheDocument();
    expect(screen.getByText('Operating')).toBeInTheDocument();
    expect(screen.getByText('Gifts')).toBeInTheDocument();
    expect(screen.getByText('Debit Card')).toBeInTheDocument();
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
    expect(screen.getByText('Reconciled')).toBeInTheDocument();
  });

  test('highlights document tracking with attached and pending examples', () => {
    renderWithRouter(<LandingPage />);
    expect(screen.getByText('✓ Receipt')).toBeInTheDocument();
    expect(screen.getByText('✓ W-9')).toBeInTheDocument();
    expect(screen.getByText('✓ Contract')).toBeInTheDocument();
    expect(screen.getByText('Special Pay Form')).toBeInTheDocument();
  });
});
