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
      onW9CheckBlockingChange={vi.fn()}
      onRsoCheckBlockingChange={vi.fn()}
      onNotStoredChange={vi.fn()}
      {...overrides}
    />,
  );

describe('DirectPaymentFields', () => {
  test('shows contract and W-9 fields, each of which can skip storing a copy', () => {
    renderFields();
    expect(screen.getByLabelText('RSO Agreement')).toBeInTheDocument();
    expect(screen.getByLabelText('W-9')).toBeInTheDocument();
    expect(
      screen.getAllByRole('checkbox', {
        name: "Don't store this document in WildcatLedger",
      }),
    ).toHaveLength(2);
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
  });

  test('does not show individual-vendor fields by default', () => {
    renderFields();
    expect(screen.queryByText('Contracted Services Form')).not.toBeInTheDocument();
  });

  test('reveals contracted-services and conflict-of-interest fields for individual vendors', () => {
    renderFields({ form: { ...initialForm, isIndividualVendor: true } });
    expect(screen.getByLabelText('Contracted Services Form')).toBeInTheDocument();
    expect(screen.getByLabelText('Conflict of Interest Form')).toBeInTheDocument();
  });

  test('a not-stored Conflict of Interest Form shows as not stored', () => {
    renderFields({
      form: {
        ...initialForm,
        isIndividualVendor: true,
        conflictOfInterestNotStored: true,
      },
    });
    expect(screen.getByLabelText('Conflict of Interest Form')).toBeInTheDocument();
    const notStoredBoxes = screen.getAllByRole('checkbox', {
      name: "Don't store this document in WildcatLedger",
    });
    // RSO Agreement, W-9, CSF, COI -- only the COI is ticked.
    expect(notStoredBoxes.map((box) => (box as HTMLInputElement).checked)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  test('toggling the individual-vendor checkbox calls onChange', () => {
    const onChange = vi.fn();
    renderFields({ onChange });
    fireEvent.click(screen.getByText('Is this an individual vendor?'));
    expect(onChange).toHaveBeenCalled();
  });
});
