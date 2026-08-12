import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import styles from './AddTransactionForm.module.css';
import { ExistingFileLink } from './ExistingFileLink';

interface NUEmployeePaymentFieldsProps {
  isEditing: boolean;
  existingTransaction?: Transaction;
  requestedDocTypes: Set<string>;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRequestDocument: (docType: string, label: string, templatePath?: string) => void;
}

export const NUEmployeePaymentFields = ({
  isEditing,
  existingTransaction,
  requestedDocTypes,
  onChange,
  onRequestDocument,
}: NUEmployeePaymentFieldsProps) => (
  <>
    <div className="wl-form-group">
      <div className="wl-form-label-row">
        <label className="wl-form-label" htmlFor="contractFile">
          RSO Agreement{' '}
          {!isEditing && <span className={styles['wl-form-required']}>*</span>}
        </label>
        <a
          href="/forms/rso-agreement.pdf"
          target="_blank"
          rel="noreferrer"
          className={styles['wl-form-template-link']}
        >
          ↓ Blank RSO Agreement
        </a>
      </div>
      <div className={styles['wl-receipt-options']}>
        <input
          id="contractFile"
          name="contractFile"
          type="file"
          accept="image/*,application/pdf"
          className="wl-form-file"
          onChange={onChange}
        />
        {!isEditing && (
          <>
            <div className={styles['wl-receipt-or']}>or</div>
            <button
              type="button"
              className={styles['wl-btn-request-receipt']}
              onClick={() =>
                onRequestDocument('contract', 'RSO Agreement', '/forms/rso-agreement.pdf')
              }
            >
              Request RSO Agreement Signature via Email
            </button>
            {requestedDocTypes.has('contract') && (
              <span className={styles['wl-receipt-requested-note']}>
                RSO Agreement requested — waiting for vendor to upload
              </span>
            )}
          </>
        )}
      </div>
      {isEditing && existingTransaction?.contractFileUrl && (
        <span className={styles['wl-form-file-existing']}>
          Current: <ExistingFileLink path={existingTransaction.contractFileUrl} />
        </span>
      )}
    </div>

    <div className="wl-form-group">
      <div className="wl-form-label-row">
        <label className="wl-form-label" htmlFor="w9File">
          W-9 {!isEditing && <span className={styles['wl-form-required']}>*</span>}
        </label>
        <a
          href="/forms/w9.pdf"
          target="_blank"
          rel="noreferrer"
          className={styles['wl-form-template-link']}
        >
          ↓ Blank W-9
        </a>
      </div>
      <div className={styles['wl-receipt-options']}>
        <input
          id="w9File"
          name="w9File"
          type="file"
          accept="image/*,application/pdf"
          className="wl-form-file"
          onChange={onChange}
        />
        {!isEditing && (
          <>
            <div className={styles['wl-receipt-or']}>or</div>
            <button
              type="button"
              className={styles['wl-btn-request-receipt']}
              onClick={() => onRequestDocument('w9', 'W-9', '/forms/w9.pdf')}
            >
              Request W-9 via Email
            </button>
            {requestedDocTypes.has('w9') && (
              <span className={styles['wl-receipt-requested-note']}>
                W-9 requested — waiting for vendor to upload
              </span>
            )}
          </>
        )}
      </div>
      {isEditing && existingTransaction?.w9FileUrl && (
        <span className={styles['wl-form-file-existing']}>
          Current: <ExistingFileLink path={existingTransaction.w9FileUrl} />
        </span>
      )}
    </div>

    <div className="wl-form-group">
      <div className="wl-form-label-row">
        <label className="wl-form-label" htmlFor="specialPayFormFile">
          Special Pay Form{' '}
          {!isEditing && <span className={styles['wl-form-required']}>*</span>}
        </label>
        <a
          href="/forms/special-pay-request-form.pdf"
          target="_blank"
          rel="noreferrer"
          className={styles['wl-form-template-link']}
        >
          ↓ Blank Special Pay Form
        </a>
      </div>
      <div className={styles['wl-receipt-options']}>
        <input
          id="specialPayFormFile"
          name="specialPayFormFile"
          type="file"
          accept="image/*,application/pdf"
          className="wl-form-file"
          onChange={onChange}
        />
        {!isEditing && (
          <>
            <div className={styles['wl-receipt-or']}>or</div>
            <button
              type="button"
              className={styles['wl-btn-request-receipt']}
              onClick={() =>
                onRequestDocument(
                  'specialPayForm',
                  'Special Pay Form',
                  '/forms/special-pay-request-form.pdf',
                )
              }
            >
              Request Special Pay Form via Email
            </button>
            {requestedDocTypes.has('specialPayForm') && (
              <span className={styles['wl-receipt-requested-note']}>
                Special Pay Form requested — waiting for vendor to upload
              </span>
            )}
          </>
        )}
      </div>
      {isEditing && existingTransaction?.specialPayFormUrl && (
        <span className={styles['wl-form-file-existing']}>
          Current: <ExistingFileLink path={existingTransaction.specialPayFormUrl} />
        </span>
      )}
    </div>
  </>
);
