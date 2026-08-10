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
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  test('hides the asterisk and request/no-receipt options while editing', () => {
    render(
      <DebitCardFields
        form={initialForm}
        isEditing
        existingTransaction={buildMockTransaction({
          receiptFileUrl: 'orgs/1/receipt.png',
        })}
        scanning={false}
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(screen.queryByText('*')).not.toBeInTheDocument();
    expect(screen.queryByText('Request Receipt via Email')).not.toBeInTheDocument();
    expect(screen.getByText('View file')).toBeInTheDocument();
  });

  test('shows a scanning indicator when scanning', () => {
    render(
      <DebitCardFields
        form={initialForm}
        isEditing={false}
        scanning
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(screen.getByText('Scanning…')).toBeInTheDocument();
  });

  test('clicking "Request Receipt via Email" calls onRequestDocument', () => {
    const onRequestDocument = vi.fn();
    render(
      <DebitCardFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
        onRequestDocument={onRequestDocument}
      />,
    );
    fireEvent.click(screen.getByText('Request Receipt via Email'));
    expect(onRequestDocument).toHaveBeenCalledWith('receipt', 'Receipt');
  });

  test('shows a "requested" note once the receipt has been requested', () => {
    render(
      <DebitCardFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        requestedDocTypes={new Set(['receipt'])}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Receipt requested — waiting for member to upload'),
    ).toBeInTheDocument();
  });

  test('shows the "no receipt" checkbox and warning notice when checked', () => {
    const onChange = vi.fn();
    render(
      <DebitCardFields
        form={{ ...initialForm, noReceiptAcknowledged: true }}
        isEditing={false}
        scanning={false}
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={onChange}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText(/flagged as missing a receipt/)).toBeInTheDocument();
  });

  test('hides the "no receipt" option once a receipt file is present', () => {
    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    render(
      <DebitCardFields
        form={{ ...initialForm, receiptFile: file }}
        isEditing={false}
        scanning={false}
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
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
        requestedDocTypes={new Set()}
        onReceiptChange={onReceiptChange}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    fireEvent.change(document.getElementById('receiptFile') as HTMLInputElement, {
      target: { files: [file] },
    });
    expect(onReceiptChange).toHaveBeenCalled();
  });

  test('opens the camera directly on mobile instead of a generic file picker', () => {
    render(
      <DebitCardFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(document.getElementById('receiptFile')).toHaveAttribute(
      'capture',
      'environment',
    );
  });
});
