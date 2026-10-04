import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  buildMockOrganization,
  buildMockPendingChange,
  buildMockTransaction,
  MockLedgerProvider,
} from '../../../../../test/mocks';
import { ReconciliationFormData } from '../../../services/debitCardReconciliationForm';
import { downloadReceiptsZip } from '../../../services/downloadReceiptsZip';
import {
  downloadReconciliationPdf,
  generateReconciliationPdf,
} from '../../../services/generateReconciliationPdf';
import {
  LedgerContextValue,
  ReconciliationRound,
  ReconciliationRoundUpdate,
} from '../../../types';
import { ReconciliationModal } from './ReconciliationModal';

vi.mock('../../../services/downloadReceiptsZip', () => ({
  downloadReceiptsZip: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/generateReconciliationPdf', () => ({
  generateReconciliationPdf: vi.fn().mockResolvedValue(new Blob()),
  downloadReconciliationPdf: vi.fn(),
}));

const mockDownloadZip = vi.mocked(downloadReceiptsZip);
const mockGeneratePdf = vi.mocked(generateReconciliationPdf);
const mockDownloadPdf = vi.mocked(downloadReconciliationPdf);

// Stand-ins for the saved round: reconciling saves it, and updates merge into
// it, the way the database row does.
let savedRound: ReconciliationRound;
const mockReconcile = () =>
  vi.fn(async (transactionIds: string[], formData: ReconciliationFormData) => {
    savedRound = {
      id: 'round-1',
      reconciledAt: Date.parse('2026-10-03T12:00:00'),
      transactionIds,
      formData,
    };
    return savedRound;
  });
const mockUpdateRound = () =>
  vi.fn(async (_id: string, patch: ReconciliationRoundUpdate) => {
    savedRound = { ...savedRound, ...patch };
    return savedRound;
  });

// Enough in ASG to pay for any reload these tests request.
const FUNDED_ASG = { ASG: 1000, Operating: 0, Gifts: 0, 'Debit Card': 0 };

