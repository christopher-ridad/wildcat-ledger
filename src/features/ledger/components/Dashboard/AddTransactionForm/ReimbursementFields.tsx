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
  onReceiptChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const ReimbursementFields = ({
  form,
  isEditing,
  existingTransaction,
  scanning,
  onReceiptChange,
  onChange,
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
        {!isEditing && !form.noReceiptAcknowledged && (
          <span className={styles['wl-form-required']}>*</span>
        )}
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
          disabled={form.noReceiptAcknowledged}
          onChange={onReceiptChange}
        />
        {isEditing && existingTransaction?.receiptFileUrl && (
          <span className={styles['wl-form-file-existing']}>
            Current: <ExistingFileLink path={existingTransaction.receiptFileUrl} />
          </span>
        )}
      </div>
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
          <span>I don&apos;t have a receipt yet</span>
        </label>
        {form.noReceiptAcknowledged && (
          <div className={styles['wl-form-no-receipt-notice']}>
            ⚠ This transaction will be flagged as missing a receipt. You can request one
            via email from the transaction&apos;s Files panel once it&apos;s saved.
          </div>
        )}
      </div>
    )}

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
