import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { NUEmployeePaymentFields } from './NUEmployeePaymentFields';

describe('NUEmployeePaymentFields', () => {
  test('requires contract, W-9, and Special Pay Form with request-via-email options when creating', () => {
    render(
      <NUEmployeePaymentFields
        isEditing={false}
        requestedDocTypes={new Set()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Request RSO Agreement Signature via Email'),
    ).toBeInTheDocument();
    expect(screen.getByText('Request W-9 via Email')).toBeInTheDocument();
    expect(screen.getByText('Request Special Pay Form via Email')).toBeInTheDocument();
  });

  test('hides request-via-email options while editing', () => {
    render(
      <NUEmployeePaymentFields
        isEditing
        requestedDocTypes={new Set()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(
      screen.queryByText('Request RSO Agreement Signature via Email'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Request Special Pay Form via Email'),
    ).not.toBeInTheDocument();
  });

  test('shows existing file links when editing with existing documents', () => {
    render(
      <NUEmployeePaymentFields
        isEditing
        existingTransaction={buildMockTransaction({
          contractFileUrl: 'orgs/1/contract.pdf',
          w9FileUrl: 'orgs/1/w9.pdf',
          specialPayFormUrl: 'orgs/1/special-pay.pdf',
        })}
        requestedDocTypes={new Set()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(screen.getAllByText('View file')).toHaveLength(3);
  });

  test('requesting the Special Pay Form via email calls onRequestDocument with the template path', () => {
    const onRequestDocument = vi.fn();
    render(
      <NUEmployeePaymentFields
        isEditing={false}
        requestedDocTypes={new Set()}
        onChange={vi.fn()}
        onRequestDocument={onRequestDocument}
      />,
    );
    fireEvent.click(screen.getByText('Request Special Pay Form via Email'));
    expect(onRequestDocument).toHaveBeenCalledWith(
      'specialPayForm',
      'Special Pay Form',
      '/forms/special-pay-request-form.pdf',
    );
  });

  test('shows a requested note for each requested doc type', () => {
    render(
      <NUEmployeePaymentFields
        isEditing={false}
        requestedDocTypes={new Set(['contract', 'w9', 'specialPayForm'])}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(
      screen.getByText('RSO Agreement requested — waiting for vendor to upload'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('W-9 requested — waiting for vendor to upload'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Special Pay Form requested — waiting for vendor to upload'),
    ).toBeInTheDocument();
  });
});