const renderModal = (ledgerOverrides: Partial<LedgerContextValue> = {}, isOpen = true) =>
  render(
    <MockLedgerProvider
      value={{ updateReconciliationRound: mockUpdateRound(), ...ledgerOverrides }}
    >
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

  test('a recent purchase missing a receipt can be left out so the older ones reconcile', async () => {
    const reconcileTransactions = mockReconcile();
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 'older',
          date: '2026-09-01',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
        }),
        buildMockTransaction({
          id: 'newer',
          date: '2026-09-02',
          budgetLine: 'Debit Card',
        }),
      ],
    });
    renderModal({ activeOrganization: org, reconcileTransactions });

    expect(
      screen.getByText(/1 transaction cannot be reconciled until it has a receipt/),
    ).toBeInTheDocument();
    const [newer, older] = screen.getAllByRole('checkbox');
    expect(newer).not.toBeChecked();
    expect(newer).toBeDisabled();
    expect(older).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await vi.waitFor(() =>
      expect(reconcileTransactions).toHaveBeenCalledWith(['older'], expect.anything()),
    );
  });

  test('an older purchase owing tax holds back everything newer', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 'older',
          date: '2026-09-01',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
          taxExemptFormSubmitted: false,
          taxAmount: 2.5,
        }),
        buildMockTransaction({
          id: 'newer',
          date: '2026-09-02',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r2',
        }),
      ],
    });
    renderModal({ activeOrganization: org });

    expect(
      screen.getByText(
        /1 transaction cannot be reconciled until its tax reimbursement to SOFO is resolved/,
      ),
    ).toBeInTheDocument();
    const [newer, older] = screen.getAllByRole('checkbox');
    expect(newer).toBeDisabled();
    expect(older).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Confirm & Reconcile (0)' }),
    ).toBeDisabled();
  });

  test('a recent purchase with a pending request can be left out so the older ones reconcile', async () => {
    const reconcileTransactions = mockReconcile();
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 'older',
          date: '2026-09-01',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
        }),
        buildMockTransaction({
          id: 'newer',
          date: '2026-09-02',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r2',
        }),
      ],
    });
    const pendingChanges = [
      buildMockPendingChange({ transactionId: 'newer', type: 'edit' }),
    ];
    renderModal({ activeOrganization: org, pendingChanges, reconcileTransactions });

    expect(
      screen.getByText(
        /1 transaction cannot be reconciled until its pending edit or delete request is resolved/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Has a pending edit request awaiting approval/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await vi.waitFor(() =>
      expect(reconcileTransactions).toHaveBeenCalledWith(['older'], expect.anything()),
    );
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
    const reconcileTransactions = mockReconcile();
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

  test("a service fee reconciles without a receipt and counts toward the form's reload amount", async () => {
    const reconcileTransactions = mockReconcile();
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      budgetAllocations: FUNDED_ASG,
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
          amount: 50,
          direction: 'Outflow',
        }),
        buildMockTransaction({
          id: 'fee',
          budgetLine: 'Debit Card',
          amount: 3,
          direction: 'Outflow',
          isServiceFee: true,
        }),
      ],
    });
    renderModal({ activeOrganization: org, reconcileTransactions, addTransaction });

    expect(screen.getByText('Service fee')).toBeInTheDocument();
    expect(screen.queryByText(/No receipt on file/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (2)' }));
    await screen.findByText('Reconciliation complete!');
    expect(screen.queryByLabelText(/Service Fees/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Please reload $53.00'));
    fireEvent.click(screen.getByLabelText(/^ASG/));
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));

    await vi.waitFor(() =>
      expect(addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 53 }),
        expect.any(String),
      ),
    );
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
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
    const reconcileTransactions = mockReconcile();
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
    const reconcileTransactions = mockReconcile();
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
    const reconcileTransactions = mockReconcile();
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      budgetAllocations: FUNDED_ASG,
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

    fireEvent.click(screen.getByLabelText(/^Please reload/));
    fireEvent.click(screen.getByLabelText(/^ASG/));
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
    const reconcileTransactions = mockReconcile();
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

  // The app records a download once it finishes, not when it starts.
  const waitForDownloadsToFinish = () =>
    vi.waitFor(() => {
      expect(screen.queryByText('Generating…')).not.toBeInTheDocument();
      expect(screen.queryByText('Bundling…')).not.toBeInTheDocument();
    });

  const renderAfterReconciling = async () => {
    const onClose = vi.fn();
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
      <MockLedgerProvider
        value={{
          activeOrganization: org,
          reconcileTransactions: mockReconcile(),
          updateReconciliationRound: mockUpdateRound(),
        }}
      >
        <ReconciliationModal isOpen onClose={onClose} />
      </MockLedgerProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');
    return { onClose };
  };

  test('"Done" asks before closing if the form has not been downloaded', async () => {
    const { onClose } = await renderAfterReconciling();

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByText(/haven't downloaded the reconciliation form/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Keep working' }));
    expect(screen.queryByText(/haven't downloaded/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Done'));
    fireEvent.click(screen.getByRole('button', { name: 'Close anyway' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('pressing Escape after reconciling asks before closing too', async () => {
    const { onClose } = await renderAfterReconciling();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByText(/haven't downloaded the reconciliation form/),
    ).toBeInTheDocument();
  });

  test('asks about the receipts ZIP too until it has been downloaded', async () => {
    const { onClose } = await renderAfterReconciling();

    fireEvent.click(screen.getByLabelText('Do not reload at this time'));
    fireEvent.click(screen.getByText('⬇ Reconciliation Form (PDF)'));
    await vi.waitFor(() => expect(mockDownloadPdf).toHaveBeenCalled());
    await waitForDownloadsToFinish();
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByText(/haven't downloaded the receipts ZIP yet/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Keep working' }));
    fireEvent.click(screen.getByRole('button', { name: /Receipts ZIP/ }));
    await vi.waitFor(() => expect(mockDownloadZip).toHaveBeenCalled());
    await waitForDownloadsToFinish();
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalled();
  });

  test('"Done" closes straight away once the form and receipts ZIP have been downloaded', async () => {
    const { onClose } = await renderAfterReconciling();

    fireEvent.click(screen.getByLabelText('Do not reload at this time'));
    fireEvent.click(screen.getByText('⬇ Reconciliation Form (PDF)'));
    fireEvent.click(screen.getByRole('button', { name: /Receipts ZIP/ }));
    await vi.waitFor(() => expect(mockDownloadPdf).toHaveBeenCalled());
    await vi.waitFor(() => expect(mockDownloadZip).toHaveBeenCalled());
    await waitForDownloadsToFinish();
    fireEvent.click(screen.getByText('Done'));

    expect(onClose).toHaveBeenCalled();
  });

  test('no reload choice is made by default, and the form waits for one', async () => {
    const reconcileTransactions = mockReconcile();
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

    expect(screen.getByLabelText(/^Please reload/)).not.toBeChecked();
    expect(screen.getByLabelText('Do not reload at this time')).not.toBeChecked();
    expect(screen.getByText('⬇ Reconciliation Form (PDF)')).toBeDisabled();
  });

  test('requesting a reload creates a Pending Journal on the Debit Card line for the full amount', async () => {
    const reconcileTransactions = mockReconcile();
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    const generateTransactionId = vi.fn(() => 'reload-id');
    const org = buildMockOrganization({
      budgetAllocations: FUNDED_ASG,
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
    fireEvent.click(screen.getByLabelText('Please reload $50.00'));
    fireEvent.click(screen.getByLabelText(/^ASG/));
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));

    await vi.waitFor(() =>
      expect(addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50,
          direction: 'Inflow',
          type: 'Journal',
          budgetLine: 'Debit Card',
        }),
        'reload-id',
      ),
    );
    expect(await screen.findByText(/Reload requested/)).toBeInTheDocument();
    // Locked in once requested, so the form can't disagree with the request.
    expect(screen.getByLabelText('Do not reload at this time')).toBeDisabled();
  });

  test('shows an error message when the reload request fails', async () => {
    const reconcileTransactions = mockReconcile();
    const addTransaction = vi.fn().mockRejectedValue(new Error('Reload rejected'));
    const org = buildMockOrganization({
      budgetAllocations: FUNDED_ASG,
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
    fireEvent.click(screen.getByLabelText(/^Please reload/));
    fireEvent.click(screen.getByLabelText(/^ASG/));
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));

    expect(await screen.findByText('Reload rejected')).toBeInTheDocument();
  });

  test('reload journals do not show up in the unreconciled transactions list', () => {
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          type: 'Journal',
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

  test('choosing not to reload generates the form marked "do not reload"', async () => {
    const reconcileTransactions = mockReconcile();
    const org = buildMockOrganization({
      name: 'Ballroom Latin and Swing Team',
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
    fireEvent.click(screen.getByLabelText('Do not reload at this time'));
    fireEvent.click(screen.getByText('⬇ Reconciliation Form (PDF)'));

    await vi.waitFor(() => expect(mockGeneratePdf).toHaveBeenCalled());
    const [formData, reloadChoice] = mockGeneratePdf.mock.calls[0];
    expect(formData).toEqual(
      expect.objectContaining({
        orgName: 'Ballroom Latin and Swing Team',
        authorizedCharges: 50,
      }),
    );
    expect(reloadChoice).toBe('do-not-reload');
    expect(mockDownloadPdf).toHaveBeenCalled();
  });

  test('downloading the reconciliation form after requesting a reload marks it "please reload"', async () => {
    const reconcileTransactions = mockReconcile();
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      budgetAllocations: FUNDED_ASG,
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
    fireEvent.click(screen.getByLabelText(/^Please reload/));
    expect(screen.getByText('⬇ Reconciliation Form (PDF)')).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/^ASG/));
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));
    await screen.findByText(/Reload requested/);

    fireEvent.click(screen.getByText('⬇ Reconciliation Form (PDF)'));

    await vi.waitFor(() => expect(mockGeneratePdf).toHaveBeenCalled());
    const [, reloadChoice] = mockGeneratePdf.mock.calls[0];
    expect(reloadChoice).toBe('please-reload');
  });

  test("warns when the org's debit card Load Balance is not set", async () => {
    const reconcileTransactions = mockReconcile();
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
        }),
      ],
      debitCardSettings: {},
    });
    renderModal({ activeOrganization: org, reconcileTransactions });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');

    expect(screen.getByText(/Load Balance wasn't set/)).toBeInTheDocument();
  });

  test("does not warn when the org's debit card Load Balance is set", async () => {
    const reconcileTransactions = mockReconcile();
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
        }),
      ],
      debitCardSettings: { loadBalance: 1000 },
    });
    renderModal({ activeOrganization: org, reconcileTransactions });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');

    expect(screen.queryByText(/Load Balance wasn't set/)).not.toBeInTheDocument();
  });

  test('explains when the reload amount includes an earlier round not yet reloaded', async () => {
    const reconcileTransactions = mockReconcile();
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 'prior',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r0',
          amount: 40,
          reconciledAt: 1000,
        }),
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

    expect(screen.getByLabelText('Please reload $90.00')).toBeInTheDocument();
    expect(
      screen.getByText(/plus \$40\.00 from an earlier reconciliation/),
    ).toBeInTheDocument();
  });

  test('unticking a purchase also unticks every newer one, and only the rest are reconciled', async () => {
    const reconcileTransactions = mockReconcile();
    const purchase = (id: string, date: string) =>
      buildMockTransaction({ id, date, budgetLine: 'Debit Card', receiptFileUrl: id });
    const org = buildMockOrganization({
      transactions: [
        purchase('sep26', '2026-09-26'),
        purchase('sep27', '2026-09-27'),
        purchase('sep28', '2026-09-28'),
      ],
    });
    renderModal({ activeOrganization: org, reconcileTransactions });

    const [sep28, sep27, sep26] = screen.getAllByRole('checkbox');
    fireEvent.click(sep27);
    expect(sep28).not.toBeChecked();
    expect(sep27).not.toBeChecked();
    expect(sep26).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await vi.waitFor(() =>
      expect(reconcileTransactions).toHaveBeenCalledWith(['sep26'], expect.anything()),
    );
  });

  test('ticking a purchase back in also ticks every older one', () => {
    const purchase = (id: string, date: string) =>
      buildMockTransaction({ id, date, budgetLine: 'Debit Card', receiptFileUrl: id });
    const org = buildMockOrganization({
      transactions: [
        purchase('sep26', '2026-09-26'),
        purchase('sep27', '2026-09-27'),
        purchase('sep28', '2026-09-28'),
      ],
    });
    renderModal({ activeOrganization: org });

    const [sep28, sep27, sep26] = screen.getAllByRole('checkbox');
    fireEvent.click(sep26);
    fireEvent.click(sep27);
    expect(sep28).not.toBeChecked();
    expect(sep27).toBeChecked();
    expect(sep26).toBeChecked();
  });

  test('asks for the date of the last reconciliation when the app has none on record, and puts it on the form', async () => {
    const reconcileTransactions = mockReconcile();
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
    await screen.findByText('Reconciliation complete!');
    fireEvent.change(screen.getByLabelText('Date of Last Reconciliation'), {
      target: { value: '2026-05-15' },
    });
    fireEvent.click(screen.getByLabelText('Do not reload at this time'));
    fireEvent.click(screen.getByText('⬇ Reconciliation Form (PDF)'));

    await vi.waitFor(() => expect(mockGeneratePdf).toHaveBeenCalled());
    expect(mockGeneratePdf.mock.calls[0][0].lastReconciliationDate).toBe('2026-05-15');
  });

  test('does not ask for the date of the last reconciliation when one is on record', async () => {
    const reconcileTransactions = mockReconcile();
    const org = buildMockOrganization({
      transactions: [
        buildMockTransaction({
          id: 'prior',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r0',
          reconciledAt: Date.parse('2026-09-01T12:00:00'),
        }),
        buildMockTransaction({
          id: 't1',
          budgetLine: 'Debit Card',
          receiptFileUrl: 'r1',
        }),
      ],
    });
    renderModal({ activeOrganization: org, reconcileTransactions });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');

    expect(
      screen.queryByLabelText('Date of Last Reconciliation'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Do not reload at this time'));
    fireEvent.click(screen.getByText('⬇ Reconciliation Form (PDF)'));
    await vi.waitFor(() => expect(mockGeneratePdf).toHaveBeenCalled());
    expect(mockGeneratePdf.mock.calls[0][0].lastReconciliationDate).toBe('2026-09-01');
  });

  test('a reload records the budget line that pays for it', async () => {
    const reconcileTransactions = mockReconcile();
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    const org = buildMockOrganization({
      budgetAllocations: { ASG: 10, Operating: 500, Gifts: 0, 'Debit Card': 0 },
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
    fireEvent.click(screen.getByLabelText(/^Please reload/));

    // ASG only has $10, so it can't pay for a $50 reload.
    expect(screen.getByLabelText(/^ASG/)).toBeDisabled();
    expect(screen.getByText(/\$10\.00 available, not enough/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request Reload' })).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/^Operating/));
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));

    await vi.waitFor(() =>
      expect(addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50, funding: 'Operating' }),
        expect.any(String),
      ),
    );
  });

  test('offers no reload when no budget line can pay for it', async () => {
    const reconcileTransactions = mockReconcile();
    const org = buildMockOrganization({
      budgetAllocations: { ASG: 10, Operating: 20, Gifts: 0, 'Debit Card': 0 },
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

    expect(screen.getByLabelText(/^Please reload/)).toBeDisabled();
    expect(
      screen.getByText(/None of ASG, Operating, or Gifts has \$50\.00/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Do not reload at this time')).toBeEnabled();
  });

  describe('saved rounds', () => {
    const purchase = buildMockTransaction({
      id: 'p1',
      date: '2026-09-20',
      title: 'Jewel-Osco',
      budgetLine: 'Debit Card',
      receiptFileUrl: 'r1',
      amount: 40,
      direction: 'Outflow',
    });
    const frozenFormData = {
      orgName: 'Test Org',
      balanceAsOfDate: '2026-09-30',
      lastReconciliationDate: '2026-09-01',
      reimbursements: [],
      totalReimbursed: 0,
      loadBalance: 1000,
      balanceAsOf: 960,
      completedReconciliationsPendingReload: 0,
      pendingTransactions: 0,
      totalExpenditures: 40,
      authorizedCharges: 40,
      serviceFees: 0,
      reconciliationSubtotal: 40,
      reloadAmount: 40,
    };
    const lastRound: ReconciliationRound = {
      id: 'round-9',
      reconciledAt: Date.parse('2026-09-30T15:00:00'),
      transactionIds: ['p1'],
      formData: frozenFormData,
    };
    const reconciledPurchase = { ...purchase, reconciledAt: lastRound.reconciledAt };

    test('confirming saves the round with the form numbers as of reconciling', async () => {
      const reconcileTransactions = mockReconcile();
      const org = buildMockOrganization({
        transactions: [purchase],
        debitCardSettings: { loadBalance: 1000 },
        budgetAllocations: { ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 960 },
      });
      renderModal({ activeOrganization: org, reconcileTransactions });

      fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));

      await vi.waitFor(() => expect(reconcileTransactions).toHaveBeenCalled());
      const [ids, formData] = reconcileTransactions.mock.calls[0];
      expect(ids).toEqual(['p1']);
      expect(formData).toMatchObject({ authorizedCharges: 40, balanceAsOf: 960 });
    });

    test('offers to reopen the last reconciliation, showing its transactions', async () => {
      const org = buildMockOrganization({ transactions: [reconciledPurchase] });
      renderModal({
        activeOrganization: org,
        fetchLastReconciliation: vi.fn().mockResolvedValue(lastRound),
      });

      fireEvent.click(
        await screen.findByRole('button', { name: /View last reconciliation/ }),
      );

      expect(screen.getByText(/^Reconciled /)).toBeInTheDocument();
      expect(
        screen.getByRole('list', { name: 'Reconciled transactions' }),
      ).toHaveTextContent('Jewel-Osco');
    });

    test('re-downloads the form from the numbers frozen when it was reconciled', async () => {
      // The card balance has moved on since; the form must not.
      const org = buildMockOrganization({
        transactions: [reconciledPurchase],
        budgetAllocations: { ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 5 },
      });
      renderModal({
        activeOrganization: org,
        fetchLastReconciliation: vi.fn().mockResolvedValue({
          ...lastRound,
          reloadChoice: 'do-not-reload',
        }),
      });

      fireEvent.click(
        await screen.findByRole('button', { name: /View last reconciliation/ }),
      );
      fireEvent.click(screen.getByText('⬇ Reconciliation Form (PDF)'));

      await vi.waitFor(() => expect(mockGeneratePdf).toHaveBeenCalled());
      const [formData, reloadChoice] = mockGeneratePdf.mock.calls[0];
      expect(formData.balanceAsOf).toBe(960);
      expect(reloadChoice).toBe('do-not-reload');
    });

    test('shows the status of a reload the round already requested', async () => {
      const reload = buildMockTransaction({
        id: 'reload-1',
        type: 'Journal',
        direction: 'Inflow',
        budgetLine: 'Debit Card',
        funding: 'ASG',
        paymentStatus: 'Paid',
        amount: 40,
      });
      const org = buildMockOrganization({ transactions: [reconciledPurchase, reload] });
      renderModal({
        activeOrganization: org,
        fetchLastReconciliation: vi.fn().mockResolvedValue({
          ...lastRound,
          reloadChoice: 'please-reload',
          reloadTransactionId: 'reload-1',
        }),
      });

      fireEvent.click(
        await screen.findByRole('button', { name: /View last reconciliation/ }),
      );

      expect(screen.getByText(/Reload requested: Reloaded/)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Request Reload' }),
      ).not.toBeInTheDocument();
    });

    test('closing a reopened round does not ask first', async () => {
      const onClose = vi.fn();
      const org = buildMockOrganization({ transactions: [reconciledPurchase] });
      render(
        <MockLedgerProvider
          value={{
            activeOrganization: org,
            fetchLastReconciliation: vi.fn().mockResolvedValue(lastRound),
          }}
        >
          <ReconciliationModal isOpen onClose={onClose} />
        </MockLedgerProvider>,
      );

      fireEvent.click(
        await screen.findByRole('button', { name: /View last reconciliation/ }),
      );
      fireEvent.click(screen.getByText('Done'));

      expect(onClose).toHaveBeenCalled();
    });

    test('downloading the form saves the reload choice and entered date to the round', async () => {
      const updateReconciliationRound = mockUpdateRound();
      const org = buildMockOrganization({ transactions: [purchase] });
      renderModal({ activeOrganization: org, updateReconciliationRound });

      fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
      await screen.findByText('Reconciliation complete!');
      fireEvent.change(screen.getByLabelText('Date of Last Reconciliation'), {
        target: { value: '2026-05-15' },
      });
      fireEvent.click(screen.getByLabelText('Do not reload at this time'));
      fireEvent.click(screen.getByText('⬇ Reconciliation Form (PDF)'));

      await vi.waitFor(() =>
        expect(updateReconciliationRound).toHaveBeenCalledWith('round-1', {
          reloadChoice: 'do-not-reload',
          lastReconciliationDate: '2026-05-15',
        }),
      );
    });
  });

  test('a reload that was created but not saved to the round is not offered again', async () => {
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    const updateReconciliationRound = vi
      .fn()
      .mockRejectedValue(new Error('permission denied'));
    const org = buildMockOrganization({
      budgetAllocations: FUNDED_ASG,
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
      reconcileTransactions: mockReconcile(),
      addTransaction,
      updateReconciliationRound,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Reconcile (1)' }));
    await screen.findByText('Reconciliation complete!');
    fireEvent.click(screen.getByLabelText(/^Please reload/));
    fireEvent.click(screen.getByLabelText(/^ASG/));
    fireEvent.click(screen.getByRole('button', { name: 'Request Reload' }));

    expect(
      await screen.findByText(
        /was requested, but it couldn't be saved.*Don't request it again/,
      ),
    ).toBeInTheDocument();
    expect(addTransaction).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: 'Request Reload' }),
    ).not.toBeInTheDocument();
  });
});
