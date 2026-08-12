import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import styles from './AddTransactionForm.module.css';
import { ExistingFileLink } from './ExistingFileLink';
import { FormState } from './types';

interface DirectPaymentFieldsProps {
  form: FormState;
  isEditing: boolean;
  existingTransaction?: Transaction;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const DirectPaymentFields = ({
  form,
  isEditing,
  existingTransaction,
  onChange,
}: DirectPaymentFieldsProps) => (
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

    <label className={styles['wl-form-checkbox']}>
      <input
        type="checkbox"
        name="isIndividualVendor"
        checked={form.isIndividualVendor}
        onChange={onChange}
      />
      <span>Is this an individual vendor?</span>
    </label>

    {form.isIndividualVendor && (
      <>
        <div className="wl-form-group">
          <div className="wl-form-label-row">
            <label className="wl-form-label" htmlFor="contractedServicesFile">
              Contracted Services Form{' '}
              {!isEditing && !form.contractedServicesAcknowledgedMissing && (
                <span className={styles['wl-form-required']}>*</span>
              )}
            </label>
            <a
              href="/forms/contracted-services.pdf"
              target="_blank"
              rel="noreferrer"
              className={styles['wl-form-template-link']}
            >
              ↓ Blank Contracted Services Form
            </a>
          </div>
          <div className={styles['wl-receipt-options']}>
            <input
              id="contractedServicesFile"
              name="contractedServicesFile"
              type="file"
              accept="image/*,application/pdf"
              className="wl-form-file"
              disabled={form.contractedServicesAcknowledgedMissing}
              onChange={onChange}
            />
            {isEditing && existingTransaction?.contractedServicesFileUrl && (
              <span className={styles['wl-form-file-existing']}>
                Current:{' '}
                <ExistingFileLink path={existingTransaction.contractedServicesFileUrl} />
              </span>
            )}
          </div>
          {!form.contractedServicesFile &&
            !(isEditing && existingTransaction?.contractedServicesFileUrl) && (
              <div className={styles['wl-form-no-receipt']}>
                <label className={styles['wl-form-checkbox']}>
                  <input
                    type="checkbox"
                    name="contractedServicesAcknowledgedMissing"
                    checked={form.contractedServicesAcknowledgedMissing}
                    onChange={onChange}
                  />
                  <span>I don&apos;t have this yet</span>
                </label>
                {form.contractedServicesAcknowledgedMissing && (
                  <div className={styles['wl-form-no-receipt-notice']}>
                    ⚠ This transaction will be flagged as missing the Contracted Services
                    Form. You can request it via email from the transaction&apos;s Files
                    panel once it&apos;s saved.
                  </div>
                )}
              </div>
            )}
        </div>

        <div className="wl-form-group">
          <div className="wl-form-label-row">
            <label className="wl-form-label" htmlFor="conflictOfInterestFile">
              Conflict of Interest Form{' '}
              {!isEditing && !form.conflictOfInterestAcknowledgedMissing && (
                <span className={styles['wl-form-required']}>*</span>
              )}
            </label>
            <a
              href="/forms/conflict-of-interest.pdf"
              target="_blank"
              rel="noreferrer"
              className={styles['wl-form-template-link']}
            >
              ↓ Blank Conflict of Interest Form
            </a>
          </div>
          <div className={styles['wl-receipt-options']}>
            <input
              id="conflictOfInterestFile"
              name="conflictOfInterestFile"
              type="file"
              accept="image/*,application/pdf"
              className="wl-form-file"
              disabled={form.conflictOfInterestAcknowledgedMissing}
              onChange={onChange}
            />
            {isEditing && existingTransaction?.conflictOfInterestFileUrl && (
              <span className={styles['wl-form-file-existing']}>
                Current:{' '}
                <ExistingFileLink path={existingTransaction.conflictOfInterestFileUrl} />
              </span>
            )}
          </div>
          {!form.conflictOfInterestFile &&
            !(isEditing && existingTransaction?.conflictOfInterestFileUrl) && (
              <div className={styles['wl-form-no-receipt']}>
                <label className={styles['wl-form-checkbox']}>
                  <input
                    type="checkbox"
                    name="conflictOfInterestAcknowledgedMissing"
                    checked={form.conflictOfInterestAcknowledgedMissing}
                    onChange={onChange}
                  />
                  <span>I don&apos;t have this yet</span>
                </label>
                {form.conflictOfInterestAcknowledgedMissing && (
                  <div className={styles['wl-form-no-receipt-notice']}>
                    ⚠ This transaction will be flagged as missing the Conflict of Interest
                    Form. You can request it via email from the transaction&apos;s Files
                    panel once it&apos;s saved.
                  </div>
                )}
              </div>
            )}
        </div>
      </>
    )}
  </>
);
