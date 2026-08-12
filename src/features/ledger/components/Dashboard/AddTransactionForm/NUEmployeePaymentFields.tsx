import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import styles from './AddTransactionForm.module.css';
import { ExistingFileLink } from './ExistingFileLink';
import { FormState } from './types';

interface NUEmployeePaymentFieldsProps {
  form: FormState;
  isEditing: boolean;
  existingTransaction?: Transaction;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const NUEmployeePaymentFields = ({
  form,
  isEditing,
  existingTransaction,
  onChange,
}: NUEmployeePaymentFieldsProps) => (
  <>
    <div className="wl-form-group">
      <div className="wl-form-label-row">
        <label className="wl-form-label" htmlFor="contractFile">
          RSO Agreement{' '}
          {!isEditing && !form.contractAcknowledgedMissing && (
            <span className={styles['wl-form-required']}>*</span>
          )}
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
          disabled={form.contractAcknowledgedMissing}
          onChange={onChange}
        />
        {isEditing && existingTransaction?.contractFileUrl && (
          <span className={styles['wl-form-file-existing']}>
            Current: <ExistingFileLink path={existingTransaction.contractFileUrl} />
          </span>
        )}
      </div>
      {!form.contractFile && !(isEditing && existingTransaction?.contractFileUrl) && (
        <div className={styles['wl-form-no-receipt']}>
          <label className={styles['wl-form-checkbox']}>
            <input
              type="checkbox"
              name="contractAcknowledgedMissing"
              checked={form.contractAcknowledgedMissing}
              onChange={onChange}
            />
            <span>I don&apos;t have this yet</span>
          </label>
          {form.contractAcknowledgedMissing && (
            <div className={styles['wl-form-no-receipt-notice']}>
              ⚠ This transaction will be flagged as missing the RSO Agreement. You can
              request it via email from the transaction&apos;s Files panel once it&apos;s
              saved.
            </div>
          )}
        </div>
      )}
    </div>

    <div className="wl-form-group">
      <div className="wl-form-label-row">
        <label className="wl-form-label" htmlFor="w9File">
          W-9{' '}
          {!isEditing && !form.w9AcknowledgedMissing && (
            <span className={styles['wl-form-required']}>*</span>
          )}
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
          disabled={form.w9AcknowledgedMissing}
          onChange={onChange}
        />
        {isEditing && existingTransaction?.w9FileUrl && (
          <span className={styles['wl-form-file-existing']}>
            Current: <ExistingFileLink path={existingTransaction.w9FileUrl} />
          </span>
        )}
      </div>
      {!form.w9File && !(isEditing && existingTransaction?.w9FileUrl) && (
        <div className={styles['wl-form-no-receipt']}>
          <label className={styles['wl-form-checkbox']}>
            <input
              type="checkbox"
              name="w9AcknowledgedMissing"
              checked={form.w9AcknowledgedMissing}
              onChange={onChange}
            />
            <span>I don&apos;t have this yet</span>
          </label>
          {form.w9AcknowledgedMissing && (
            <div className={styles['wl-form-no-receipt-notice']}>
              ⚠ This transaction will be flagged as missing the W-9. You can request it
              via email from the transaction&apos;s Files panel once it&apos;s saved.
            </div>
          )}
        </div>
      )}
    </div>

    <div className="wl-form-group">
      <div className="wl-form-label-row">
        <label className="wl-form-label" htmlFor="specialPayFormFile">
          Special Pay Form{' '}
          {!isEditing && !form.specialPayFormAcknowledgedMissing && (
            <span className={styles['wl-form-required']}>*</span>
          )}
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
          disabled={form.specialPayFormAcknowledgedMissing}
          onChange={onChange}
        />
        {isEditing && existingTransaction?.specialPayFormUrl && (
          <span className={styles['wl-form-file-existing']}>
            Current: <ExistingFileLink path={existingTransaction.specialPayFormUrl} />
          </span>
        )}
      </div>
      {!form.specialPayFormFile &&
        !(isEditing && existingTransaction?.specialPayFormUrl) && (
          <div className={styles['wl-form-no-receipt']}>
            <label className={styles['wl-form-checkbox']}>
              <input
                type="checkbox"
                name="specialPayFormAcknowledgedMissing"
                checked={form.specialPayFormAcknowledgedMissing}
                onChange={onChange}
              />
              <span>I don&apos;t have this yet</span>
            </label>
            {form.specialPayFormAcknowledgedMissing && (
              <div className={styles['wl-form-no-receipt-notice']}>
                ⚠ This transaction will be flagged as missing the Special Pay Form. You
                can request it via email from the transaction&apos;s Files panel once
                it&apos;s saved.
              </div>
            )}
          </div>
        )}
    </div>
  </>
);
