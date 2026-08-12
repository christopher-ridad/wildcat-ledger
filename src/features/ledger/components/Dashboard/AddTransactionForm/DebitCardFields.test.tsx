import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { DebitCardFields } from './DebitCardFields';
import { initialForm } from './types';

describe('DebitCardFields', () => {
  test('shows the required asterisk when creating and no acknowledgment given', () => {
    render(
      <DebitCardFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  test('hides the asterisk while editing', () => {
    render(
      <DebitCardFields
        form={initialForm}
        isEditing
        existingTransaction={buildMockTransaction({
          receiptFileUrl: 'orgs/1/receipt.png',
        })}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('*')).not.toBeInTheDocument();
    expect(screen.getByText('View file')).toBeInTheDocument();
  });

  test('shows a scanning indicator when scanning', () => {
    render(
      <DebitCardFields
        form={initialForm}
        isEditing={false}
        scanning
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Scanning…')).toBeInTheDocument();
  });

  test('shows the "no receipt" checkbox and warning notice when checked', () => {
    const onChange = vi.fn();
    render(
      <DebitCardFields
        form={{ ...initialForm, noReceiptAcknowledged: true }}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole('checkbox', { name: "I don't have a receipt" }),
    ).toBeChecked();
    expect(screen.getByText(/flagged as missing a receipt/)).toBeInTheDocument();
  });

  test('hides the "no receipt" option once a receipt file is present', () => {
    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    render(
      <DebitCardFields
        form={{ ...initialForm, receiptFile: file }}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("I don't have a receipt")).not.toBeInTheDocument();
  });

  test('selecting a receipt file calls onReceiptChange', () => {
    const onReceiptChange = vi.fn();
    render(
      <DebitCardFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        onReceiptChange={onReceiptChange}
        onChange={vi.fn()}
      />,
    );
    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    fireEvent.change(document.getElementById('receiptFile') as HTMLInputElement, {
      target: { files: [file] },
    });
    expect(onReceiptChange).toHaveBeenCalled();
  });

  test('shows a note that tax cannot be paid by the debit card', () => {
    render(
      <DebitCardFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Tax cannot be paid by the debit card.')).toBeInTheDocument();
  });

  test('shows the tax amount field when no exemption form was submitted', () => {
    render(
      <DebitCardFields
        form={{ ...initialForm, taxExemptFormSubmitted: false }}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Tax Charged on Receipt (if any)')).toBeInTheDocument();
  });

  test('hides the tax amount field once the exemption form checkbox is checked', () => {
    render(
      <DebitCardFields
        form={{ ...initialForm, taxExemptFormSubmitted: true }}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByLabelText('Tax Charged on Receipt (if any)'),
    ).not.toBeInTheDocument();
  });

  test('shows a warning once a tax amount is entered', () => {
    render(
      <DebitCardFields
        form={{ ...initialForm, taxExemptFormSubmitted: false, taxAmount: '2.50' }}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/flagged as owing a tax reimbursement to SOFO/),
    ).toBeInTheDocument();
  });

  test('does not warn while the tax amount field is empty', () => {
    render(
      <DebitCardFields
        form={{ ...initialForm, taxExemptFormSubmitted: false, taxAmount: '' }}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(/flagged as owing a tax reimbursement to SOFO/),
    ).not.toBeInTheDocument();
  });

  test('checking the exemption form checkbox calls onChange', () => {
    const onChange = vi.fn();
    render(
      <DebitCardFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'I submitted a tax exemption form to the vendor',
      }),
    );
    expect(onChange).toHaveBeenCalled();
  });
});
