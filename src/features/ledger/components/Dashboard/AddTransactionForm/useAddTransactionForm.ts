import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useRef, useState } from 'react';

import { getErrorMessage } from '../../../../../utils/errors';
import { useLedger } from '../../../hooks/useLedger';
import { parseReceipt } from '../../../services/parseReceipt';
import { documentPath, uploadDocument } from '../../../services/storage';
import { Transaction } from '../../../types';
import {
  DOCUMENT_REQUIREMENTS_BY_KEY,
  DocumentRequirement,
  getRequiredDocuments,
} from '../../../utils/documentRequirements';
import {
  AddTransactionFormProps,
  FormState,
  FundingOption,
  initialForm,
  SUPPORTED_TYPES,
  todayISO,
} from './types';
import { deriveBudgetLine, deriveDirection, validateTransactionForm } from './validation';

const buildInitialForm = (existingTransaction?: Transaction): FormState => {
  if (!existingTransaction) return initialForm;

  const t = existingTransaction;
  const isSupportedType = (SUPPORTED_TYPES as readonly string[]).includes(t.type);
  return {
    title: t.title,
    date: t.date ?? todayISO(),
    amount: String(t.amount),
    type: isSupportedType ? (t.type as FormState['type']) : 'Debit Card',
    funding: (t.budgetLine === 'Debit Card' ? 'ASG' : t.budgetLine) as FundingOption,
    receiptFile: null,
    noReceiptAcknowledged: t.noReceiptAcknowledged ?? false,
    taxExemptFormSubmitted: t.taxExemptFormSubmitted ?? false,
    taxAmount: t.taxAmount != null ? String(t.taxAmount) : '',
    contractFile: null,
    contractNotStored: t.contractNotStored ?? false,
    w9File: null,
    w9NotStored: t.w9NotStored ?? false,
    isIndividualVendor: t.isIndividualVendor ?? false,
    isExistingVendor: t.isExistingVendor ?? false,
    existingVendorNumber: t.existingVendorNumber ?? '',
    contractedServicesFile: null,
    contractedServicesNotStored: t.contractedServicesNotStored ?? false,
    conflictOfInterestFile: null,
    conflictOfInterestNotStored: t.conflictOfInterestNotStored ?? false,
    specialPayFormFile: null,
    specialPayFormNotStored: t.specialPayFormNotStored ?? false,
    zelleInfo: t.zelleInfo ?? '',
    reimbursedMemberName: t.reimbursedMemberName ?? '',
    notes: t.notes ?? '',
  };
};

// SOFO already has an existing vendor's W-9 (and individual-vendor forms),
// so ticking "existing vendor" drops anything entered for them.
const NEW_VENDOR_ONLY_FIELDS_CLEARED: Partial<FormState> = {
  w9File: null,
  w9NotStored: false,
  isIndividualVendor: false,
  contractedServicesFile: null,
  contractedServicesNotStored: false,
  conflictOfInterestFile: null,
  conflictOfInterestNotStored: false,
};

