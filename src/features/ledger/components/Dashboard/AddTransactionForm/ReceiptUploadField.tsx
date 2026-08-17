import type { ChangeEvent, ReactNode } from 'react';

import { Transaction } from '../../../types';
import styles from './AddTransactionForm.module.css';
import { ExistingFileLink } from './ExistingFileLink';
import { FormState } from './types';

interface ReceiptUploadFieldProps {
  form: FormState;
  isEditing: boolean;
  existingTransaction?: Transaction;
  scanning: boolean;
  ocrError: string | null;
  onReceiptChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  hint: string;
  noReceiptLabel: string;
  noReceiptNotice: ReactNode;
}

// The Receipt Photo upload + "I don't have a receipt" checkbox, shared by
// DebitCardFields and ReimbursementFields, which otherwise repeated this
// block identically apart from the hint/checkbox/notice copy.
export const ReceiptUploadField = ({
  form,
  isEditing,
  existingTransaction,
  scanning,
  ocrError,
  onReceiptChange,
  onChange,
  hint,
  noReceiptLabel,
  noReceiptNotice,
}: ReceiptUploadFieldProps) => (
  <>
    <div className="wl-form-group">
      <label className="wl-form-label" htmlFor="receiptFile">
        Receipt Photo{' '}
        {!isEditing && !form.noReceiptAcknowledged && (
          <span className={styles['wl-form-required']}>*</span>
        )}
        {scanning && <span className="wl-ocr-scanning"> Scanning…</span>}
      </label>
      <p className={styles['wl-form-hint']}>{hint}</p>
      <div className={styles['wl-receipt-options']}>
        <input
          id="receiptFile"
          name="receiptFile"
          type="file"
          accept="image/*,application/pdf"
          className="wl-form-file"
          disabled={form.noReceiptAcknowledged}
          onChange={onReceiptChange}
        />
        {isEditing && existingTransaction?.receiptFileUrl && (
          <span className={styles['wl-form-file-existing']}>
            Current: <ExistingFileLink path={existingTransaction.receiptFileUrl} />
          </span>
        )}
      </div>
      {ocrError && (
        <div className="wl-form-error" style={{ marginTop: 8 }}>
          {ocrError} — you can enter the title/amount manually.
        </div>
      )}
    </div>

    {!form.receiptFile && !(isEditing && existingTransaction?.receiptFileUrl) && (
      <div className={styles['wl-form-no-receipt']}>
        <label className={styles['wl-form-checkbox']}>
          <input
            type="checkbox"
            name="noReceiptAcknowledged"
            checked={form.noReceiptAcknowledged}
            onChange={onChange}
          />
          <span>{noReceiptLabel}</span>
        </label>
        {form.noReceiptAcknowledged && (
          <div className={styles['wl-form-no-receipt-notice']}>{noReceiptNotice}</div>
        )}
      </div>
    )}
  </>
);
