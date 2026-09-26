import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import { DocumentRequirement } from '../../../utils/documentRequirements';
import styles from './AddTransactionForm.module.css';
import { ExistingFileLink } from './ExistingFileLink';
import { FormState } from './types';

// Everything a DocumentUploadField needs except which document it's for --
// the part every field group passes to each of its documents unchanged.
export interface SharedDocumentFieldProps {
  form: FormState;
  isEditing: boolean;
  existingTransaction?: Transaction;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onNotStoredChange: (doc: DocumentRequirement, notStored: boolean) => void;
}

// Props for a group of document fields that also hosts the completeness
// checks (DirectPaymentFields, NUEmployeePaymentFields). Not every group
// uses every one of these -- NUEmployeePaymentFields has no vendor forms,
// for instance -- but sharing one prop shape keeps DocumentFieldGroupProps
// a single source of truth rather than a slightly different interface per
// group.
export interface DocumentFieldGroupProps extends SharedDocumentFieldProps {
  onW9CheckBlockingChange: (blocking: boolean) => void;
  onRsoCheckBlockingChange: (blocking: boolean) => void;
  onContractedServicesCheckBlockingChange: (blocking: boolean) => void;
  onConflictOfInterestCheckBlockingChange: (blocking: boolean) => void;
  onSpecialPayFormCheckBlockingChange: (blocking: boolean) => void;
}

interface DocumentUploadFieldProps extends SharedDocumentFieldProps {
  doc: DocumentRequirement;
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
}: DocumentUploadFieldProps) => {
  const notStored = !!doc.notStoredField && !!form[doc.notStoredField];
  const existingUrl = existingTransaction?.[doc.field] as string | undefined;
  // Nothing ever deletes an uploaded file from storage, so offering "don't
  // store" on a document that's already stored would only hide the link.
  const canSkipStoring = !!doc.notStoredField && !existingUrl;

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
              name={doc.notStoredField}
              checked={notStored}
              onChange={(e) => onNotStoredChange(doc, e.target.checked)}
            />
            <span>Don&apos;t store this document in WildcatLedger</span>
          </label>
        )}
        {notStored && (
          <p className={styles['wl-form-hint']}>
            {doc.hasCompletenessCheck
              ? "Pick the file to check it for missing fields. It won't be saved."
              : "A file picked here won't be saved."}
          </p>
        )}
      </div>
    </div>
  );
};
