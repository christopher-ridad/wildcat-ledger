import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { renderWithRouter } from '../test/mocks';
import { FAQPage } from './FAQPage';

const LocationDisplay = () => <div data-testid="location">{useLocation().pathname}</div>;

describe('FAQPage', () => {
  test('renders the heading and every section', () => {
    renderWithRouter(<FAQPage />);
    expect(
      screen.getByRole('heading', { name: /frequently asked questions/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Getting started' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Transaction types' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Documents & requests' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Approvals & edits' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financial Tasks' })).toBeInTheDocument();
  });

  test('answers start collapsed and expand when their question is clicked', () => {
    renderWithRouter(<FAQPage />);
    const question = screen.getByText('Who can use WildcatLedger?');
    const details = question.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');

    fireEvent.click(question);
    expect(details).toHaveAttribute('open');
  });

  test('has a working contact link', () => {
    renderWithRouter(<FAQPage />);
    const link = screen.getByRole('link', { name: /christopherridad@gmail\.com/i });
    expect(link).toHaveAttribute('href', 'mailto:christopherridad@gmail.com');
  });

  test('links to the actual Privacy Policy page, not just plain text', () => {
    renderWithRouter(<FAQPage />);
    fireEvent.click(screen.getByText('Who can see my organization’s data?'));
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  test('the table of contents links to every section', () => {
    renderWithRouter(<FAQPage />);
    const toc = screen.getByRole('navigation', { name: /table of contents/i });
    expect(within(toc).getByRole('link', { name: 'Transaction types' })).toHaveAttribute(
      'href',
      '#transaction-types',
    );
    expect(within(toc).getByRole('link', { name: 'Financial Tasks' })).toHaveAttribute(
      'href',
      '#financial-tasks',
    );
  });

  const setSectionOffsets = (offsets: Record<string, number>) => {
    Object.entries(offsets).forEach(([slug, offsetTop]) => {
      const el = document.getElementById(slug);
      if (el) {
        Object.defineProperty(el, 'offsetTop', { value: offsetTop, configurable: true });
      }
    });
  };

  const scrollTo = (scrollY: number) => {
    Object.defineProperty(window, 'scrollY', { value: scrollY, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
  };

  test('marks the sidebar link for the currently scrolled-to section as active', () => {
    renderWithRouter(<FAQPage />);

    // Mirrors a real layout where the trailing sections are short and end
    // up close together near the bottom of a long page.
    setSectionOffsets({
      'getting-started': 0,
      'transaction-types': 500,
      'documents-requests': 4000,
      'approvals-edits': 4300,
      'financial-tasks': 4400,
      other: 4450,
    });

    scrollTo(4270);

    const toc = screen.getByRole('navigation', { name: /table of contents/i });
    expect(within(toc).getByRole('link', { name: 'Financial Tasks' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(
      within(toc).getByRole('link', { name: 'Approvals & edits' }),
    ).not.toHaveAttribute('aria-current');
  });

  test('resolves to the last section even when trailing sections are short and compressed near the bottom', () => {
    renderWithRouter(<FAQPage />);

    setSectionOffsets({
      'getting-started': 0,
      'transaction-types': 500,
      'documents-requests': 4000,
      'approvals-edits': 4300,
      'financial-tasks': 4400,
      other: 4450,
    });

    scrollTo(9000);

    const toc = screen.getByRole('navigation', { name: /table of contents/i });
    expect(within(toc).getByRole('link', { name: 'Other' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('Payment Request links to the real blank RSO Agreement template', () => {
    renderWithRouter(<FAQPage />);
    fireEvent.click(screen.getByText('Payment Request'));
    expect(screen.getByRole('link', { name: 'RSO Agreement' })).toHaveAttribute(
      'href',
      '/forms/rso-agreement.pdf',
    );
  });

  test('Debit Card transaction type links to the real Policy Exemption Form', () => {
    renderWithRouter(<FAQPage />);
    const question = screen.getByText('Debit Card', { selector: '.wl-faq-question' });
    const item = question.closest('details');
    expect(item).not.toBeNull();
    fireEvent.click(question);
    expect(
      within(item as HTMLElement).getByRole('link', { name: 'Policy Exemption Form' }),
    ).toHaveAttribute(
      'href',
      'https://www.northwestern.edu/financial-operations/policies-procedures/forms/policy_exception.pdf',
    );
  });

  test('the back button returns to wherever the visitor came from', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard', '/faq']} initialIndex={1}>
        <LocationDisplay />
        <Routes>
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/faq');

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });
});
