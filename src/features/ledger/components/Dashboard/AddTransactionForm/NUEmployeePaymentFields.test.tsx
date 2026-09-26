import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { NUEmployeePaymentFields } from './NUEmployeePaymentFields';
import { initialForm } from './types';

const renderFields = (
  overrides: Partial<ComponentProps<typeof NUEmployeePaymentFields>> = {},
) =>
  render(
    <NUEmployeePaymentFields
      form={initialForm}
      isEditing={false}
      onChange={vi.fn()}
      onW9CheckBlockingChange={vi.fn()}
      onRsoCheckBlockingChange={vi.fn()}
      onContractedServicesCheckBlockingChange={vi.fn()}
      onConflictOfInterestCheckBlockingChange={vi.fn()}
      onSpecialPayFormCheckBlockingChange={vi.fn()}
      onNotStoredChange={vi.fn()}
      {...overrides}
    />,
  );

describe('NUEmployeePaymentFields', () => {
  test('shows contract, W-9, and Special Pay Form fields, each of which can skip storing a copy', () => {
    renderFields();
    expect(screen.getByLabelText('RSO Agreement')).toBeInTheDocument();
    expect(screen.getByLabelText('W-9')).toBeInTheDocument();
    expect(screen.getByLabelText('Special Pay Form')).toBeInTheDocument();
    expect(
      screen.getAllByRole('checkbox', {
        name: "Don't store this document in WildcatLedger",
      }),
    ).toHaveLength(3);
  });

  test('shows existing file links when editing with existing documents', () => {
    renderFields({
      isEditing: true,
      existingTransaction: buildMockTransaction({
        contractFileUrl: 'orgs/1/contract.pdf',
        w9FileUrl: 'orgs/1/w9.pdf',
        specialPayFormUrl: 'orgs/1/special-pay.pdf',
      }),
    });
    expect(screen.getAllByText('View file')).toHaveLength(3);
  });

  test('ticking the Special Pay Form not-stored checkbox reports which document', () => {
    const onNotStoredChange = vi.fn();
    renderFields({ onNotStoredChange });
    fireEvent.click(
      screen.getAllByRole('checkbox', {
        name: "Don't store this document in WildcatLedger",
      })[2],
    );
    expect(onNotStoredChange).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'specialPayForm' }),
      true,
    );
  });
});
