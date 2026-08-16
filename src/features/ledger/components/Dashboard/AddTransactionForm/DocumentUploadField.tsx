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
}

// A file input + "I don't have this yet" checkbox + missing-document notice
// + existing-file link, for one DocumentRequirement. Shared by
// DirectPaymentFields and NUEmployeePaymentFields, which otherwise repeated
// this block once per document.
export const DocumentUploadField = ({
  doc,
  form,
  isEditing,
  existingTransaction,
  onChange,
}: DocumentUploadFieldProps) => {
  const file = form[doc.formField];
  const acknowledgedMissing = (
    doc.formAcknowledgedMissingField ? form[doc.formAcknowledgedMissingField] : false
  ) as boolean;
  const existingUrl = existingTransaction?.[doc.field] as string | undefined;

  return (
    <div className="wl-form-group">
      <div className="wl-form-label-row">
        <label className="wl-form-label" htmlFor={doc.formField}>
          {doc.label}{' '}
          {!isEditing && !acknowledgedMissing && (
            <span className={styles['wl-form-required']}>*</span>
          )}
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
          disabled={acknowledgedMissing}
          onChange={onChange}
        />
        {isEditing && existingUrl && (
          <span className={styles['wl-form-file-existing']}>
            Current: <ExistingFileLink path={existingUrl} />
          </span>
        )}
      </div>
      {!file && !(isEditing && existingUrl) && doc.formAcknowledgedMissingField && (
        <div className={styles['wl-form-no-receipt']}>
          <label className={styles['wl-form-checkbox']}>
            <input
              type="checkbox"
              name={doc.formAcknowledgedMissingField}
              checked={acknowledgedMissing}
              onChange={onChange}
            />
            <span>I don&apos;t have this yet</span>
          </label>
          {acknowledgedMissing && (
            <div className={styles['wl-form-no-receipt-notice']}>
              ⚠ This transaction will be flagged as missing the {doc.label}. You can
              request it via email from the transaction&apos;s Files panel once it&apos;s
              saved.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
