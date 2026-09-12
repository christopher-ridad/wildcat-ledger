import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import { DOCUMENT_REQUIREMENTS_BY_KEY } from '../../../utils/documentRequirements';
import styles from './AddTransactionForm.module.css';
import { DocumentUploadField } from './DocumentUploadField';
import { RSOAgreementCompletenessCheck } from './RSOAgreementCompletenessCheck';
import { FormState } from './types';
import { W9CompletenessCheck } from './W9CompletenessCheck';

interface DirectPaymentFieldsProps {
  form: FormState;
  isEditing: boolean;
  existingTransaction?: Transaction;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onW9CheckBlockingChange: (blocking: boolean) => void;
  onRsoCheckBlockingChange: (blocking: boolean) => void;
}

export const DirectPaymentFields = ({
  form,
  isEditing,
  existingTransaction,
  onChange,
  onW9CheckBlockingChange,
  onRsoCheckBlockingChange,
}: DirectPaymentFieldsProps) => (
  <>
    <DocumentUploadField
      doc={DOCUMENT_REQUIREMENTS_BY_KEY.contract}
      form={form}
      isEditing={isEditing}
      existingTransaction={existingTransaction}
      onChange={onChange}
    />
    <RSOAgreementCompletenessCheck
      file={form.contractFile}
      onBlockingChange={onRsoCheckBlockingChange}
    />
    <DocumentUploadField
      doc={DOCUMENT_REQUIREMENTS_BY_KEY.w9}
      form={form}
      isEditing={isEditing}
      existingTransaction={existingTransaction}
      onChange={onChange}
    />
    <W9CompletenessCheck file={form.w9File} onBlockingChange={onW9CheckBlockingChange} />

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
        <DocumentUploadField
          doc={DOCUMENT_REQUIREMENTS_BY_KEY.contractedServices}
          form={form}
          isEditing={isEditing}
          existingTransaction={existingTransaction}
          onChange={onChange}
        />
        <DocumentUploadField
          doc={DOCUMENT_REQUIREMENTS_BY_KEY.conflictOfInterest}
          form={form}
          isEditing={isEditing}
          existingTransaction={existingTransaction}
          onChange={onChange}
        />
      </>
    )}
  </>
);
