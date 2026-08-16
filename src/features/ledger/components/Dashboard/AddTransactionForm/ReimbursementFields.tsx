import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import styles from './AddTransactionForm.module.css';
import { ReceiptUploadField } from './ReceiptUploadField';
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

    <ReceiptUploadField
      form={form}
      isEditing={isEditing}
      existingTransaction={existingTransaction}
      scanning={scanning}
      onReceiptChange={onReceiptChange}
      onChange={onChange}
      hint="Tax cannot be reimbursed."
      noReceiptLabel="I don't have a receipt yet"
      noReceiptNotice={
        <>
          ⚠ This transaction will be flagged as missing a receipt. You can request one via
          email from the transaction&apos;s Files panel once it&apos;s saved.
        </>
      }
    />

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
