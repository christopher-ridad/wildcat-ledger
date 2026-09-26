import { EXISTING_VENDOR_LIST_URL } from '../../../utils/constants';
import { DOCUMENT_REQUIREMENTS_BY_KEY } from '../../../utils/documentRequirements';
import styles from './AddTransactionForm.module.css';
import {
  MAX_CONFLICT_OF_INTEREST_PAGES,
  MAX_CONTRACTED_SERVICES_PAGES,
} from './documentCheckCanvas';
import { DocumentFieldGroupProps, DocumentUploadField } from './DocumentUploadField';
import { GenericCompletenessCheck } from './GenericCompletenessCheck';
import { RSOAgreementCompletenessCheck } from './RSOAgreementCompletenessCheck';
import { W9CompletenessCheck } from './W9CompletenessCheck';

interface DirectPaymentFieldsProps extends DocumentFieldGroupProps {
  onExistingVendorChange: (isExistingVendor: boolean) => void;
}

export const DirectPaymentFields = ({
  onW9CheckBlockingChange,
  onRsoCheckBlockingChange,
  onContractedServicesCheckBlockingChange,
  onConflictOfInterestCheckBlockingChange,
  onExistingVendorChange,
  ...fieldProps
}: DirectPaymentFieldsProps) => {
  const { form, onChange } = fieldProps;
  return (
    <>
      <div>
        <label className={styles['wl-form-checkbox']}>
          <input
            type="checkbox"
            name="isExistingVendor"
            checked={form.isExistingVendor}
            onChange={(e) => onExistingVendorChange(e.target.checked)}
          />
          <span>Is this vendor on SOFO&apos;s Existing Vendor List?</span>
        </label>
        <p className={styles['wl-form-hint']}>
          Check the{' '}
          <a href={EXISTING_VENDOR_LIST_URL} target="_blank" rel="noreferrer">
            Existing Vendor List
          </a>
          . If the vendor is on it, SOFO already has their W-9, so only the RSO Agreement
          is needed.
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
            The number listed next to the vendor. This goes on the SOFO Transaction
            Request Form in place of their W-9.
          </p>
        </div>
      )}

      <DocumentUploadField doc={DOCUMENT_REQUIREMENTS_BY_KEY.contract} {...fieldProps} />
      <RSOAgreementCompletenessCheck
        file={form.contractFile}
        onBlockingChange={onRsoCheckBlockingChange}
      />
      {!form.isExistingVendor && (
        <>
          <DocumentUploadField doc={DOCUMENT_REQUIREMENTS_BY_KEY.w9} {...fieldProps} />
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

          {form.isIndividualVendor && (
            <>
              <DocumentUploadField
                doc={DOCUMENT_REQUIREMENTS_BY_KEY.contractedServices}
                {...fieldProps}
              />
              <GenericCompletenessCheck
                file={form.contractedServicesFile}
                onBlockingChange={onContractedServicesCheckBlockingChange}
                functionName="check-contracted-services-completeness"
                docLabel="Contracted Services Form"
                maxPages={MAX_CONTRACTED_SERVICES_PAGES}
              />
              <DocumentUploadField
                doc={DOCUMENT_REQUIREMENTS_BY_KEY.conflictOfInterest}
                {...fieldProps}
              />
              <GenericCompletenessCheck
                file={form.conflictOfInterestFile}
                onBlockingChange={onConflictOfInterestCheckBlockingChange}
                functionName="check-conflict-of-interest-completeness"
                docLabel="Conflict of Interest Form"
                maxPages={MAX_CONFLICT_OF_INTEREST_PAGES}
              />
            </>
          )}
        </>
      )}
    </>
  );
};
