import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import { POLICY_EXEMPTION_FORM_URL } from '../../../utils/constants';
import styles from './AddTransactionForm.module.css';
import { ExistingFileLink } from './ExistingFileLink';
import { FormState } from './types';

interface DebitCardFieldsProps {
  form: FormState;
  isEditing: boolean;
  existingTransaction?: Transaction;
  scanning: boolean;
  requestedDocTypes: Set<string>;
  onReceiptChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRequestDocument: (docType: string, label: string, templatePath?: string) => void;
}

export const DebitCardFields = ({
  form,
  isEditing,
  existingTransaction,
  scanning,
  requestedDocTypes,
  onReceiptChange,
  onChange,
  onRequestDocument,
}: DebitCardFieldsProps) => (
  <>
    <div className="wl-form-group">
      <label className="wl-form-label" htmlFor="receiptFile">
        Receipt Photo{' '}
        {!isEditing && !form.noReceiptAcknowledged && (
          <span className={styles['wl-form-required']}>*</span>
        )}
        {scanning && <span className="wl-ocr-scanning"> Scanning…</span>}
      </label>
      <div className={styles['wl-receipt-options']}>
        <input
          id="receiptFile"
          name="receiptFile"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="wl-form-file"
          disabled={form.noReceiptAcknowledged}
          onChange={onReceiptChange}
        />
        {!isEditing && !form.noReceiptAcknowledged && (
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
        {isEditing && existingTransaction?.receiptFileUrl && (
          <span className={styles['wl-form-file-existing']}>
            Current: <ExistingFileLink path={existingTransaction.receiptFileUrl} />
          </span>
        )}
      </div>
    </div>

    {/* Only show "no receipt" option when there's no receipt on file */}
    {!form.receiptFile && !(isEditing && existingTransaction?.receiptFileUrl) && (
      <div className={styles['wl-form-no-receipt']}>
        <label className={styles['wl-form-checkbox']}>
          <input
            type="checkbox"
            name="noReceiptAcknowledged"
            checked={form.noReceiptAcknowledged}
            onChange={onChange}
          />
          <span>I don&apos;t have a receipt</span>
        </label>
        {form.noReceiptAcknowledged && (
          <div className={styles['wl-form-no-receipt-notice']}>
            <span>⚠ This transaction will be flagged as missing a receipt. </span>
            <span>
              You&apos;ll need to submit a{' '}
              <a href={POLICY_EXEMPTION_FORM_URL} target="_blank" rel="noreferrer">
                Policy Exemption Request Form
              </a>{' '}
              and attach it before this transaction can be reconciled.
            </span>
          </div>
        )}
      </div>
    )}
  </>
);
