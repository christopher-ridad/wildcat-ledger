import { fireEvent, render, screen, within } from '@testing-library/react';
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

  test('links to the real SOFO Microsoft Form and Cashier’s Office email', () => {
    renderWithRouter(<FAQPage />);
    fireEvent.click(screen.getByText('How do I actually submit a transaction?'));
    expect(screen.getByRole('link', { name: 'SOFO Microsoft Form' })).toHaveAttribute(
      'href',
      'https://forms.office.com/Pages/ResponsePage.aspx?id=YdN2fXeCCEekd2ToNmzRvPTAeBa6n3hLtPXRTAWTmwxUQUZHMU45WUpIV1BEV0xNWFZSRjdOUllMVyQlQCN0PWcu',
    );
    expect(
      screen.getByRole('link', { name: 'Norris-Cashier@northwestern.edu' }),
    ).toHaveAttribute('href', 'mailto:Norris-Cashier@northwestern.edu');
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
