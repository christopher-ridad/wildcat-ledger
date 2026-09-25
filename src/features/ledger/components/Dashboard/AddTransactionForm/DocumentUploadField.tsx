import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import { DocumentRequirement } from '../../../utils/documentRequirements';
import styles from './AddTransactionForm.module.css';
import { ExistingFileLink } from './ExistingFileLink';
import { FormState } from './types';

interface DocumentUploadFieldProps {
  doc: DocumentRequirement;
  form: FormState;
  isEditing: boolean;
  existingTransaction?: Transaction;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onNotStoredChange: (doc: DocumentRequirement, notStored: boolean) => void;
  // W-9 and RSO Agreement run a completeness check on the picked file, which
  // is still useful when no copy is being stored.
  hasCompletenessCheck?: boolean;
}

// A file input + existing-file link for one DocumentRequirement, with the
// option not to store a copy in WildcatLedger. Shared by
// DirectPaymentFields and NUEmployeePaymentFields, which otherwise repeated
// this block once per document.
export const DocumentUploadField = ({
  doc,
  form,
  isEditing,
  existingTransaction,
  onChange,
  onNotStoredChange,
  hasCompletenessCheck = false,
}: DocumentUploadFieldProps) => {
  const notStored = !!doc.formNotStoredField && !!form[doc.formNotStoredField];
  const existingUrl = existingTransaction?.[doc.field] as string | undefined;
  // Nothing ever deletes an uploaded file from storage, so offering "don't
  // store" on a document that's already stored would only hide the link.
  const canSkipStoring = !!doc.formNotStoredField && !existingUrl;

  return (
    <div className="wl-form-group">
      <div className="wl-form-label-row">
        <label className="wl-form-label" htmlFor={doc.formField}>
          {doc.label}
        </label>
        {doc.templatePath && (
          <a
            href={doc.templatePath}
            target="_blank"
            rel="noreferrer"
            className={styles['wl-form-template-link']}
          >
            ↓ Blank {doc.label}
          </a>
        )}
      </div>

      <div className={styles['wl-receipt-options']}>
        <input
          id={doc.formField}
          name={doc.formField}
          type="file"
          accept="image/*,application/pdf"
          className="wl-form-file"
          onChange={onChange}
        />
        {isEditing && existingUrl && (
          <span className={styles['wl-form-file-existing']}>
            Current: <ExistingFileLink path={existingUrl} />
          </span>
        )}
        {canSkipStoring && (
          <label className={styles['wl-form-checkbox']}>
            <input
              type="checkbox"
              name={doc.formNotStoredField}
              checked={notStored}
              onChange={(e) => onNotStoredChange(doc, e.target.checked)}
            />
            <span>Don&apos;t store this document in WildcatLedger</span>
          </label>
        )}
        {notStored && (
          <p className={styles['wl-form-hint']}>
            {hasCompletenessCheck
              ? "Pick the file to check it for missing fields. It won't be saved."
              : "A file picked here won't be saved."}
          </p>
        )}
      </div>
    </div>
  );
};
