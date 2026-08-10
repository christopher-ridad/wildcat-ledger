import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { ReimbursementFields } from './ReimbursementFields';
import { initialForm } from './types';

describe('ReimbursementFields', () => {
  test('shows the required asterisk and request option when creating', () => {
    render(
      <ReimbursementFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    // Member name, receipt, and Zelle info are all required when creating.
    expect(screen.getAllByText('*')).toHaveLength(3);
    expect(screen.getByText('Request Receipt via Email')).toBeInTheDocument();
  });

  test('hides the request option and receipt asterisk while editing, and shows the existing file', () => {
    render(
      <ReimbursementFields
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
    // Member name and Zelle info are always required, but the receipt asterisk disappears.
    expect(screen.getAllByText('*')).toHaveLength(2);
    expect(screen.queryByText('Request Receipt via Email')).not.toBeInTheDocument();
    expect(screen.getByText('View file')).toBeInTheDocument();
  });

  test('typing Zelle info calls onChange', () => {
    const onChange = vi.fn();
    render(
      <ReimbursementFields
        form={initialForm}
        isEditing={false}
        scanning={false}
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={onChange}
        onRequestDocument={vi.fn()}
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
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
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
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={onChange}
        onRequestDocument={vi.fn()}
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
        requestedDocTypes={new Set()}
        onReceiptChange={vi.fn()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(screen.getByText('Tax cannot be reimbursed.')).toBeInTheDocument();
  });
});
