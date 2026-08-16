import type { ChangeEvent, FormEvent } from 'react';
import { useRef, useState } from 'react';

import { useLedger } from '../../../hooks/useLedger';
import { parseReceipt } from '../../../services/parseReceipt';
import { documentPath, uploadDocument } from '../../../services/storage';
import { Transaction } from '../../../types';
import { DOCUMENT_REQUIREMENTS_BY_KEY } from '../../../utils/documentRequirements';
import styles from './AddTransactionForm.module.css';
import { DebitCardFields } from './DebitCardFields';
import { DirectPaymentFields } from './DirectPaymentFields';
import { NUEmployeePaymentFields } from './NUEmployeePaymentFields';
import { ReimbursementFields } from './ReimbursementFields';
import {
  AddTransactionFormProps,
  FormState,
  FundingOption,
  initialForm,
  todayISO,
} from './types';
import { deriveBudgetLine, deriveDirection, validateTransactionForm } from './validation';

export const AddTransactionForm = ({
  onSuccess,
  existingTransaction,
}: AddTransactionFormProps) => {
  const {
    addTransaction,
    updateTransaction,
    budgetLineSummaries,
    activeOrganizationId,
    generateTransactionId,
  } = useLedger();
  const isEditing = !!existingTransaction;

  const [form, setForm] = useState<FormState>(() => {
    if (existingTransaction) {
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
    }
    return initialForm;
  });

  const [submitting, setSubmitting] = useState(false);
  const submitGuard = useRef(false);
  const [scanning, setScanning] = useState(false);
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
      // Non-fatal -- user can still fill the fields in manually.
      console.warn('OCR failed:', err);
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
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save transaction. Please try again.',
      );
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
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save transaction. Please try again.',
      );
    } finally {
      submitGuard.current = false;
    }
  };

  const showFunding =
    form.type === 'Payment Request' ||
    form.type === 'Non-Officer Reimbursement' ||
    form.type === 'Payment to NU Employee' ||
    form.type === 'Deposit';

  const fundingOptions: { value: FundingOption; label: string }[] =
    form.type === 'Deposit'
      ? [
          { value: 'Operating', label: 'Operations' },
          { value: 'Gifts', label: 'Gifts' },
        ]
      : [
          { value: 'ASG', label: 'ASG' },
          { value: 'Operating', label: 'Operations' },
          { value: 'Gifts', label: 'Gifts' },
        ];

  return (
    <form onSubmit={handleSubmit} className={styles['wl-form']} noValidate>
      <div className="wl-form-group">
        <label className="wl-form-label" htmlFor="title">
          Title <span className={styles['wl-form-required']}>*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className="wl-form-input"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g. DJ equipment rental"
        />
      </div>

      <div className="wl-form-group">
        <label className="wl-form-label" htmlFor="date">
          Date <span className={styles['wl-form-required']}>*</span>
        </label>
        <input
          id="date"
          name="date"
          type="date"
          className="wl-form-input"
          value={form.date}
          max={todayISO()}
          onChange={handleChange}
        />
      </div>

      <div className="wl-form-group">
        <label className="wl-form-label" htmlFor="amount">
          Amount ($) <span className={styles['wl-form-required']}>*</span>
        </label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          className="wl-form-input"
          value={form.amount}
          onChange={handleChange}
          placeholder="0.00"
        />
      </div>

      <div className="wl-form-group">
        <label className="wl-form-label" htmlFor="type">
          Transaction Type <span className={styles['wl-form-required']}>*</span>
        </label>
        <select
          id="type"
          name="type"
          className={styles['wl-form-select']}
          value={form.type}
          onChange={handleTypeChange}
        >
          <option value="Debit Card">Debit Card</option>
          <option value="Payment Request">Payment Request</option>
          <option value="Non-Officer Reimbursement">Non-Officer Reimbursement</option>
          <option value="Payment to NU Employee">Payment to NU Employee</option>
          <option value="Deposit">Deposit</option>
        </select>
      </div>

      <div className={styles['wl-form-section']}>
        {showFunding && (
          <div className="wl-form-group">
            <label className="wl-form-label" htmlFor="funding">
              Funding <span className={styles['wl-form-required']}>*</span>
            </label>
            <select
              id="funding"
              name="funding"
              className={styles['wl-form-select']}
              value={form.funding}
              onChange={handleChange}
            >
              {fundingOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {form.type === 'Debit Card' && (
          <DebitCardFields
            form={form}
            isEditing={isEditing}
            existingTransaction={existingTransaction}
            scanning={scanning}
            onReceiptChange={handleReceiptChange}
            onChange={handleChange}
          />
        )}

        {form.type === 'Payment Request' && (
          <DirectPaymentFields
            form={form}
            isEditing={isEditing}
            existingTransaction={existingTransaction}
            onChange={handleChange}
          />
        )}

        {form.type === 'Payment to NU Employee' && (
          <NUEmployeePaymentFields
            form={form}
            isEditing={isEditing}
            existingTransaction={existingTransaction}
            onChange={handleChange}
          />
        )}

        {form.type === 'Non-Officer Reimbursement' && (
          <ReimbursementFields
            form={form}
            isEditing={isEditing}
            existingTransaction={existingTransaction}
            scanning={scanning}
            onReceiptChange={handleReceiptChange}
            onChange={handleChange}
          />
        )}
      </div>

      <div className="wl-form-group">
        <label className="wl-form-label" htmlFor="notes">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          className={styles['wl-form-textarea']}
          value={form.notes}
          onChange={handleChange}
          rows={2}
          placeholder="Any additional context..."
        />
      </div>

      {error && (
        <div className="wl-form-error" role="alert">
          {error}
        </div>
      )}

      {overdraftWarning && pendingTransaction && (
        <div className={styles['wl-overdraft-warning']} role="alert">
          <p>{overdraftWarning}</p>
          <div className="wl-overdraft-actions">
            <button
              type="button"
              className="wl-btn-warning"
              disabled={submitting}
              onClick={() =>
                submitTransaction(pendingTransaction.transaction, pendingTransaction.id)
              }
            >
              {submitting ? 'Saving…' : 'Proceed anyway'}
            </button>
            <button
              type="button"
              className="wl-btn-cancel"
              disabled={submitting}
              onClick={() => {
                setOverdraftWarning(null);
                setPendingTransaction(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!overdraftWarning && (
        <button type="submit" className="wl-btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Transaction'}
        </button>
      )}
    </form>
  );
};
