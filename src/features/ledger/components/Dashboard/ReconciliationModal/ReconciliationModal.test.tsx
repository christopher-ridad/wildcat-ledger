import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  buildMockAuditEntry,
  buildMockOrganization,
  buildMockTransaction,
  MockLedgerProvider,
} from '../../../../../test/mocks';
import { downloadReceiptsZip } from '../../../services/downloadReceiptsZip';
import { LedgerContextValue } from '../../../types';
import { ReconciliationModal } from './ReconciliationModal';

vi.mock('../../../services/downloadReceiptsZip', () => ({
  downloadReceiptsZip: vi.fn().mockResolvedValue(undefined),
}));

const mockDownloadZip = vi.mocked(downloadReceiptsZip);

const renderModal = (ledgerOverrides: Partial<LedgerContextValue> = {}, isOpen = true) =>
  render(
    <MockLedgerProvider value={ledgerOverrides}>
      <ReconciliationModal isOpen={isOpen} onClose={vi.fn()} />
    </MockLedgerProvider>,
  );

describe('ReconciliationModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders nothing when closed', () => {
    const { container } = renderModal({}, false);
    expect(container).toBeEmptyDOMElement();
  });

  test('shows an empty state when there are no unreconciled debit-card transactions', () => {
    renderModal({ activeOrganization: buildMockOrganization({ transactions: [] }) });
    expect(
      screen.getByText('All debit card transactions are already reconciled.'),
    ).toBeInTheDocument();
  });

  test('auto-selects fully-covered transactions and shows a matching confirm count', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
        }),
        buildMockTransaction({
          id: 't2',
          budgetLine: 'Debit Card',
          exemptionFormUrl: 'e1',
        }),
      ],
    });
    renderModal({ activeOrganization: org });
    expect(screen.getByRole('button', { name: 'Confirm & Reconcile (2)' })).toBeEnabled();
  });

  test('blocks confirmation entirely when any transaction is missing a receipt/exemption form', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
        }),
        buildMockTransaction({ id: 't2', budgetLine: 'Debit Card' }),
      ],
    });
    renderModal({ activeOrganization: org });
    expect(
      screen.getByText(/1 transaction cannot be reconciled until it has a receipt/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm & Reconcile/ })).toBeDisabled();
  });

  test('confirming reconciles the selected transactions and shows a success summary', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
          amount: 20,
          direction: 'Outflow',
        }),
        buildMockTransaction({
          id: 't2',
          budgetLine: 'Debit Card',
          exemptionFormUrl: 'e1',
          amount: 30,
          direction: 'Outflow',
        }),
      ],
    });
    renderModal({ activeOrganization: org, reconcileTransactions });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (2)' }));

    await vi.waitFor(() => expect(reconcileTransactions).toHaveBeenCalled());
    const [ids] = reconcileTransactions.mock.calls[0];
    expect(new Set(ids)).toEqual(new Set(['t1', 't2']));

    expect(await screen.findByText('Reconciliation complete!')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  test('uploading an exemption form for a missing-receipt transaction calls uploadExemptionForm', async () => {
    const uploadExemptionForm = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      transactions: [buildMockTransaction({ id: 't1', budgetLine: 'Debit Card' })],
    });
    const { container } = renderModal({ activeOrganization: org, uploadExemptionForm });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'exemption.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await vi.waitFor(() => expect(uploadExemptionForm).toHaveBeenCalledWith('t1', file));
  });

  test('shows an upload error message when the exemption form upload fails', async () => {
    const uploadExemptionForm = vi.fn().mockRejectedValue(new Error('Upload rejected'));
    const org = buildMockOrganization({
      transactions: [buildMockTransaction({ id: 't1', budgetLine: 'Debit Card' })],
    });
    const { container } = renderModal({ activeOrganization: org, uploadExemptionForm });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'exemption.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('Upload rejected')).toBeInTheDocument();
  });

  test('shows a Receipts ZIP button after reconciling covered transactions, and downloads on click', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
        }),
      ],
    });
    renderModal({ activeOrganization: org, reconcileTransactions });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    const zipButton = await screen.findByText(/Receipts ZIP \(1\)/);
    fireEvent.click(zipButton);

    await vi.waitFor(() => expect(mockDownloadZip).toHaveBeenCalled());
  });

  test('"Done" calls onClose from the success step', async () => {
    const onClose = vi.fn();
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
        }),
      ],
    });
    render(
      <MockLedgerProvider value={{ activeOrganization: org, reconcileTransactions }}>
        <ReconciliationModal isOpen onClose={onClose} />
      </MockLedgerProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalled();
  });

  test('pre-fills the reload amount with the current total when there is no reconciliation history', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
          amount: 50,
          direction: 'Outflow',
        }),
      ],
    });
    renderModal({ activeOrganization: org, reconcileTransactions });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');

    expect(screen.getByLabelText('Amount')).toHaveValue('50.00');
  });

  test('averages the current total with past reconciliations for the suggested reload amount', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
          amount: 50,
          direction: 'Outflow',
        }),
      ],
    });
    const auditLog = [
      buildMockAuditEntry({
        action: 'reconcile',
        reconciliationSummary: {
          transactionCount: 2,
          totalAmount: 100,
          exemptionCount: 0,
          transactionIds: ['a', 'b'],
        },
      }),
    ];
    renderModal({ activeOrganization: org, reconcileTransactions, auditLog });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');

    expect(screen.getByLabelText('Amount')).toHaveValue('75.00');
  });

  test('lets the user override the amount, and submitting calls requestReload', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    const requestReload = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
          amount: 50,
          direction: 'Outflow',
        }),
      ],
    });
    renderModal({ activeOrganization: org, reconcileTransactions, requestReload });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));

    await vi.waitFor(() => expect(requestReload).toHaveBeenCalledWith(200, 50, 1));
    expect(
      await screen.findByText(/Reload request for \$200\.00 submitted/),
    ).toBeInTheDocument();
  });

  test('shows an error message when the reload request fails', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    const requestReload = vi.fn().mockRejectedValue(new Error('Reload rejected'));
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
          amount: 50,
          direction: 'Outflow',
        }),
      ],
    });
    renderModal({ activeOrganization: org, reconcileTransactions, requestReload });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));

    expect(await screen.findByText('Reload rejected')).toBeInTheDocument();
  });

  test('pressing Escape calls onClose', () => {
    const onClose = vi.fn();
    render(
      <MockLedgerProvider value={{}}>
        <ReconciliationModal isOpen onClose={onClose} />
      </MockLedgerProvider>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking the overlay calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <MockLedgerProvider value={{}}>
        <ReconciliationModal isOpen onClose={onClose} />
      </MockLedgerProvider>,
    );
    fireEvent.click(container.querySelector('.wl-modal-overlay') as Element);
    expect(onClose).toHaveBeenCalled();
  });
});
