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

  test("maps a Debit Card purchase's exemption form, even with no receipt attached", () => {
    // Regression: a Debit Card purchase covered only by an exemption form
    // (no receipt) used to have zero attached files and nothing missing --
    // so the "View files" button vanished entirely, with no way left to
    // open the exemption form that was actually saved.
    const t = buildMockTransaction({ exemptionFormUrl: 'orgs/1/exemption.pdf' });
    expect(getTransactionFiles(t)).toEqual([
      { label: 'Policy Exemption Form', url: 'orgs/1/exemption.pdf' },
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

  test('pressing Escape calls onClose', () => {
    const onClose = vi.fn();
    renderModal(buildMockTransaction(), onClose);
    fireEvent.keyDown(document, { key: 'Escape' });
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

    test('a simple-request document (W-9) shows a "Request via Email" button', () => {
      renderModal(
        buildMockTransaction({ type: 'Payment Request', budgetLine: 'Operating' }),
      );
      expect(screen.getByText('Request via Email')).toBeInTheDocument();
    });

    test('a prepare-first document (contract) shows "Send for Signature" and a prep reminder', () => {
      renderModal(
        buildMockTransaction({ type: 'Payment Request', budgetLine: 'Operating' }),
      );
      expect(screen.getByText('Send for Signature')).toBeInTheDocument();
      expect(screen.getByText(/attach your version to the email/)).toBeInTheDocument();
    });

    test('a self-created document (Conflict of Interest) shows no request button', () => {
      renderModal(
        buildMockTransaction({
          type: 'Payment Request',
          budgetLine: 'Operating',
          isIndividualVendor: true,
          contractFileUrl: 'orgs/1/contract.pdf',
          w9FileUrl: 'orgs/1/w9.pdf',
          contractedServicesFileUrl: 'orgs/1/cs.pdf',
        }),
      );
      expect(screen.getByText('Conflict of Interest Form')).toBeInTheDocument();
      expect(screen.getByText(/complete and upload it yourself/)).toBeInTheDocument();
      expect(screen.queryByText('Request via Email')).not.toBeInTheDocument();
      expect(screen.queryByText('Send for Signature')).not.toBeInTheDocument();
    });

    test('shows a blank-template download link for documents that have one', () => {
      renderModal(
        buildMockTransaction({ type: 'Payment Request', budgetLine: 'Operating' }),
      );
      const link = screen.getByText('↓ Blank RSO Agreement');
      expect(link).toHaveAttribute('href', '/forms/rso-agreement.pdf');
    });

    test('clicking "Request via Email" on a simple document mints a token and opens a mail compose window', async () => {
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

      fireEvent.click(screen.getByText('Request via Email'));

      await vi.waitFor(() =>
        expect(requestTransactionDocument).toHaveBeenCalledWith('txn-1', 'w9'),
      );
      expect(openSpy).toHaveBeenCalled();
      const [url] = openSpy.mock.calls[0];
      expect(url).toContain('https://mail.google.com/mail/?view=cm');
      expect(
        await screen.findByText('Requested — waiting for upload'),
      ).toBeInTheDocument();
    });

    test('clicking "Send for Signature" on a prepare-first document mints a token for it', async () => {
      vi.spyOn(window, 'open').mockImplementation(() => null);
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

      fireEvent.click(screen.getByText('Send for Signature'));

      await vi.waitFor(() =>
        expect(requestTransactionDocument).toHaveBeenCalledWith('txn-1', 'contract'),
      );
    });

    test('shows "Requested" for a document that already has a pending upload token', () => {
      renderModal(
        buildMockTransaction({
          type: 'Payment Request',
          budgetLine: 'Operating',
          uploadTokens: { w9: { token: 'existing-token', mintedAt: Date.now() } },
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

      fireEvent.click(screen.getByText('Request via Email'));

      expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
    });
  });
});
