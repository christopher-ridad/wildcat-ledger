import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { renderWithRouter } from '../test/mocks';
import { PrivacyPage } from './PrivacyPage';

const LocationDisplay = () => <div data-testid="location">{useLocation().pathname}</div>;

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

  test('the back button returns to wherever the visitor came from', () => {
    render(
      <MemoryRouter initialEntries={['/faq', '/privacy']} initialIndex={1}>
        <LocationDisplay />
        <Routes>
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/faq" element={<div>FAQ</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/privacy');

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/faq');
  });
});
