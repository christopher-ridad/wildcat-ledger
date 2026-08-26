import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { renderWithRouter } from '../test/mocks';
import { PrivacyPage } from './PrivacyPage';

describe('PrivacyPage', () => {
  test('renders the policy heading and a contact link', () => {
    renderWithRouter(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
    const contactLinks = screen.getAllByRole('link', {
      name: /christopherridad@gmail\.com/i,
    });
    expect(contactLinks.length).toBeGreaterThan(0);
    contactLinks.forEach((link) =>
      expect(link).toHaveAttribute('href', 'mailto:christopherridad@gmail.com'),
    );
  });
});
