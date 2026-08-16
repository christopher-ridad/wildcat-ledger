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
      {...overrides}
    />,
  );

describe('NUEmployeePaymentFields', () => {
  test('requires contract, W-9, and Special Pay Form, each with an "I don\'t have this yet" checkbox, when creating', () => {
    renderFields();
    expect(screen.getAllByText("I don't have this yet")).toHaveLength(3);
  });

  test('hides the "I don\'t have this yet" checkbox once a file is attached', () => {
    const file = new File(['x'], 'contract.pdf', { type: 'application/pdf' });
    renderFields({ form: { ...initialForm, contractFile: file } });
    // Only W-9 and Special Pay Form checkboxes remain.
    expect(screen.getAllByText("I don't have this yet")).toHaveLength(2);
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
    expect(screen.queryByText("I don't have this yet")).not.toBeInTheDocument();
  });

  test('checking "Special Pay Form missing" shows a warning notice and calls onChange', () => {
    const onChange = vi.fn();
    renderFields({ onChange });
    const checkboxes = screen.getAllByRole('checkbox', { name: "I don't have this yet" });
    fireEvent.click(checkboxes[2]);
    expect(onChange).toHaveBeenCalled();
  });

  test('shows a warning notice once the Special Pay Form is acknowledged missing', () => {
    renderFields({ form: { ...initialForm, specialPayFormAcknowledgedMissing: true } });
    expect(
      screen.getByText(/flagged as missing the Special Pay Form/),
    ).toBeInTheDocument();
  });
});
