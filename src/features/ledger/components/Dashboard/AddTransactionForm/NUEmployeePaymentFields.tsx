import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import { DOCUMENT_REQUIREMENTS_BY_KEY } from '../../../utils/documentRequirements';
import { DocumentUploadField } from './DocumentUploadField';
import { RSOAgreementCompletenessCheck } from './RSOAgreementCompletenessCheck';
import { FormState } from './types';
import { W9CompletenessCheck } from './W9CompletenessCheck';

interface NUEmployeePaymentFieldsProps {
  form: FormState;
  isEditing: boolean;
  existingTransaction?: Transaction;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onW9CheckBlockingChange: (blocking: boolean) => void;
  onRsoCheckBlockingChange: (blocking: boolean) => void;
}

export const NUEmployeePaymentFields = ({
  form,
  isEditing,
  existingTransaction,
  onChange,
  onW9CheckBlockingChange,
  onRsoCheckBlockingChange,
}: NUEmployeePaymentFieldsProps) => (
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
    <DocumentUploadField
      doc={DOCUMENT_REQUIREMENTS_BY_KEY.specialPayForm}
      form={form}
      isEditing={isEditing}
      existingTransaction={existingTransaction}
      onChange={onChange}
    />
  </>
);
