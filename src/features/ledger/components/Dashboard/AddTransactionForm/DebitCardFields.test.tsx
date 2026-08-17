import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { DebitCardFields } from './DebitCardFields';
import { initialForm } from './types';

const renderFields = (overrides: Partial<ComponentProps<typeof DebitCardFields>> = {}) =>
  render(
    <DebitCardFields
      form={initialForm}
      isEditing={false}
      scanning={false}
      ocrError={null}
      onReceiptChange={vi.fn()}
      onChange={vi.fn()}
      {...overrides}
    />,
  );

describe('DebitCardFields', () => {
  test('shows the required asterisk when creating and no acknowledgment given', () => {
    renderFields();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  test('hides the asterisk while editing', () => {
    renderFields({
      isEditing: true,
      existingTransaction: buildMockTransaction({ receiptFileUrl: 'orgs/1/receipt.png' }),
    });
    expect(screen.queryByText('*')).not.toBeInTheDocument();
    expect(screen.getByText('View file')).toBeInTheDocument();
  });

  test('shows a scanning indicator when scanning', () => {
    renderFields({ scanning: true });
    expect(screen.getByText('Scanning…')).toBeInTheDocument();
  });

  test('shows a non-blocking notice when OCR fails', () => {
    renderFields({ ocrError: 'Vision API request failed' });
    expect(screen.getByText(/Vision API request failed/)).toBeInTheDocument();
    expect(screen.getByText(/enter the title\/amount manually/)).toBeInTheDocument();
  });

  test('shows no OCR error notice by default', () => {
    renderFields();
    expect(
      screen.queryByText(/enter the title\/amount manually/),
    ).not.toBeInTheDocument();
  });

  test('shows the "no receipt" checkbox and warning notice when checked', () => {
    const onChange = vi.fn();
    renderFields({
      form: { ...initialForm, noReceiptAcknowledged: true },
      onChange,
    });
    expect(
      screen.getByRole('checkbox', { name: "I don't have a receipt" }),
    ).toBeChecked();
    expect(screen.getByText(/flagged as missing a receipt/)).toBeInTheDocument();
  });

  test('hides the "no receipt" option once a receipt file is present', () => {
    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    renderFields({ form: { ...initialForm, receiptFile: file } });
    expect(screen.queryByText("I don't have a receipt")).not.toBeInTheDocument();
  });

  test('selecting a receipt file calls onReceiptChange', () => {
    const onReceiptChange = vi.fn();
    renderFields({ onReceiptChange });
    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    fireEvent.change(document.getElementById('receiptFile') as HTMLInputElement, {
      target: { files: [file] },
    });
    expect(onReceiptChange).toHaveBeenCalled();
  });

  test('shows a note that tax cannot be paid by the debit card', () => {
    renderFields();
    expect(screen.getByText('Tax cannot be paid by the debit card.')).toBeInTheDocument();
  });

  test('shows the tax amount field when no exemption form was submitted', () => {
    renderFields({ form: { ...initialForm, taxExemptFormSubmitted: false } });
    expect(screen.getByLabelText('Tax Charged on Receipt (if any)')).toBeInTheDocument();
  });

  test('hides the tax amount field once the exemption form checkbox is checked', () => {
    renderFields({ form: { ...initialForm, taxExemptFormSubmitted: true } });
    expect(
      screen.queryByLabelText('Tax Charged on Receipt (if any)'),
    ).not.toBeInTheDocument();
  });

  test('shows a warning once a tax amount is entered', () => {
    renderFields({
      form: { ...initialForm, taxExemptFormSubmitted: false, taxAmount: '2.50' },
    });
    expect(
      screen.getByText(/flagged as owing a tax reimbursement to SOFO/),
    ).toBeInTheDocument();
  });

  test('does not warn while the tax amount field is empty', () => {
    renderFields({
      form: { ...initialForm, taxExemptFormSubmitted: false, taxAmount: '' },
    });
    expect(
      screen.queryByText(/flagged as owing a tax reimbursement to SOFO/),
    ).not.toBeInTheDocument();
  });

  test('checking the exemption form checkbox calls onChange', () => {
    const onChange = vi.fn();
    renderFields({ onChange });
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'I submitted a tax exemption form to the vendor',
      }),
    );
    expect(onChange).toHaveBeenCalled();
  });
});
