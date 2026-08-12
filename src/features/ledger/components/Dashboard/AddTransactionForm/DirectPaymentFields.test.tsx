import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { DirectPaymentFields } from './DirectPaymentFields';
import { initialForm } from './types';

describe('DirectPaymentFields', () => {
  test('requires contract and W-9, each with an "I don\'t have this yet" checkbox, when creating', () => {
    render(
      <DirectPaymentFields form={initialForm} isEditing={false} onChange={vi.fn()} />,
    );
    expect(screen.getAllByText("I don't have this yet")).toHaveLength(2);
  });

  test('hides the "I don\'t have this yet" checkbox once a file is attached', () => {
    const file = new File(['x'], 'contract.pdf', { type: 'application/pdf' });
    render(
      <DirectPaymentFields
        form={{ ...initialForm, contractFile: file }}
        isEditing={false}
        onChange={vi.fn()}
      />,
    );
    // Only the W-9 checkbox remains since a contract file is now attached.
    expect(screen.getAllByText("I don't have this yet")).toHaveLength(1);
  });

  test('shows existing file links when editing with existing documents', () => {
    render(
      <DirectPaymentFields
        form={initialForm}
        isEditing
        existingTransaction={buildMockTransaction({
          contractFileUrl: 'orgs/1/contract.pdf',
          w9FileUrl: 'orgs/1/w9.pdf',
        })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText('View file')).toHaveLength(2);
    expect(screen.queryByText("I don't have this yet")).not.toBeInTheDocument();
  });

  test('checking "contract missing" shows a warning notice and calls onChange', () => {
    const onChange = vi.fn();
    render(
      <DirectPaymentFields form={initialForm} isEditing={false} onChange={onChange} />,
    );
    const [contractCheckbox] = screen.getAllByRole('checkbox', {
      name: "I don't have this yet",
    });
    fireEvent.click(contractCheckbox);
    expect(onChange).toHaveBeenCalled();
  });

  test('shows a warning notice once the contract is acknowledged missing', () => {
    render(
      <DirectPaymentFields
        form={{ ...initialForm, contractAcknowledgedMissing: true }}
        isEditing={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/flagged as missing the RSO Agreement/)).toBeInTheDocument();
  });

  test('does not show individual-vendor fields by default', () => {
    render(
      <DirectPaymentFields form={initialForm} isEditing={false} onChange={vi.fn()} />,
    );
    expect(screen.queryByText('Contracted Services Form')).not.toBeInTheDocument();
  });

  test('reveals contracted-services and conflict-of-interest fields for individual vendors', () => {
    render(
      <DirectPaymentFields
        form={{ ...initialForm, isIndividualVendor: true }}
        isEditing={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Contracted Services Form/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Conflict of Interest Form/)).toBeInTheDocument();
    // Contract, W-9, CSF, and COI all get their own "missing" checkbox.
    expect(screen.getAllByText("I don't have this yet")).toHaveLength(4);
  });

  test('checking "conflict of interest missing" shows a warning notice', () => {
    render(
      <DirectPaymentFields
        form={{
          ...initialForm,
          isIndividualVendor: true,
          conflictOfInterestAcknowledgedMissing: true,
        }}
        isEditing={false}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/flagged as missing the Conflict of Interest Form/),
    ).toBeInTheDocument();
  });

  test('toggling the individual-vendor checkbox calls onChange', () => {
    const onChange = vi.fn();
    render(
      <DirectPaymentFields form={initialForm} isEditing={false} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText('Is this an individual vendor?'));
    expect(onChange).toHaveBeenCalled();
  });
});
