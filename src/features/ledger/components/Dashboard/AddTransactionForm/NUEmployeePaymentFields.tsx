import { DOCUMENT_REQUIREMENTS_BY_KEY } from '../../../utils/documentRequirements';
import { MAX_SPECIAL_PAY_PAGES } from './documentCheckCanvas';
import { DocumentFieldGroupProps, DocumentUploadField } from './DocumentUploadField';
import { GenericCompletenessCheck } from './GenericCompletenessCheck';
import { RSOAgreementCompletenessCheck } from './RSOAgreementCompletenessCheck';
import { W9CompletenessCheck } from './W9CompletenessCheck';

export const NUEmployeePaymentFields = ({
  onW9CheckBlockingChange,
  onRsoCheckBlockingChange,
  onSpecialPayFormCheckBlockingChange,
  ...fieldProps
}: DocumentFieldGroupProps) => {
  const { form } = fieldProps;
  return (
    <>
      <DocumentUploadField doc={DOCUMENT_REQUIREMENTS_BY_KEY.contract} {...fieldProps} />
      <RSOAgreementCompletenessCheck
        file={form.contractFile}
        onBlockingChange={onRsoCheckBlockingChange}
      />
      <DocumentUploadField doc={DOCUMENT_REQUIREMENTS_BY_KEY.w9} {...fieldProps} />
      <W9CompletenessCheck
        file={form.w9File}
        onBlockingChange={onW9CheckBlockingChange}
      />
      <DocumentUploadField
        doc={DOCUMENT_REQUIREMENTS_BY_KEY.specialPayForm}
        {...fieldProps}
      />
      <GenericCompletenessCheck
        file={form.specialPayFormFile}
        onBlockingChange={onSpecialPayFormCheckBlockingChange}
        functionName="check-special-pay-form-completeness"
        docLabel="Special Pay Form"
        maxPages={MAX_SPECIAL_PAY_PAGES}
      />
    </>
  );
};
