import type { ChangeEvent, FormEvent } from 'react';
import { useRef, useState } from 'react';

import { getErrorMessage } from '../../../../../utils/errors';
import { useLedger } from '../../../hooks/useLedger';
import { parseReceipt } from '../../../services/parseReceipt';
import { documentPath, uploadDocument } from '../../../services/storage';
import { Transaction } from '../../../types';
import { DOCUMENT_REQUIREMENTS_BY_KEY } from '../../../utils/documentRequirements';
import {
  AddTransactionFormProps,
  FormState,
  FundingOption,
  initialForm,
  todayISO,
} from './types';
import { deriveBudgetLine, deriveDirection, validateTransactionForm } from './validation';

const buildInitialForm = (existingTransaction?: Transaction): FormState => {
  if (!existingTransaction) return initialForm;

  const t = existingTransaction;
  const isSupportedType = (
    [
      'Debit Card',
      'Payment Request',
      'Non-Officer Reimbursement',
      'Payment to NU Employee',
      'Deposit',
    ] as string[]
  ).includes(t.type);
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
    contractAcknowledgedMissing: t.contractAcknowledgedMissing ?? false,
    w9File: null,
    w9AcknowledgedMissing: t.w9AcknowledgedMissing ?? false,
    isIndividualVendor: t.isIndividualVendor ?? false,
    contractedServicesFile: null,
    contractedServicesAcknowledgedMissing:
      t.contractedServicesAcknowledgedMissing ?? false,
    conflictOfInterestFile: null,
    conflictOfInterestAcknowledgedMissing:
      t.conflictOfInterestAcknowledgedMissing ?? false,
    specialPayFormFile: null,
    specialPayFormAcknowledgedMissing: t.specialPayFormAcknowledgedMissing ?? false,
    zelleInfo: t.zelleInfo ?? '',
    reimbursedMemberName: t.reimbursedMemberName ?? '',
    notes: t.notes ?? '',
  };
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

  const handleTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as FormState['type'];
    setForm((prev) => ({
      ...prev,
      type: newType,
      // Deposits can't be funded from ASG -- see docs/BUSINESS_RULES.md#transaction-types--their-documents.
      funding:
        newType === 'Deposit' && prev.funding === 'ASG' ? 'Operating' : prev.funding,
      receiptFile: null,
      noReceiptAcknowledged: false,
      taxExemptFormSubmitted: false,
      taxAmount: '',
      contractFile: null,
      contractAcknowledgedMissing: false,
      w9File: null,
      w9AcknowledgedMissing: false,
      isIndividualVendor: false,
      contractedServicesFile: null,
      contractedServicesAcknowledgedMissing: false,
      conflictOfInterestFile: null,
      conflictOfInterestAcknowledgedMissing: false,
      specialPayFormFile: null,
      specialPayFormAcknowledgedMissing: false,
      zelleInfo: '',
      reimbursedMemberName: '',
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

  const uploadFile = async (
    file: File,
    prefix: string,
    transactionId: string,
  ): Promise<string> => {
    const path = documentPath(activeOrganizationId ?? '', transactionId, file, prefix);
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

      // Upload any new files to Storage and get their object paths.
      // If editing and no new file was selected, preserve the existing path.
      // Receipt is handled separately since it also drives OCR (see
      // handleReceiptChange); every other document type follows the same
      // upload-or-keep-existing shape, so loop over the shared requirement
      // list instead of repeating that shape once per document.
      const receiptFileUrl = form.receiptFile
        ? await uploadFile(form.receiptFile, 'receipt', txnId)
        : existingTransaction?.receiptFileUrl;

      const uploadedFileUrls: Record<string, string | undefined> = {};
      for (const doc of Object.values(DOCUMENT_REQUIREMENTS_BY_KEY)) {
        if (doc.key === 'receipt') continue;
        const file = form[doc.formField] as File | null;
        uploadedFileUrls[doc.field] = file
          ? await uploadFile(file, doc.key, txnId)
          : (existingTransaction?.[doc.field] as string | undefined);
      }
      const {
        contractFileUrl,
        w9FileUrl,
        contractedServicesFileUrl,
        conflictOfInterestFileUrl,
        specialPayFormUrl,
      } = uploadedFileUrls;

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
          form.type === 'Payment Request' ? form.isIndividualVendor : undefined,
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
        contractAcknowledgedMissing:
          form.type === 'Payment Request' || form.type === 'Payment to NU Employee'
            ? form.contractAcknowledgedMissing
            : undefined,
        w9AcknowledgedMissing:
          form.type === 'Payment Request' || form.type === 'Payment to NU Employee'
            ? form.w9AcknowledgedMissing
            : undefined,
        contractedServicesAcknowledgedMissing:
          form.type === 'Payment Request' && form.isIndividualVendor
            ? form.contractedServicesAcknowledgedMissing
            : undefined,
        conflictOfInterestAcknowledgedMissing:
          form.type === 'Payment Request' && form.isIndividualVendor
            ? form.conflictOfInterestAcknowledgedMissing
            : undefined,
        specialPayFormAcknowledgedMissing:
          form.type === 'Payment to NU Employee'
            ? form.specialPayFormAcknowledgedMissing
            : undefined,
        receiptFileUrl,
        contractFileUrl,
        w9FileUrl,
        contractedServicesFileUrl,
        conflictOfInterestFileUrl,
        specialPayFormUrl,
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
    handleReceiptChange,
    handleChange,
    handleTypeChange,
    handleSubmit,
    submitTransaction,
    cancelOverdraft,
  };
}
