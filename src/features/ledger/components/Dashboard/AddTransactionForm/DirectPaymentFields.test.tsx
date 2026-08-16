import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { DirectPaymentFields } from './DirectPaymentFields';
import { initialForm } from './types';

const renderFields = (
  overrides: Partial<ComponentProps<typeof DirectPaymentFields>> = {},
) =>
  render(
    <DirectPaymentFields
      form={initialForm}
      isEditing={false}
      onChange={vi.fn()}
      {...overrides}
    />,
  );

describe('DirectPaymentFields', () => {
  test('requires contract and W-9, each with an "I don\'t have this yet" checkbox, when creating', () => {
    renderFields();
    expect(screen.getAllByText("I don't have this yet")).toHaveLength(2);
  });

  test('hides the "I don\'t have this yet" checkbox once a file is attached', () => {
    const file = new File(['x'], 'contract.pdf', { type: 'application/pdf' });
    renderFields({ form: { ...initialForm, contractFile: file } });
    // Only the W-9 checkbox remains since a contract file is now attached.
    expect(screen.getAllByText("I don't have this yet")).toHaveLength(1);
  });

  test('shows existing file links when editing with existing documents', () => {
    renderFields({
      isEditing: true,
      existingTransaction: buildMockTransaction({
        contractFileUrl: 'orgs/1/contract.pdf',
        w9FileUrl: 'orgs/1/w9.pdf',
      }),
    });
    expect(screen.getAllByText('View file')).toHaveLength(2);
    expect(screen.queryByText("I don't have this yet")).not.toBeInTheDocument();
  });

  test('checking "contract missing" shows a warning notice and calls onChange', () => {
    const onChange = vi.fn();
    renderFields({ onChange });
    const [contractCheckbox] = screen.getAllByRole('checkbox', {
      name: "I don't have this yet",
    });
    fireEvent.click(contractCheckbox);
    expect(onChange).toHaveBeenCalled();
  });

  test('shows a warning notice once the contract is acknowledged missing', () => {
    renderFields({ form: { ...initialForm, contractAcknowledgedMissing: true } });
    expect(screen.getByText(/flagged as missing the RSO Agreement/)).toBeInTheDocument();
  });

  test('does not show individual-vendor fields by default', () => {
    renderFields();
    expect(screen.queryByText('Contracted Services Form')).not.toBeInTheDocument();
  });

  test('reveals contracted-services and conflict-of-interest fields for individual vendors', () => {
    renderFields({ form: { ...initialForm, isIndividualVendor: true } });
    expect(screen.getByLabelText(/Contracted Services Form/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Conflict of Interest Form/)).toBeInTheDocument();
    // Contract, W-9, CSF, and COI all get their own "missing" checkbox.
    expect(screen.getAllByText("I don't have this yet")).toHaveLength(4);
  });

  test('checking "conflict of interest missing" shows a warning notice', () => {
    renderFields({
      form: {
        ...initialForm,
        isIndividualVendor: true,
        conflictOfInterestAcknowledgedMissing: true,
      },
    });
    expect(
      screen.getByText(/flagged as missing the Conflict of Interest Form/),
    ).toBeInTheDocument();
  });

  test('toggling the individual-vendor checkbox calls onChange', () => {
    const onChange = vi.fn();
    renderFields({ onChange });
    fireEvent.click(screen.getByText('Is this an individual vendor?'));
    expect(onChange).toHaveBeenCalled();
  });
});
