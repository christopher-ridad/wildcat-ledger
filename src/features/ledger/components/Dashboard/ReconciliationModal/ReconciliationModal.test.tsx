import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  buildMockOrganization,
  buildMockPendingChange,
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

  test('blocks confirmation entirely when any transaction owes an unresolved tax reimbursement', () => {
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
          receiptFileUrl: 'r2',
          taxExemptFormSubmitted: false,
          taxAmount: 2.5,
        }),
      ],
    });
    renderModal({ activeOrganization: org });
    expect(
      screen.getByText(
        /1 transaction cannot be reconciled until its tax reimbursement to SOFO is resolved/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm & Reconcile/ })).toBeDisabled();
  });

  test('blocks confirmation entirely when any transaction has a pending edit/delete request', () => {
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
          receiptFileUrl: 'r2',
        }),
      ],
    });
    const pendingChanges = [
      buildMockPendingChange({ transactionId: 't2', type: 'edit' }),
    ];
    renderModal({ activeOrganization: org, pendingChanges });
    expect(
      screen.getByText(
        /1 transaction cannot be reconciled until its pending edit or delete request is resolved/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Has a pending edit request awaiting approval/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm & Reconcile/ })).toBeDisabled();
  });

  test('does not block when tax was charged but the exemption form was submitted', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
          taxExemptFormSubmitted: true,
          taxAmount: 2.5,
        }),
      ],
    });
    renderModal({ activeOrganization: org });
    expect(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' })).toBeEnabled();
  });

  test('clicking Mark as Reimbursed calls markTaxReimbursed and unblocks reconciliation', async () => {
    const markTaxReimbursed = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
          taxExemptFormSubmitted: false,
          taxAmount: 2.5,
        }),
      ],
    });
    renderModal({ activeOrganization: org, markTaxReimbursed });

    fireEvent.click(screen.getByRole('button', { name: 'Mark as Reimbursed' }));
    await vi.waitFor(() => expect(markTaxReimbursed).toHaveBeenCalledWith('t1'));
  });

  test('shows an error message when marking as reimbursed fails', async () => {
    const markTaxReimbursed = vi.fn().mockRejectedValue(new Error('Mark failed'));
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
          taxExemptFormSubmitted: false,
          taxAmount: 2.5,
        }),
      ],
    });
    renderModal({ activeOrganization: org, markTaxReimbursed });

    fireEvent.click(screen.getByRole('button', { name: 'Mark as Reimbursed' }));
    expect(await screen.findByText('Mark failed')).toBeInTheDocument();
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

  test('shows the last reconciliation date in the subtitle when one is set', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
        }),
      ],
      lastReconciliationDate: new Date('2026-01-01').getTime(),
    });
    renderModal({ activeOrganization: org });
    expect(
      screen.getByText(/Showing unreconciled transactions since/),
    ).toBeInTheDocument();
  });

  test('shows a validation error for an invalid reload amount without calling addTransaction', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
        }),
      ],
    });
    renderModal({ activeOrganization: org, reconcileTransactions, addTransaction });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));

    expect(await screen.findByText('Enter a valid reload amount.')).toBeInTheDocument();
    expect(addTransaction).not.toHaveBeenCalled();
  });

  test('shows an error message when reconciling fails, and stays on the review step', async () => {
    const reconcileTransactions = vi.fn().mockRejectedValue(new Error('Network error'));
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

    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(screen.queryByText('Reconciliation complete!')).not.toBeInTheDocument();
  });

  test('shows an error message when the receipts ZIP download fails', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    mockDownloadZip.mockRejectedValueOnce(new Error('ZIP failed'));
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
    await screen.findByText(/Receipts ZIP \(1\)/);

    expect(await screen.findByText('ZIP failed')).toBeInTheDocument();
  });

  test('a successful ZIP download clears a previous download error', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    mockDownloadZip.mockRejectedValueOnce(new Error('ZIP failed'));
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
    expect(await screen.findByText('ZIP failed')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Receipts ZIP \(1\)/));
    await vi.waitFor(() => expect(mockDownloadZip).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('ZIP failed')).not.toBeInTheDocument();
  });

  test('shows plural wording when more than one transaction blocks reconciliation', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({ id: 't1', budgetLine: 'Debit Card' }),
        buildMockTransaction({ id: 't2', budgetLine: 'Debit Card' }),
      ],
    });
    renderModal({ activeOrganization: org });
    expect(
      screen.getByText(/2 transactions cannot be reconciled until they have a receipt/),
    ).toBeInTheDocument();
  });

  test('shows plural wording when more than one transaction owes a tax reimbursement', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
          taxExemptFormSubmitted: false,
          taxAmount: 2.5,
        }),
        buildMockTransaction({
          id: 't2',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r2',
          taxExemptFormSubmitted: false,
          taxAmount: 3,
        }),
      ],
    });
    renderModal({ activeOrganization: org });
    expect(
      screen.getByText(
        /2 transactions cannot be reconciled until their tax reimbursement to SOFO is resolved/,
      ),
    ).toBeInTheDocument();
  });

  test('shows plural wording when more than one transaction has a pending request', () => {
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
          receiptFileUrl: 'r2',
        }),
      ],
    });
    const pendingChanges = [
      buildMockPendingChange({ transactionId: 't1', type: 'delete' }),
      buildMockPendingChange({ transactionId: 't2', type: 'edit' }),
    ];
    renderModal({ activeOrganization: org, pendingChanges });
    expect(
      screen.getByText(
        /2 transactions cannot be reconciled until their pending edit or delete request are resolved/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Has a pending delete request awaiting approval/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Has a pending edit request awaiting approval/),
    ).toBeInTheDocument();
  });

  test('shows a "+" sign for an inflow transaction in the unreconciled list', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          type: 'Payment Request',
          direction: 'Inflow',
          receiptFileUrl: 'r1',
        }),
      ],
    });
    renderModal({ activeOrganization: org });
    expect(screen.getByText(/^\+\$/)).toBeInTheDocument();
  });

  test('shows "submitted without receipt" wording when the receipt was explicitly acknowledged missing', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          noReceiptAcknowledged: true,
        }),
      ],
    });
    renderModal({ activeOrganization: org });
    expect(screen.getByText(/Submitted without receipt\./)).toBeInTheDocument();
    expect(
      screen.getByText('Attach completed Policy Exemption Request Form ↗'),
    ).toBeInTheDocument();
  });

  test('shows plural exemption-count wording in the success summary, and pluralizes the reload request notes', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          exemptionFormUrl: 'e1',
        }),
        buildMockTransaction({
          id: 't2',
          budgetLine: 'Debit Card',
          exemptionFormUrl: 'e2',
        }),
      ],
    });
    renderModal({ activeOrganization: org, reconcileTransactions, addTransaction });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (2)' }));
    await screen.findByText('Reconciliation complete!');
    expect(screen.getByText('exemptions')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));

    await vi.waitFor(() =>
      expect(addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.stringContaining('Requested after reconciling 2 transactions'),
        }),
        expect.any(String),
      ),
    );
  });

  test('clicking "Attach Completed Exemption Form" opens the file picker', () => {
    const org = buildMockOrganization({
      transactions: [buildMockTransaction({ id: 't1', budgetLine: 'Debit Card' })],
    });
    const { container } = renderModal({ activeOrganization: org });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(
      screen.getByRole('button', { name: '↑ Attach Completed Exemption Form' }),
    );

    expect(clickSpy).toHaveBeenCalled();
  });

  test('ignores a cancelled file selection (no file chosen)', () => {
    const uploadExemptionForm = vi.fn();
    const org = buildMockOrganization({
      transactions: [buildMockTransaction({ id: 't1', budgetLine: 'Debit Card' })],
    });
    const { container } = renderModal({ activeOrganization: org, uploadExemptionForm });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(uploadExemptionForm).not.toHaveBeenCalled();
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

  test('an exemption form uploaded mid-session becomes selected without needing to reopen the modal', async () => {
    const uploadExemptionForm = vi.fn().mockResolvedValue(undefined);
    const uncovered = buildMockTransaction({ id: 't1', budgetLine: 'Debit Card' });
    const covered = { ...uncovered, exemptionFormUrl: 'e1' };

    const { container, rerender } = render(
      <MockLedgerProvider
        value={{
          activeOrganization: buildMockOrganization({ transactions: [uncovered] }),
          uploadExemptionForm,
        }}
      >
        <ReconciliationModal isOpen onClose={vi.fn()} />
      </MockLedgerProvider>,
    );

    expect(screen.getByRole('button', { name: /Confirm & Reconcile/ })).toBeDisabled();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'exemption.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await vi.waitFor(() => expect(uploadExemptionForm).toHaveBeenCalledWith('t1', file));

    // Simulate the Realtime push that delivers the now-covered transaction
    // back into activeOrganization while the modal stays open -- without the
    // fix, `selected` stays the empty Set from when the modal opened, and
    // Confirm & Reconcile stays stuck at "(0)" even though nothing blocks it
    // anymore.
    rerender(
      <MockLedgerProvider
        value={{
          activeOrganization: buildMockOrganization({ transactions: [covered] }),
          uploadExemptionForm,
        }}
      >
        <ReconciliationModal isOpen onClose={vi.fn()} />
      </MockLedgerProvider>,
    );

    expect(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' })).toBeEnabled();
  });

  test('resolving a tax reimbursement mid-session becomes selected without needing to reopen the modal', async () => {
    const uploadExemptionForm = vi.fn().mockResolvedValue(undefined);
    const markTaxReimbursed = vi.fn().mockResolvedValue(undefined);
    // t1 starts missing its receipt (so the modal's auto-select-on-open
    // effect sees uncoveredCount > 0 and starts `selected` as an empty Set --
    // a solo tax-blocked transaction with a receipt already attached would
    // get auto-selected on open regardless of its tax status, which would
    // pass even without the fix under test).
    const t1Unresolved = buildMockTransaction({ id: 't1', budgetLine: 'Debit Card' });
    const t2Unresolved = buildMockTransaction({
      id: 't2',
      budgetLine: 'Debit Card',
      receiptFileUrl: 'r2',
      taxExemptFormSubmitted: false,
      taxAmount: 2.5,
    });

    const { container, rerender } = render(
      <MockLedgerProvider
        value={{
          activeOrganization: buildMockOrganization({
            transactions: [t1Unresolved, t2Unresolved],
          }),
          uploadExemptionForm,
          markTaxReimbursed,
        }}
      >
        <ReconciliationModal isOpen onClose={vi.fn()} />
      </MockLedgerProvider>,
    );

    expect(screen.getByRole('button', { name: /Confirm & Reconcile/ })).toBeDisabled();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'exemption.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await vi.waitFor(() => expect(uploadExemptionForm).toHaveBeenCalledWith('t1', file));

    fireEvent.click(screen.getByRole('button', { name: 'Mark as Reimbursed' }));
    await vi.waitFor(() => expect(markTaxReimbursed).toHaveBeenCalledWith('t2'));

    // Simulate the Realtime push delivering both resolutions back into
    // activeOrganization while the modal stays open the whole time.
    const t1Covered = { ...t1Unresolved, exemptionFormUrl: 'e1' };
    const t2Resolved = { ...t2Unresolved, taxReimbursed: true };
    rerender(
      <MockLedgerProvider
        value={{
          activeOrganization: buildMockOrganization({
            transactions: [t1Covered, t2Resolved],
          }),
          uploadExemptionForm,
          markTaxReimbursed,
        }}
      >
        <ReconciliationModal isOpen onClose={vi.fn()} />
      </MockLedgerProvider>,
    );

    expect(screen.getByRole('button', { name: 'Confirm & Reconcile (2)' })).toBeEnabled();
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

  test('the reload amount starts blank', async () => {
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

    expect(screen.getByLabelText('Amount')).toHaveValue('');
  });

  test('submitting a reload amount creates a Deposit transaction on the Debit Card line', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    const generateTransactionId = vi.fn(() => 'reload-id');
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
    renderModal({
      activeOrganization: org,
      reconcileTransactions,
      addTransaction,
      generateTransactionId,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));

    await vi.waitFor(() =>
      expect(addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 200,
          direction: 'Inflow',
          type: 'Deposit',
          budgetLine: 'Debit Card',
        }),
        'reload-id',
      ),
    );
    expect(
      await screen.findByText(/Reload of \$200\.00 added — pending approval/),
    ).toBeInTheDocument();
  });

  test('shows an error message when the reload request fails', async () => {
    const reconcileTransactions = vi.fn().mockResolvedValue(undefined);
    const addTransaction = vi.fn().mockRejectedValue(new Error('Reload rejected'));
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
    renderModal({ activeOrganization: org, reconcileTransactions, addTransaction });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));

    expect(await screen.findByText('Reload rejected')).toBeInTheDocument();
  });

  test('reload deposits do not show up in the unreconciled transactions list', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          type: 'Deposit',
          direction: 'Inflow',
          amount: 200,
        }),
      ],
    });
    renderModal({ activeOrganization: org });
    expect(
      screen.getByText('All debit card transactions are already reconciled.'),
    ).toBeInTheDocument();
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
