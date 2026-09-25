import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockTransaction } from '../../../../../test/mocks';
import { DOCUMENT_REQUIREMENTS_BY_KEY } from '../../../utils/documentRequirements';
import { DocumentUploadField } from './DocumentUploadField';
import { initialForm } from './types';

const W9 = DOCUMENT_REQUIREMENTS_BY_KEY.w9;

const renderField = (
  overrides: Partial<ComponentProps<typeof DocumentUploadField>> = {},
) =>
  render(
    <DocumentUploadField
      doc={W9}
      form={initialForm}
      isEditing={false}
      onChange={vi.fn()}
      onNotStoredChange={vi.fn()}
      {...overrides}
    />,
  );

const notStoredCheckbox = () =>
  screen.queryByRole('checkbox', { name: "Don't store this document in WildcatLedger" });

describe('DocumentUploadField', () => {
  test('ticking the not-stored checkbox marks the document not stored', () => {
    const onNotStoredChange = vi.fn();
    renderField({ onNotStoredChange });
    expect(notStoredCheckbox()).not.toBeChecked();
    fireEvent.click(notStoredCheckbox()!);
    expect(onNotStoredChange).toHaveBeenCalledWith(W9, true);
  });

  test('when not stored, the checkbox is ticked and unticks to store again', () => {
    const onNotStoredChange = vi.fn();
    renderField({ form: { ...initialForm, w9NotStored: true }, onNotStoredChange });
    expect(notStoredCheckbox()).toBeChecked();
    fireEvent.click(notStoredCheckbox()!);
    expect(onNotStoredChange).toHaveBeenCalledWith(W9, false);
  });

  test('when not stored, keeps a check-only file input for documents with a completeness check', () => {
    renderField({
      form: { ...initialForm, w9NotStored: true },
      hasCompletenessCheck: true,
    });
    expect(screen.getByLabelText('W-9')).toBeInTheDocument();
    expect(screen.getByText(/It won't be saved/)).toBeInTheDocument();
  });

  test('has no check-only hint while the document is being stored', () => {
    renderField({ hasCompletenessCheck: true });
    expect(screen.queryByText(/It won't be saved/)).not.toBeInTheDocument();
  });

  test('when not stored, keeps the file input on every document and says the file is discarded', () => {
    renderField({
      doc: DOCUMENT_REQUIREMENTS_BY_KEY.specialPayForm,
      form: { ...initialForm, specialPayFormNotStored: true },
    });
    expect(screen.getByLabelText('Special Pay Form')).toBeInTheDocument();
    expect(screen.getByText("A file picked here won't be saved.")).toBeInTheDocument();
    expect(notStoredCheckbox()).toBeChecked();
  });

  test('does not offer to skip storing a document that already has a stored copy', () => {
    renderField({
      isEditing: true,
      existingTransaction: buildMockTransaction({ w9FileUrl: 'orgs/1/w9.pdf' }),
    });
    expect(screen.getByText('View file')).toBeInTheDocument();
    expect(notStoredCheckbox()).not.toBeInTheDocument();
  });
});