// Form state, OCR-triggered receipt scanning, document uploads, and
// overdraft-warning submission for AddTransactionForm -- split out so the
// component itself can stay pure JSX composition.
export function useAddTransactionForm({
  onSuccess,
  existingTransaction,
}: AddTransactionFormProps) {
  const {
    addTransaction,
    updateTransaction,
    budgetLineSummaries,
    activeOrganizationId,
    generateTransactionId,
  } = useLedger();
  const isEditing = !!existingTransaction;

  const [form, setForm] = useState<FormState>(() =>
    buildInitialForm(existingTransaction),
  );
  const [submitting, setSubmitting] = useState(false);
  const submitGuard = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overdraftWarning, setOverdraftWarning] = useState<string | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<{
    transaction: Omit<Transaction, 'id'>;
    id?: string;
  } | null>(null);
  const [preGeneratedId, setPreGeneratedId] = useState<string | null>(null);
  // Set by W9CompletenessCheck/RSOAgreementCompletenessCheck/
  // GenericCompletenessCheck while any of them has an unacknowledged flag.
  // Advisory, not a hard requirement everywhere: this only ever gates the
  // Save button, never the underlying validation. Kept as one object
  // (rather than a separate useState per check) so a blocking Save reason
  // is always "is anything in here true", not a growing list of ORs at the
  // call site.
  const [documentChecksBlocking, setDocumentChecksBlocking] = useState<
    Record<
      'w9' | 'rso' | 'contractedServices' | 'conflictOfInterest' | 'specialPayForm',
      boolean
    >
  >({
    w9: false,
    rso: false,
    contractedServices: false,
    conflictOfInterest: false,
    specialPayForm: false,
  });
  const documentCheckBlocking = Object.values(documentChecksBlocking).some(Boolean);
  const setW9CheckBlocking = useCallback(
    (blocking: boolean) =>
      setDocumentChecksBlocking((prev) => ({ ...prev, w9: blocking })),
    [],
  );
  const setRsoCheckBlocking = useCallback(
    (blocking: boolean) =>
      setDocumentChecksBlocking((prev) => ({ ...prev, rso: blocking })),
    [],
  );
  const setContractedServicesCheckBlocking = useCallback(
    (blocking: boolean) =>
      setDocumentChecksBlocking((prev) => ({ ...prev, contractedServices: blocking })),
    [],
  );
  const setConflictOfInterestCheckBlocking = useCallback(
    (blocking: boolean) =>
      setDocumentChecksBlocking((prev) => ({ ...prev, conflictOfInterest: blocking })),
    [],
  );
  const setSpecialPayFormCheckBlocking = useCallback(
    (blocking: boolean) =>
      setDocumentChecksBlocking((prev) => ({ ...prev, specialPayForm: blocking })),
    [],
  );

  const handleReceiptChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setForm((prev) => ({ ...prev, receiptFile: file }));
    setError(null);
    setOcrError(null);
    if (!file) return;

    try {
      setScanning(true);
      const { title, amount } = await parseReceipt(file);
      setForm((prev) => ({
        ...prev,
        title: title || prev.title,
        amount: amount || prev.amount,
      }));
    } catch (err) {
      // Non-fatal -- the receipt itself still uploads fine and the user can
      // still fill the fields in manually, so this only surfaces as a small
      // inline notice rather than blocking the form (see getErrorMessage's
      // fallback for why err.message can't be trusted blindly).
      setOcrError(getErrorMessage(err, "Couldn't auto-fill from this receipt"));
    } finally {
      setScanning(false);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const target = e.target;
    const { name } = target;
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: target.checked }));
    } else if (target instanceof HTMLInputElement && target.type === 'file') {
      setForm((prev) => ({ ...prev, [name]: target.files?.[0] ?? null }));
    } else if (name === 'amount' || name === 'taxAmount') {
      // Strip everything that isn't a digit or decimal point, then enforce
      // at most one decimal point with at most 2 digits after it.
      const raw = target.value.replace(/[^\d.]/g, '');
      const parts = raw.split('.');
      const sanitized =
        parts.length > 2
          ? parts[0] + '.' + parts.slice(1).join('')
          : parts.length === 2
            ? parts[0] + '.' + parts[1].slice(0, 2)
            : parts[0];
      setForm((prev) => ({ ...prev, [name]: sanitized }));
    } else {
      setForm((prev) => ({ ...prev, [name]: target.value }));
    }
    setError(null);
  };

  const handleExistingVendorChange = (isExistingVendor: boolean) => {
    setForm((prev) => ({
      ...prev,
      ...(isExistingVendor
        ? NEW_VENDOR_ONLY_FIELDS_CLEARED
        : { existingVendorNumber: '' }),
      isExistingVendor,
    }));
    // The W-9 check unmounts along with its field, and only resets its
    // blocking flag when its file changes, so release it here.
    if (isExistingVendor) setW9CheckBlocking(false);
  };

  // Switching between storing a copy and not clears any picked file, so a
  // file chosen only to run the completeness check can't end up uploaded.
  const setDocumentNotStored = (doc: DocumentRequirement, notStored: boolean) => {
    const field = doc.notStoredField;
    if (!field) return;
    setForm((prev) => ({ ...prev, [doc.formField]: null, [field]: notStored }));
    setError(null);
  };

  // Everything type-specific resets; only the fields every type shares carry
  // over.
  const handleTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as FormState['type'];
    setForm((prev) => ({
      ...initialForm,
      type: newType,
      title: prev.title,
      date: prev.date,
      amount: prev.amount,
      funding: prev.funding,
      notes: prev.notes,
    }));
    setError(null);
    setOcrError(null);
  };

  const submitTransaction = async (transaction: Omit<Transaction, 'id'>, id?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      if (isEditing && existingTransaction) {
        await updateTransaction(existingTransaction.id, transaction);
      } else {
        await addTransaction(transaction, id);
      }
      setForm(initialForm);
      setPreGeneratedId(null);
      setPendingTransaction(null);
      setOverdraftWarning(null);
      setOcrError(null);
      onSuccess?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save transaction. Please try again.'));
    } finally {
      setSubmitting(false);
      submitGuard.current = false;
    }
  };

  // Uploads each newly picked document and returns the transaction's
  // document fields: a stored path per document (a new upload, or the
  // existing one when editing), plus -- for required documents only --
  // whether it was marked not stored.
  const uploadDocuments = async (transactionId: string) => {
    const requiredDocKeys = new Set(getRequiredDocuments(form).map((doc) => doc.key));
    const documentFields: Record<string, string | boolean | undefined> = {};
    for (const doc of Object.values(DOCUMENT_REQUIREMENTS_BY_KEY)) {
      const notStored = !!doc.notStoredField && form[doc.notStoredField];
      // A file picked for a document marked not stored was only there for
      // the completeness check -- never upload it.
      const file = notStored ? null : (form[doc.formField] as File | null);
      documentFields[doc.field] = file
        ? await uploadFile(file, doc.key, transactionId)
        : (existingTransaction?.[doc.field] as string | undefined);
      if (doc.notStoredField) {
        documentFields[doc.notStoredField] = requiredDocKeys.has(doc.key)
          ? notStored
          : undefined;
      }
    }
    return documentFields;
  };

  const uploadFile = async (file: File, docKey: string, transactionId: string) => {
    const path = documentPath(activeOrganizationId ?? '', transactionId, file, docKey);
    await uploadDocument(path, file);
    return path;
  };

  const cancelOverdraft = () => {
    setOverdraftWarning(null);
    setPendingTransaction(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitGuard.current) return;
    submitGuard.current = true;
    try {
      const validationError = validateTransactionForm(
        form,
        isEditing,
        existingTransaction,
      );
      if (validationError) {
        setError(validationError);
        return;
      }

      const amount = parseFloat(form.amount);
      const budgetLine = deriveBudgetLine(form.type, form.funding);
      const direction = deriveDirection(form.type);

      // Files must be stored under a known transaction ID, so generate one
      // up front.
      const txnId = preGeneratedId ?? generateTransactionId();
      if (!preGeneratedId) setPreGeneratedId(txnId);

      const documentFields = await uploadDocuments(txnId);

      const isPaymentRequest = form.type === 'Payment Request';
      const newTransaction: Omit<Transaction, 'id'> = {
        title: form.title.trim(),
        date: form.date || todayISO(),
        amount,
        direction,
        type: form.type,
        funding: form.type !== 'Debit Card' ? form.funding : undefined,
        budgetLine,
        notes: form.notes.trim(),
        zelleInfo:
          form.type === 'Non-Officer Reimbursement' ? form.zelleInfo.trim() : undefined,
        reimbursedMemberName:
          form.type === 'Non-Officer Reimbursement'
            ? form.reimbursedMemberName.trim()
            : undefined,
        isIndividualVendor:
          isPaymentRequest && !form.isExistingVendor
            ? form.isIndividualVendor
            : undefined,
        isExistingVendor: isPaymentRequest ? form.isExistingVendor : undefined,
        existingVendorNumber:
          isPaymentRequest && form.isExistingVendor
            ? form.existingVendorNumber.trim()
            : undefined,
        noReceiptAcknowledged:
          form.type === 'Debit Card' || form.type === 'Non-Officer Reimbursement'
            ? form.noReceiptAcknowledged
            : undefined,
        taxExemptFormSubmitted:
          form.type === 'Debit Card' ? form.taxExemptFormSubmitted : undefined,
        taxAmount:
          form.type === 'Debit Card' && !form.taxExemptFormSubmitted && form.taxAmount
            ? parseFloat(form.taxAmount)
            : undefined,
        ...documentFields,
      };

      if (direction === 'Outflow') {
        const lineSummary = budgetLineSummaries.find((s) => s.line === budgetLine);
        if (lineSummary && amount > lineSummary.balance) {
          setPendingTransaction({
            transaction: newTransaction,
            id: txnId,
          });
          setOverdraftWarning(
            `This outflow of $${amount.toFixed(2)} exceeds the current ${budgetLine} balance of $${lineSummary.balance.toFixed(2)}. The account will go negative. Do you want to proceed anyway?`,
          );
          return;
        }
      }

      await submitTransaction(newTransaction, txnId);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save transaction. Please try again.'));
    } finally {
      submitGuard.current = false;
    }
  };

  return {
    form,
    isEditing,
    submitting,
    scanning,
    ocrError,
    error,
    overdraftWarning,
    pendingTransaction,
    documentCheckBlocking,
    setW9CheckBlocking,
    setRsoCheckBlocking,
    setContractedServicesCheckBlocking,
    setConflictOfInterestCheckBlocking,
    setSpecialPayFormCheckBlocking,
    handleReceiptChange,
    handleChange,
    handleTypeChange,
    handleExistingVendorChange,
    setDocumentNotStored,
    handleSubmit,
    submitTransaction,
    cancelOverdraft,
  };
}
