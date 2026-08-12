import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { buildMockTransaction, MockLedgerProvider } from '../../../../../test/mocks';
import { LedgerContextValue } from '../../../types';
import { AddTransactionForm } from './AddTransactionForm';

vi.mock('../../../services/parseReceipt', () => ({
  parseReceipt: vi.fn().mockRejectedValue(new Error('OCR not available in tests')),
}));

vi.mock('../../../services/storage', () => ({
  documentPath: vi.fn(
    (orgId: string, txnId: string, file: File, prefix: string) =>
      `clubs/${orgId}/transactions/${txnId}/${prefix}_${file.name}`,
  ),
  uploadDocument: vi.fn().mockResolvedValue(undefined),
  getSignedFileUrl: vi.fn().mockResolvedValue('https://signed.example/file'),
}));

const renderForm = (
  ledgerOverrides: Partial<LedgerContextValue> = {},
  props: Partial<Parameters<typeof AddTransactionForm>[0]> = {},
) =>
  render(
    <MockLedgerProvider
      value={{
        activeOrganizationId: 'org-1',
        generateTransactionId: vi.fn(() => 'txn-1'),
        ...ledgerOverrides,
      }}
    >
      <AddTransactionForm {...props} />
    </MockLedgerProvider>,
  );

const fillCommonFields = (title = 'Pizza', amount = '12.50') => {
  fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: title } });
  fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: amount } });
};

