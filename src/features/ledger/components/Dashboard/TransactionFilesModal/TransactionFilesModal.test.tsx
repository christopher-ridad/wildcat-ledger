import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { getSignedFileUrl } from '../../../services/storage';
import { getTransactionFiles, TransactionFilesModal } from './TransactionFilesModal';

vi.mock('../../../services/storage', () => ({
  getSignedFileUrl: vi.fn(),
}));

const mockGetSignedFileUrl = vi.mocked(getSignedFileUrl);

describe('getTransactionFiles', () => {
  test('returns an empty array when no files are attached', () => {
    expect(getTransactionFiles(buildMockTransaction())).toEqual([]);
  });

  test('maps each populated file URL field to a labeled entry', () => {
    const t = buildMockTransaction({
      receiptFileUrl: 'orgs/1/receipt.png',
      w9FileUrl: 'orgs/1/w9.pdf',
    });
    expect(getTransactionFiles(t)).toEqual([
      { label: 'Receipt', url: 'orgs/1/receipt.png' },
      { label: 'W-9 Form', url: 'orgs/1/w9.pdf' },
    ]);
  });

  test('maps the Special Pay Form field', () => {
    const t = buildMockTransaction({ specialPayFormUrl: 'orgs/1/special-pay.pdf' });
    expect(getTransactionFiles(t)).toEqual([
      { label: 'Special Pay Form', url: 'orgs/1/special-pay.pdf' },
    ]);
  });
});

describe('TransactionFilesModal', () => {
  test('shows an empty state when the transaction has no attachments', () => {
    render(
      <TransactionFilesModal transaction={buildMockTransaction()} onClose={vi.fn()} />,
    );
    expect(
      screen.getByText('No files attached to this transaction.'),
    ).toBeInTheDocument();
  });

  test('shows the transaction title in the header', () => {
    render(
      <TransactionFilesModal
        transaction={buildMockTransaction({ title: 'Pizza for meeting' })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Attachments — Pizza for meeting')).toBeInTheDocument();
  });

  test('renders an image preview once the signed URL resolves', async () => {
    mockGetSignedFileUrl.mockResolvedValue('https://signed.example/receipt.png');
    render(
      <TransactionFilesModal
        transaction={buildMockTransaction({ receiptFileUrl: 'orgs/1/receipt.png' })}
        onClose={vi.fn()}
      />,
    );
    const img = await screen.findByAltText('Receipt');
    expect(img).toHaveAttribute('src', 'https://signed.example/receipt.png');
    expect(screen.getByText('Open in new tab ↗')).toBeInTheDocument();
  });

  test('falls back to a PDF placeholder when the signed URL fails to resolve', async () => {
    mockGetSignedFileUrl.mockRejectedValue(new Error('not found'));
    render(
      <TransactionFilesModal
        transaction={buildMockTransaction({ w9FileUrl: 'orgs/1/w9.pdf' })}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText('PDF Document')).toBeInTheDocument();
  });

  test('falls back to a PDF placeholder when the image itself fails to load', async () => {
    mockGetSignedFileUrl.mockResolvedValue('https://signed.example/receipt.png');
    render(
      <TransactionFilesModal
        transaction={buildMockTransaction({ receiptFileUrl: 'orgs/1/receipt.png' })}
        onClose={vi.fn()}
      />,
    );
    const img = await screen.findByAltText('Receipt');
    fireEvent.error(img);
    expect(await screen.findByText('PDF Document')).toBeInTheDocument();
  });

  test('clicking the close button calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <TransactionFilesModal transaction={buildMockTransaction()} onClose={onClose} />,
    );
    fireEvent.click(container.querySelector('.wl-modal-close') as Element);
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking the overlay calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <TransactionFilesModal transaction={buildMockTransaction()} onClose={onClose} />,
    );
    fireEvent.click(container.querySelector('.wl-modal-overlay') as Element);
    expect(onClose).toHaveBeenCalled();
  });

  test('pressing Enter on the overlay calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <TransactionFilesModal transaction={buildMockTransaction()} onClose={onClose} />,
    );
    fireEvent.keyDown(container.querySelector('.wl-modal-overlay') as Element, {
      key: 'Enter',
    });
    expect(onClose).toHaveBeenCalled();
  });
});
