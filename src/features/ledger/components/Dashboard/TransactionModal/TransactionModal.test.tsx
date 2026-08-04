import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { TransactionModal } from './TransactionModal';

vi.mock('../AddTransactionForm', () => ({
  AddTransactionForm: () => <div data-testid="add-transaction-form" />,
}));

describe('TransactionModal', () => {
  test('renders nothing when closed', () => {
    const { container } = render(<TransactionModal isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('shows "Add Transaction" when there is no existing transaction', () => {
    render(<TransactionModal isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeInTheDocument();
  });

  test('shows "Edit Transaction" when editing an existing transaction', () => {
    render(
      <TransactionModal
        isOpen
        onClose={vi.fn()}
        existingTransaction={buildMockTransaction()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Edit Transaction' })).toBeInTheDocument();
  });

  test('clicking the close button calls onClose', () => {
    const onClose = vi.fn();
    render(<TransactionModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking the overlay calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<TransactionModal isOpen onClose={onClose} />);
    fireEvent.click(container.querySelector('.wl-modal-overlay') as Element);
    expect(onClose).toHaveBeenCalled();
  });

  test('pressing Escape calls onClose', () => {
    const onClose = vi.fn();
    render(<TransactionModal isOpen onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('does not listen for Escape when closed', () => {
    const onClose = vi.fn();
    render(<TransactionModal isOpen={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