describe('AddTransactionForm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders the always-visible fields and defaults to Debit Card', () => {
    renderForm();
    expect(screen.getByLabelText(/^Title/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Date/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Amount/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Transaction Type/)).toHaveValue('Debit Card');
    expect(screen.getByRole('button', { name: 'Add Transaction' })).toBeInTheDocument();
  });

  test('sanitizes the amount input to strip non-numeric characters and cap two decimal digits', () => {
    renderForm();
    const amountInput = screen.getByLabelText(/^Amount/);
    fireEvent.change(amountInput, { target: { value: '12.999abc' } });
    expect(amountInput).toHaveValue('12.99');
  });

  test('collapses multiple decimal points into a single one', () => {
    renderForm();
    const amountInput = screen.getByLabelText(/^Amount/);
    fireEvent.change(amountInput, { target: { value: '1.2.3' } });
    expect(amountInput).toHaveValue('1.23');
  });

  test('switching transaction type clears type-specific fields', () => {
    renderForm();
    fireEvent.click(screen.getByText("I don't have a receipt"));
    expect(
      screen.getByRole('checkbox', { name: "I don't have a receipt" }),
    ).toBeChecked();

    fireEvent.change(screen.getByLabelText(/Transaction Type/), {
      target: { value: 'Deposit' },
    });
    fireEvent.change(screen.getByLabelText(/Transaction Type/), {
      target: { value: 'Debit Card' },
    });

    expect(
      screen.getByRole('checkbox', { name: "I don't have a receipt" }),
    ).not.toBeChecked();
  });

  test('shows a validation error and does not submit when the title is missing', () => {
    const addTransaction = vi.fn();
    renderForm({ addTransaction });
    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required.');
    expect(addTransaction).not.toHaveBeenCalled();
  });

  test('debit card purchases require a receipt or an acknowledgment', () => {
    const addTransaction = vi.fn();
    renderForm({ addTransaction });
    fillCommonFields();
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Upload a receipt/);
    expect(addTransaction).not.toHaveBeenCalled();
  });

  test('submits successfully when "I don\'t have a receipt" is acknowledged', async () => {
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    renderForm({ addTransaction }, { onSuccess });
    fillCommonFields('Pizza', '12.50');
    fireEvent.click(screen.getByText("I don't have a receipt"));
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    await vi.waitFor(() => expect(addTransaction).toHaveBeenCalled());
    const [transaction] = addTransaction.mock.calls[0];
    expect(transaction).toMatchObject({
      title: 'Pizza',
      amount: 12.5,
      direction: 'Outflow',
      budgetLine: 'Debit Card',
      noReceiptAcknowledged: true,
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  test('submits tax info when the exemption form was not submitted', async () => {
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    renderForm({ addTransaction });
    fillCommonFields('Pizza', '12.50');
    fireEvent.click(screen.getByText("I don't have a receipt"));
    fireEvent.change(screen.getByLabelText('Tax Charged on Receipt (if any)'), {
      target: { value: '1.25' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    await vi.waitFor(() => expect(addTransaction).toHaveBeenCalled());
    const [transaction] = addTransaction.mock.calls[0];
    expect(transaction).toMatchObject({
      taxExemptFormSubmitted: false,
      taxAmount: 1.25,
    });
  });

  test('omits tax amount once the exemption form checkbox is checked', async () => {
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    renderForm({ addTransaction });
    fillCommonFields('Pizza', '12.50');
    fireEvent.click(screen.getByText("I don't have a receipt"));
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'I submitted a tax exemption form to the vendor',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    await vi.waitFor(() => expect(addTransaction).toHaveBeenCalled());
    const [transaction] = addTransaction.mock.calls[0];
    expect(transaction.taxExemptFormSubmitted).toBe(true);
    expect(transaction.taxAmount).toBeUndefined();
  });

  test('submits a reimbursement with the member name and Zelle info included', async () => {
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    renderForm({ addTransaction });
    fireEvent.change(screen.getByLabelText(/Transaction Type/), {
      target: { value: 'Non-Officer Reimbursement' },
    });
    fillCommonFields('Team dinner', '25.00');
    fireEvent.change(screen.getByLabelText(/Name of Member Being Reimbursed/), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByLabelText(/Zelle Email or Phone Number/), {
      target: { value: 'jane@example.com' },
    });
    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    fireEvent.change(document.getElementById('receiptFile') as HTMLInputElement, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    await vi.waitFor(() => expect(addTransaction).toHaveBeenCalled());
    const [transaction] = addTransaction.mock.calls[0];
    expect(transaction).toMatchObject({
      title: 'Team dinner',
      amount: 25,
      reimbursedMemberName: 'Jane Doe',
      zelleInfo: 'jane@example.com',
    });
  });

  test('submits a reimbursement missing its receipt when acknowledged', async () => {
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    renderForm({ addTransaction });
    fireEvent.change(screen.getByLabelText(/Transaction Type/), {
      target: { value: 'Non-Officer Reimbursement' },
    });
    fillCommonFields('Team dinner', '25.00');
    fireEvent.change(screen.getByLabelText(/Name of Member Being Reimbursed/), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByLabelText(/Zelle Email or Phone Number/), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: "I don't have a receipt yet" }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    await vi.waitFor(() => expect(addTransaction).toHaveBeenCalled());
    const [transaction] = addTransaction.mock.calls[0];
    expect(transaction.noReceiptAcknowledged).toBe(true);
  });

  test('submits a payment to a Northwestern employee with contract, W-9, and Special Pay Form', async () => {
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    renderForm({ addTransaction });
    fireEvent.change(screen.getByLabelText(/Transaction Type/), {
      target: { value: 'Payment to NU Employee' },
    });
    fillCommonFields('Guest speaker honorarium', '200.00');

    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(document.getElementById('contractFile') as HTMLInputElement, {
      target: { files: [file] },
    });
    fireEvent.change(document.getElementById('w9File') as HTMLInputElement, {
      target: { files: [file] },
    });
    fireEvent.change(document.getElementById('specialPayFormFile') as HTMLInputElement, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    await vi.waitFor(() => expect(addTransaction).toHaveBeenCalled());
    const [transaction] = addTransaction.mock.calls[0];
    expect(transaction).toMatchObject({
      title: 'Guest speaker honorarium',
      amount: 200,
      type: 'Payment to NU Employee',
      specialPayFormUrl: 'clubs/org-1/transactions/txn-1/specialPayForm_doc.pdf',
    });
  });

  test('submits a payment to a Northwestern employee missing all its documents when acknowledged', async () => {
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    renderForm({ addTransaction });
    fireEvent.change(screen.getByLabelText(/Transaction Type/), {
      target: { value: 'Payment to NU Employee' },
    });
    fillCommonFields('Guest speaker honorarium', '200.00');

    for (const name of [
      'contractAcknowledgedMissing',
      'w9AcknowledgedMissing',
      'specialPayFormAcknowledgedMissing',
    ]) {
      fireEvent.click(
        document.querySelector(`input[name="${name}"]`) as HTMLInputElement,
      );
    }
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    await vi.waitFor(() => expect(addTransaction).toHaveBeenCalled());
    const [transaction] = addTransaction.mock.calls[0];
    expect(transaction).toMatchObject({
      contractAcknowledgedMissing: true,
      w9AcknowledgedMissing: true,
      specialPayFormAcknowledgedMissing: true,
    });
  });

  test('warns before an outflow that would overdraw the budget line, and lets the user cancel', () => {
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    renderForm({
      addTransaction,
      budgetLineSummaries: [
        { line: 'ASG', balance: 0, inflow: 0, outflow: 0 },
        { line: 'Operating', balance: 0, inflow: 0, outflow: 0 },
        { line: 'Gifts', balance: 0, inflow: 0, outflow: 0 },
        { line: 'Debit Card', balance: 5, inflow: 0, outflow: 0 },
      ],
    });
    fillCommonFields('Pizza', '12.50');
    fireEvent.click(screen.getByText("I don't have a receipt"));
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      /exceeds the current Debit Card balance/,
    );
    expect(addTransaction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Proceed anyway')).not.toBeInTheDocument();
  });

  test('"Proceed anyway" submits the overdrawing transaction', async () => {
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    renderForm({
      addTransaction,
      budgetLineSummaries: [
        { line: 'ASG', balance: 0, inflow: 0, outflow: 0 },
        { line: 'Operating', balance: 0, inflow: 0, outflow: 0 },
        { line: 'Gifts', balance: 0, inflow: 0, outflow: 0 },
        { line: 'Debit Card', balance: 5, inflow: 0, outflow: 0 },
      ],
    });
    fillCommonFields('Pizza', '12.50');
    fireEvent.click(screen.getByText("I don't have a receipt"));
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));
    fireEvent.click(screen.getByText('Proceed anyway'));

    await vi.waitFor(() => expect(addTransaction).toHaveBeenCalled());
  });

  test('pre-fills the form and shows "Save Changes" when editing an existing transaction', () => {
    const existingTransaction = buildMockTransaction({
      title: 'Existing Purchase',
      amount: 33.25,
      type: 'Debit Card',
      receiptFileUrl: 'orgs/1/receipt.png',
    });
    renderForm({}, { existingTransaction });

    expect(screen.getByLabelText(/^Title/)).toHaveValue('Existing Purchase');
    expect(screen.getByLabelText(/^Amount/)).toHaveValue('33.25');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  test('editing calls updateTransaction instead of addTransaction', async () => {
    const updateTransaction = vi.fn().mockResolvedValue(undefined);
    const addTransaction = vi.fn().mockResolvedValue(undefined);
    const existingTransaction = buildMockTransaction({
      id: 'txn-99',
      title: 'Existing Purchase',
      amount: 33.25,
      type: 'Debit Card',
      receiptFileUrl: 'orgs/1/receipt.png',
    });
    renderForm({ updateTransaction, addTransaction }, { existingTransaction });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await vi.waitFor(() => expect(updateTransaction).toHaveBeenCalled());
    expect(updateTransaction).toHaveBeenCalledWith('txn-99', expect.any(Object));
    expect(addTransaction).not.toHaveBeenCalled();
  });

  test('shows an error message when the submission fails', async () => {
    const addTransaction = vi.fn().mockRejectedValue(new Error('Network unavailable'));
    renderForm({ addTransaction });
    fillCommonFields('Pizza', '12.50');
    fireEvent.click(screen.getByText("I don't have a receipt"));
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

    expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
  });
});
