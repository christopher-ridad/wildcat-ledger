import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import styles from './AddTransactionForm.module.css';
import { ExistingFileLink } from './ExistingFileLink';
import { FormState } from './types';

interface ReimbursementFieldsProps {
  form: FormState;
  isEditing: boolean;
  existingTransaction?: Transaction;
  scanning: boolean;
  requestedDocTypes: Set<string>;
  onReceiptChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRequestDocument: (docType: string, label: string, templatePath?: string) => void;
}

export const ReimbursementFields = ({
  form,
  isEditing,
  existingTransaction,
  scanning,
  requestedDocTypes,
  onReceiptChange,
  onChange,
  onRequestDocument,
}: ReimbursementFieldsProps) => (
  <>
    <div className="wl-form-group">
      <label className="wl-form-label" htmlFor="reimbursedMemberName">
        Name of Member Being Reimbursed{' '}
        <span className={styles['wl-form-required']}>*</span>
      </label>
      <input
        id="reimbursedMemberName"
        name="reimbursedMemberName"
        type="text"
        className="wl-form-input"
        value={form.reimbursedMemberName}
        onChange={onChange}
        placeholder="e.g. Jane Smith"
      />
    </div>

    <div className="wl-form-group">
      <label className="wl-form-label" htmlFor="receiptFile">
        Receipt Photo{' '}
        {!isEditing && <span className={styles['wl-form-required']}>*</span>}
        {scanning && <span className="wl-ocr-scanning"> Scanning…</span>}
      </label>
      <p className={styles['wl-form-hint']}>Tax cannot be reimbursed.</p>
      <div className={styles['wl-receipt-options']}>
        <input
          id="receiptFile"
          name="receiptFile"
          type="file"
          accept="image/*,application/pdf"
          className="wl-form-file"
          onChange={onReceiptChange}
        />
        {!isEditing && (
          <>
            <div className={styles['wl-receipt-or']}>or</div>
            <button
              type="button"
              className={styles['wl-btn-request-receipt']}
              onClick={() => onRequestDocument('receipt', 'Receipt')}
            >
              Request Receipt via Email
            </button>
            {requestedDocTypes.has('receipt') && (
              <span className={styles['wl-receipt-requested-note']}>
                Receipt requested — waiting for member to upload
              </span>
            )}
          </>
        )}
      </div>
      {isEditing && existingTransaction?.receiptFileUrl && (
        <span className={styles['wl-form-file-existing']}>
          Current: <ExistingFileLink path={existingTransaction.receiptFileUrl} />
        </span>
      )}
    </div>

    <div className="wl-form-group">
      <label className="wl-form-label" htmlFor="zelleInfo">
        Zelle Email or Phone Number <span className={styles['wl-form-required']}>*</span>
      </label>
      <input
        id="zelleInfo"
        name="zelleInfo"
        type="text"
        className="wl-form-input"
        value={form.zelleInfo}
        onChange={onChange}
        placeholder="e.g. vendor@email.com or (555) 123-4567"
      />
    </div>
  </>
);
