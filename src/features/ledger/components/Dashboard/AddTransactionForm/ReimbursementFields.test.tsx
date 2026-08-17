import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { ReimbursementFields } from './ReimbursementFields';
import { initialForm } from './types';

const renderFields = (
  overrides: Partial<ComponentProps<typeof ReimbursementFields>> = {},
) =>
  render(
    <ReimbursementFields
      form={initialForm}
      isEditing={false}
      scanning={false}
      ocrError={null}
      onReceiptChange={vi.fn()}
      onChange={vi.fn()}
      {...overrides}
    />,
  );

describe('ReimbursementFields', () => {
  test('shows the required asterisk and "no receipt" checkbox when creating', () => {
    renderFields();
    // Member name, receipt, and Zelle info are all required when creating.
    expect(screen.getAllByText('*')).toHaveLength(3);
    expect(
      screen.getByRole('checkbox', { name: "I don't have a receipt yet" }),
    ).toBeInTheDocument();
  });

  test('hides the "no receipt" checkbox and receipt asterisk while editing, and shows the existing file', () => {
    renderFields({
      isEditing: true,
      existingTransaction: buildMockTransaction({ receiptFileUrl: 'orgs/1/receipt.png' }),
    });
    // Member name and Zelle info are always required, but the receipt asterisk disappears.
    expect(screen.getAllByText('*')).toHaveLength(2);
    expect(
      screen.queryByRole('checkbox', { name: "I don't have a receipt yet" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('View file')).toBeInTheDocument();
  });

  test('checking "I don\'t have a receipt yet" shows a warning notice and calls onChange', () => {
    const onChange = vi.fn();
    renderFields({ onChange });
    fireEvent.click(screen.getByRole('checkbox', { name: "I don't have a receipt yet" }));
    expect(onChange).toHaveBeenCalled();
  });

  test('shows a warning notice once "no receipt" is acknowledged', () => {
    renderFields({ form: { ...initialForm, noReceiptAcknowledged: true } });
    expect(screen.getByText(/flagged as missing a receipt/)).toBeInTheDocument();
  });

  test('typing Zelle info calls onChange', () => {
    const onChange = vi.fn();
    renderFields({ onChange });
    fireEvent.change(screen.getByLabelText(/Zelle Email or Phone Number/), {
      target: { value: 'person@example.com' },
    });
    expect(onChange).toHaveBeenCalled();
  });

  test('shows a scanning indicator while scanning', () => {
    renderFields({ scanning: true });
    expect(screen.getByText('Scanning…')).toBeInTheDocument();
  });

  test('shows a non-blocking notice when OCR fails', () => {
    renderFields({ ocrError: 'Vision API request failed' });
    expect(screen.getByText(/Vision API request failed/)).toBeInTheDocument();
  });

  test('typing the reimbursed member name calls onChange', () => {
    const onChange = vi.fn();
    renderFields({ onChange });
    fireEvent.change(screen.getByLabelText(/Name of Member Being Reimbursed/), {
      target: { value: 'Jane Doe' },
    });
    expect(onChange).toHaveBeenCalled();
  });

  test('shows a note that tax cannot be reimbursed', () => {
    renderFields();
    expect(screen.getByText('Tax cannot be reimbursed.')).toBeInTheDocument();
  });
});
