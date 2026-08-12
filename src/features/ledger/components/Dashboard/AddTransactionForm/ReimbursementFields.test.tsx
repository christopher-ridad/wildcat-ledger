import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { ReimbursementFields } from './ReimbursementFields';
import { initialForm } from './types';

describe('ReimbursementFields', () => {
  test('shows the required asterisk and "no receipt" checkbox when creating', () => {
    render(
      <ReimbursementFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    // Member name, receipt, and Zelle info are all required when creating.
    expect(screen.getAllByText('*')).toHaveLength(3);
    expect(
      screen.getByRole('checkbox', { name: "I don't have a receipt yet" }),
    ).toBeInTheDocument();
  });

  test('hides the "no receipt" checkbox and receipt asterisk while editing, and shows the existing file', () => {
    render(
      <ReimbursementFields
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
    // Member name and Zelle info are always required, but the receipt asterisk disappears.
    expect(screen.getAllByText('*')).toHaveLength(2);
    expect(
      screen.queryByRole('checkbox', { name: "I don't have a receipt yet" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('View file')).toBeInTheDocument();
  });

  test('checking "I don\'t have a receipt yet" shows a warning notice and calls onChange', () => {
    const onChange = vi.fn();
    render(
      <ReimbursementFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: "I don't have a receipt yet" }));
    expect(onChange).toHaveBeenCalled();
  });

  test('shows a warning notice once "no receipt" is acknowledged', () => {
    render(
      <ReimbursementFields
        form={{ ...initialForm, noReceiptAcknowledged: true }}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/flagged as missing a receipt/)).toBeInTheDocument();
  });

  test('typing Zelle info calls onChange', () => {
    const onChange = vi.fn();
    render(
      <ReimbursementFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Zelle Email or Phone Number/), {
      target: { value: 'person@example.com' },
    });
    expect(onChange).toHaveBeenCalled();
  });

  test('shows a scanning indicator while scanning', () => {
    render(
      <ReimbursementFields
        form={initialForm}
        isEditing={false}
        scanning
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Scanning…')).toBeInTheDocument();
  });

  test('typing the reimbursed member name calls onChange', () => {
    const onChange = vi.fn();
    render(
      <ReimbursementFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Name of Member Being Reimbursed/), {
      target: { value: 'Jane Doe' },
    });
    expect(onChange).toHaveBeenCalled();
  });

  test('shows a note that tax cannot be reimbursed', () => {
    render(
      <ReimbursementFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Tax cannot be reimbursed.')).toBeInTheDocument();
  });
});
