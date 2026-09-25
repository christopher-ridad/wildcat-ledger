import type { ChangeEvent } from 'react';

import { Transaction } from '../../../types';
import { EXISTING_VENDOR_LIST_URL } from '../../../utils/constants';
import {
  DOCUMENT_REQUIREMENTS_BY_KEY,
  DocumentRequirement,
} from '../../../utils/documentRequirements';
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
  onNotStoredChange: (doc: DocumentRequirement, notStored: boolean) => void;
}

export const DirectPaymentFields = ({
  form,
  isEditing,
  existingTransaction,
  onChange,
  onW9CheckBlockingChange,
  onRsoCheckBlockingChange,
  onNotStoredChange,
}: DirectPaymentFieldsProps) => (
  <>
    <div>
      <label className={styles['wl-form-checkbox']}>
        <input
          type="checkbox"
          name="isExistingVendor"
          checked={form.isExistingVendor}
          onChange={onChange}
        />
        <span>Is this vendor on SOFO&apos;s Existing Vendor List?</span>
      </label>
      <p className={styles['wl-form-hint']}>
        Check the{' '}
        <a href={EXISTING_VENDOR_LIST_URL} target="_blank" rel="noreferrer">
          Existing Vendor List
        </a>
        . If the vendor is on it, SOFO already has their W-9, so only the RSO Agreement is
        needed.
      </p>
    </div>

    {form.isExistingVendor && (
      <div className="wl-form-group">
        <label className="wl-form-label" htmlFor="existingVendorNumber">
          Vendor Number <span className={styles['wl-form-required']}>*</span>
        </label>
        <input
          id="existingVendorNumber"
          name="existingVendorNumber"
          type="text"
          className="wl-form-input"
          value={form.existingVendorNumber}
          onChange={onChange}
        />
        <p className={styles['wl-form-hint']}>
          The number listed next to the vendor. This goes on the SOFO Transaction Request
          Form in place of their W-9.
        </p>
      </div>
    )}

    <DocumentUploadField
      doc={DOCUMENT_REQUIREMENTS_BY_KEY.contract}
      hasCompletenessCheck
      form={form}
      isEditing={isEditing}
      existingTransaction={existingTransaction}
      onChange={onChange}
      onNotStoredChange={onNotStoredChange}
    />
    <RSOAgreementCompletenessCheck
      file={form.contractFile}
      onBlockingChange={onRsoCheckBlockingChange}
    />
    {!form.isExistingVendor && (
      <>
        <DocumentUploadField
          doc={DOCUMENT_REQUIREMENTS_BY_KEY.w9}
          hasCompletenessCheck
          form={form}
          isEditing={isEditing}
          existingTransaction={existingTransaction}
          onChange={onChange}
          onNotStoredChange={onNotStoredChange}
        />
        <W9CompletenessCheck
          file={form.w9File}
          onBlockingChange={onW9CheckBlockingChange}
        />

        <label className={styles['wl-form-checkbox']}>
          <input
            type="checkbox"
            name="isIndividualVendor"
            checked={form.isIndividualVendor}
            onChange={onChange}
          />
          <span>Is this an individual vendor?</span>
        </label>
      </>
    )}

    {!form.isExistingVendor && form.isIndividualVendor && (
      <>
        <DocumentUploadField
          doc={DOCUMENT_REQUIREMENTS_BY_KEY.contractedServices}
          form={form}
          isEditing={isEditing}
          existingTransaction={existingTransaction}
          onChange={onChange}
          onNotStoredChange={onNotStoredChange}
        />
        <DocumentUploadField
          doc={DOCUMENT_REQUIREMENTS_BY_KEY.conflictOfInterest}
          form={form}
          isEditing={isEditing}
          existingTransaction={existingTransaction}
          onChange={onChange}
          onNotStoredChange={onNotStoredChange}
        />
      </>
    )}
  </>
);
