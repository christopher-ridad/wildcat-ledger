import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import { POLICY_EXEMPTION_FORM_URL } from '../../../utils/constants';
import styles from './AddTransactionForm.module.css';
import { ReceiptUploadField } from './ReceiptUploadField';
import { FormState } from './types';

interface DebitCardFieldsProps {
  form: FormState;
  isEditing: boolean;
  existingTransaction?: Transaction;
  scanning: boolean;
  onReceiptChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const DebitCardFields = ({
  form,
  isEditing,
  existingTransaction,
  scanning,
  onReceiptChange,
  onChange,
}: DebitCardFieldsProps) => (
  <>
    <ReceiptUploadField
      form={form}
      isEditing={isEditing}
      existingTransaction={existingTransaction}
      scanning={scanning}
      onReceiptChange={onReceiptChange}
      onChange={onChange}
      hint="Tax cannot be paid by the debit card."
      noReceiptLabel="I don't have a receipt"
      noReceiptNotice={
        <>
          <span>⚠ This transaction will be flagged as missing a receipt. </span>
          <span>
            You&apos;ll need to submit a{' '}
            <a href={POLICY_EXEMPTION_FORM_URL} target="_blank" rel="noreferrer">
              Policy Exemption Request Form
            </a>{' '}
            and attach it before this transaction can be reconciled.
          </span>
        </>
      }
    />

    <div className={styles['wl-form-no-receipt']}>
      <label className={styles['wl-form-checkbox']}>
        <input
          type="checkbox"
          name="taxExemptFormSubmitted"
          checked={form.taxExemptFormSubmitted}
          onChange={onChange}
        />
        <span>I submitted a tax exemption form to the vendor</span>
      </label>

      {!form.taxExemptFormSubmitted && (
        <div className="wl-form-group">
          <label className="wl-form-label" htmlFor="taxAmount">
            Tax Charged on Receipt (if any)
          </label>
          <input
            id="taxAmount"
            name="taxAmount"
            type="text"
            inputMode="decimal"
            className="wl-form-input"
            value={form.taxAmount}
            onChange={onChange}
            placeholder="0.00"
          />
          {parseFloat(form.taxAmount || '0') > 0 && (
            <div className={styles['wl-form-no-receipt-notice']}>
              ⚠ This transaction will be flagged as owing a tax reimbursement to SOFO.
            </div>
          )}
        </div>
      )}
    </div>
  </>
);
