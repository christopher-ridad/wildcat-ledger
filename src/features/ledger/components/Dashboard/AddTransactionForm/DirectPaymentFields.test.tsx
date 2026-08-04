import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { DirectPaymentFields } from './DirectPaymentFields';
import { initialForm } from './types';

describe('DirectPaymentFields', () => {
  test('requires contract and W-9 with request-via-email options when creating', () => {
    render(
      <DirectPaymentFields
        form={initialForm}
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
  });

  test('hides request-via-email options while editing', () => {
    render(
      <DirectPaymentFields
        form={initialForm}
        isEditing
        requestedDocTypes={new Set()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(
      screen.queryByText('Request RSO Agreement Signature via Email'),
    ).not.toBeInTheDocument();
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
        requestedDocTypes={new Set()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(screen.getAllByText('View file')).toHaveLength(2);
  });

  test('does not show individual-vendor fields by default', () => {
    render(
      <DirectPaymentFields
        form={initialForm}
        isEditing={false}
        requestedDocTypes={new Set()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(screen.queryByText('Contracted Services Form')).not.toBeInTheDocument();
  });

  test('reveals contracted-services and conflict-of-interest fields for individual vendors', () => {
    render(
      <DirectPaymentFields
        form={{ ...initialForm, isIndividualVendor: true }}
        isEditing={false}
        requestedDocTypes={new Set()}
        onChange={vi.fn()}
        onRequestDocument={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Contracted Services Form/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Conflict of Interest Form/)).toBeInTheDocument();
  });

  test('toggling the individual-vendor checkbox calls onChange', () => {
    const onChange = vi.fn();
    render(
      <DirectPaymentFields
        form={initialForm}
        isEditing={false}
        requestedDocTypes={new Set()}
        onChange={onChange}
        onRequestDocument={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Is this an individual vendor?'));
    expect(onChange).toHaveBeenCalled();
  });

  test('requesting the W-9 via email calls onRequestDocument with the template path', () => {
    const onRequestDocument = vi.fn();
    render(
      <DirectPaymentFields
        form={initialForm}
        isEditing={false}
        requestedDocTypes={new Set()}
        onChange={vi.fn()}
        onRequestDocument={onRequestDocument}
      />,
    );
    fireEvent.click(screen.getByText('Request W-9 via Email'));
    expect(onRequestDocument).toHaveBeenCalledWith('w9', 'W-9', '/forms/w9.pdf');
  });

  test('shows a requested note for each requested doc type', () => {
    render(
      <DirectPaymentFields
        form={initialForm}
        isEditing={false}
        requestedDocTypes={new Set(['contract', 'w9'])}
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
  });
});
