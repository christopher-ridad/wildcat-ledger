import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import { DOCUMENT_REQUIREMENTS_BY_KEY } from '../../../utils/documentRequirements';
import { DocumentUploadField } from './DocumentUploadField';
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
    <DocumentUploadField
      doc={DOCUMENT_REQUIREMENTS_BY_KEY.contract}
      form={form}
      isEditing={isEditing}
      existingTransaction={existingTransaction}
      onChange={onChange}
    />
    <DocumentUploadField
      doc={DOCUMENT_REQUIREMENTS_BY_KEY.w9}
      form={form}
      isEditing={isEditing}
      existingTransaction={existingTransaction}
      onChange={onChange}
    />
    <DocumentUploadField
      doc={DOCUMENT_REQUIREMENTS_BY_KEY.specialPayForm}
      form={form}
      isEditing={isEditing}
      existingTransaction={existingTransaction}
      onChange={onChange}
    />
  </>
);
