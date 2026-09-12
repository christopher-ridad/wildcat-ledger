import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { renderWithRouter } from '../test/mocks';
import { FAQPage } from './FAQPage';

describe('FAQPage', () => {
  test('renders the heading and every section', () => {
    renderWithRouter(<FAQPage />);
    expect(
      screen.getByRole('heading', { name: /frequently asked questions/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Getting started')).toBeInTheDocument();
    expect(screen.getByText('Transactions & documents')).toBeInTheDocument();
    expect(screen.getByText('Approvals & edits')).toBeInTheDocument();
    expect(screen.getByText('Debit Card')).toBeInTheDocument();
    expect(screen.getByText('Financial Tasks')).toBeInTheDocument();
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
});
