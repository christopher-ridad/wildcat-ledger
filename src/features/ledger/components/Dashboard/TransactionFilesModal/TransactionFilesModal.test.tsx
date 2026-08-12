import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction, MockLedgerProvider } from '../../../../../test/mocks';
import { getSignedFileUrl } from '../../../services/storage';
import { LedgerContextValue, Transaction } from '../../../types';
import { getTransactionFiles, TransactionFilesModal } from './TransactionFilesModal';

vi.mock('../../../services/storage', () => ({
  getSignedFileUrl: vi.fn(),
}));

const mockGetSignedFileUrl = vi.mocked(getSignedFileUrl);

const renderModal = (
  transaction: Transaction,
  onClose = vi.fn(),
  ledgerOverrides: Partial<LedgerContextValue> = {},
) =>
  render(
    <MockLedgerProvider value={{ activeOrganizationId: 'org-1', ...ledgerOverrides }}>
      <TransactionFilesModal transaction={transaction} onClose={onClose} />
    </MockLedgerProvider>,
  );

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
  test('shows an empty state when the transaction has no attachments or requirements', () => {
    renderModal(buildMockTransaction({ type: 'Deposit', budgetLine: 'Operating' }));
    expect(
      screen.getByText('No files attached to this transaction.'),
    ).toBeInTheDocument();
  });

  test('shows the transaction title in the header', () => {
    renderModal(buildMockTransaction({ title: 'Pizza for meeting' }));
    expect(screen.getByText('Documents — Pizza for meeting')).toBeInTheDocument();
  });

  test('renders an image preview once the signed URL resolves', async () => {
    mockGetSignedFileUrl.mockResolvedValue('https://signed.example/receipt.png');
    renderModal(buildMockTransaction({ receiptFileUrl: 'orgs/1/receipt.png' }));
    const img = await screen.findByAltText('Receipt');
    expect(img).toHaveAttribute('src', 'https://signed.example/receipt.png');
    expect(screen.getByText('Open in new tab ↗')).toBeInTheDocument();
  });

  test('falls back to a PDF placeholder when the signed URL fails to resolve', async () => {
    mockGetSignedFileUrl.mockRejectedValue(new Error('not found'));
    renderModal(buildMockTransaction({ w9FileUrl: 'orgs/1/w9.pdf' }));
    expect(await screen.findByText('PDF Document')).toBeInTheDocument();
  });

  test('falls back to a PDF placeholder when the image itself fails to load', async () => {
    mockGetSignedFileUrl.mockResolvedValue('https://signed.example/receipt.png');
    renderModal(buildMockTransaction({ receiptFileUrl: 'orgs/1/receipt.png' }));
    const img = await screen.findByAltText('Receipt');
    fireEvent.error(img);
    expect(await screen.findByText('PDF Document')).toBeInTheDocument();
  });

  test('clicking the close button calls onClose', () => {
    const onClose = vi.fn();
    const { container } = renderModal(buildMockTransaction(), onClose);
    fireEvent.click(container.querySelector('.wl-modal-close') as Element);
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking the overlay calls onClose', () => {
    const onClose = vi.fn();
    const { container } = renderModal(buildMockTransaction(), onClose);
    fireEvent.click(container.querySelector('.wl-modal-overlay') as Element);
    expect(onClose).toHaveBeenCalled();
  });

  test('pressing Enter on the overlay calls onClose', () => {
    const onClose = vi.fn();
    const { container } = renderModal(buildMockTransaction(), onClose);
    fireEvent.keyDown(container.querySelector('.wl-modal-overlay') as Element, {
      key: 'Enter',
    });
    expect(onClose).toHaveBeenCalled();
  });

  describe('missing documents', () => {
    test('lists required documents with no file under "Missing"', () => {
      renderModal(
        buildMockTransaction({ type: 'Payment Request', budgetLine: 'Operating' }),
      );
      expect(screen.getByText('Missing')).toBeInTheDocument();
      expect(screen.getByText('RSO Agreement')).toBeInTheDocument();
      expect(screen.getByText('W-9')).toBeInTheDocument();
    });

    test('does not show the Missing section once all required documents are attached', () => {
      mockGetSignedFileUrl.mockResolvedValue('https://signed.example/file');
      renderModal(
        buildMockTransaction({
          type: 'Payment Request',
          budgetLine: 'Operating',
          contractFileUrl: 'orgs/1/contract.pdf',
          w9FileUrl: 'orgs/1/w9.pdf',
        }),
      );
      expect(screen.queryByText('Missing')).not.toBeInTheDocument();
    });

    test('clicking "Request via Email" mints a token and opens a mail compose window', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const requestTransactionDocument = vi.fn().mockResolvedValue('the-token');
      renderModal(
        buildMockTransaction({
          id: 'txn-1',
          title: 'Guest speaker',
          type: 'Payment Request',
          budgetLine: 'Operating',
        }),
        vi.fn(),
        { requestTransactionDocument },
      );

      const [requestButton] = screen.getAllByText('Request via Email');
      fireEvent.click(requestButton);

      await vi.waitFor(() =>
        expect(requestTransactionDocument).toHaveBeenCalledWith('txn-1', 'contract'),
      );
      expect(openSpy).toHaveBeenCalled();
      const [url] = openSpy.mock.calls[0];
      expect(url).toContain('https://mail.google.com/mail/?view=cm');
      expect(
        await screen.findByText('Requested — waiting for upload'),
      ).toBeInTheDocument();
    });

    test('shows "Requested" for a document that already has a pending upload token', () => {
      renderModal(
        buildMockTransaction({
          type: 'Payment Request',
          budgetLine: 'Operating',
          uploadTokens: { contract: 'existing-token' },
        }),
      );
      expect(screen.getByText('Requested — waiting for upload')).toBeInTheDocument();
    });

    test('shows an error message when the request fails', async () => {
      const requestTransactionDocument = vi
        .fn()
        .mockRejectedValue(new Error('Network unavailable'));
      renderModal(
        buildMockTransaction({ type: 'Payment Request', budgetLine: 'Operating' }),
        vi.fn(),
        { requestTransactionDocument },
      );

      const [requestButton] = screen.getAllByText('Request via Email');
      fireEvent.click(requestButton);

      expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
    });
  });
});
