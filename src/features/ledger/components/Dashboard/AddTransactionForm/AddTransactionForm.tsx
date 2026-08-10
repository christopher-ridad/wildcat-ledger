import type { ChangeEvent, FormEvent } from 'react';
import { useRef, useState } from 'react';

import { useLedger } from '../../../hooks/useLedger';
import { parseReceipt } from '../../../services/parseReceipt';
import { documentPath, uploadDocument } from '../../../services/storage';
import { Transaction } from '../../../types';
import styles from './AddTransactionForm.module.css';
import { DebitCardFields } from './DebitCardFields';
import { DirectPaymentFields } from './DirectPaymentFields';
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
        ['Debit card purchase', 'Direct payment', 'Reimbursement', 'Deposit'] as string[]
      ).includes(t.type);
      return {
        title: t.title,
        date: t.date ?? todayISO(),
        amount: String(t.amount),
        type: isSupportedType ? (t.type as FormState['type']) : 'Debit card purchase',
        funding: (t.budgetLine === 'Debit Card' ? 'ASG' : t.budgetLine) as FundingOption,
        receiptFile: null,
        noReceiptAcknowledged: t.noReceiptAcknowledged ?? false,
        contractFile: null,
        w9File: null,
        isIndividualVendor: t.isIndividualVendor ?? false,
        contractedServicesFile: null,
        conflictOfInterestFile: null,
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
  const [requestedDocTypes, setRequestedDocTypes] = useState<Set<string>>(new Set());
  const [uploadTokens, setUploadTokens] = useState<Record<string, string>>({});

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
      // OCR failed — silently ignore, user can fill fields manually
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
    } else if (name === 'amount') {
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
      setForm((prev) => ({ ...prev, amount: sanitized }));
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
      // Reset deposit funding to a valid option (no ASG for Deposit)
      funding:
        newType === 'Deposit' && prev.funding === 'ASG' ? 'Operating' : prev.funding,
      // Clear files when type changes
      receiptFile: null,
      noReceiptAcknowledged: false,
      contractFile: null,
      w9File: null,
      isIndividualVendor: false,
      contractedServicesFile: null,
      conflictOfInterestFile: null,
      zelleInfo: '',
      reimbursedMemberName: '',
    }));
    setRequestedDocTypes(new Set());
    setUploadTokens({});
    setError(null);
  };

  const submitTransaction = async (
    transaction: Omit<Transaction, 'id'>,
    id?: string,
    tokens?: Record<string, string>,
  ) => {
    setSubmitting(true);
    setError(null);
    try {
      if (isEditing && existingTransaction) {
        await updateTransaction(existingTransaction.id, transaction);
      } else {
        await addTransaction(transaction, id, tokens);
      }
      setForm(initialForm);
      setPreGeneratedId(null);
      setRequestedDocTypes(new Set());
      setUploadTokens({});
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

  const handleRequestDocument = (
    docType: string,
    label: string,
    templatePath?: string,
  ) => {
    if (!form.title.trim()) {
      setError('Please enter a transaction title before requesting documents via email.');
      return;
    }
    let id = preGeneratedId;
    if (!id) {
      id = generateTransactionId();
      setPreGeneratedId(id);
    }
    const token = crypto.randomUUID();
    setUploadTokens((prev) => ({ ...prev, [docType]: token }));
    const uploadUrl = `${window.location.origin}/upload-receipt?transactionId=${id}&orgId=${encodeURIComponent(activeOrganizationId ?? '')}&fileType=${docType}&token=${token}`;
    const templateLine = templatePath
      ? `\n\nYou can download a blank ${label} here:\n${window.location.origin}${templatePath}`
      : '';
    const subject = encodeURIComponent(
      `Document Request — ${label} for "${form.title.trim()}"`,
    );
    const body = encodeURIComponent(
      `Hi,\n\nPlease upload the ${label} for "${form.title.trim()}" using this link:\n\n${uploadUrl}${templateLine}\n\nThank you!`,
    );
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`,
      '_blank',
    );
    setRequestedDocTypes((prev) => new Set(prev).add(docType));
    setError(null);
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
        requestedDocTypes,
      );
      if (validationError) {
        setError(validationError);
        return;
      }

      const amount = parseFloat(form.amount);
      const budgetLine = deriveBudgetLine(form.type, form.funding);
      const direction = deriveDirection(form.type);

      // Files must be stored under a known transaction ID, so generate one up
      // front if a document-request-by-email hasn't already pre-generated it.
      const txnId = preGeneratedId ?? generateTransactionId();
      if (!preGeneratedId) setPreGeneratedId(txnId);

      // Upload any new files to Storage and get their object paths.
      // If editing and no new file was selected, preserve the existing path.
      const receiptFileUrl = form.receiptFile
        ? await uploadFile(form.receiptFile, 'receipt', txnId)
        : existingTransaction?.receiptFileUrl;
      const contractFileUrl = form.contractFile
        ? await uploadFile(form.contractFile, 'contract', txnId)
        : existingTransaction?.contractFileUrl;
      const w9FileUrl = form.w9File
        ? await uploadFile(form.w9File, 'w9', txnId)
        : existingTransaction?.w9FileUrl;
      const contractedServicesFileUrl = form.contractedServicesFile
        ? await uploadFile(form.contractedServicesFile, 'contractedServices', txnId)
        : existingTransaction?.contractedServicesFileUrl;
      const conflictOfInterestFileUrl = form.conflictOfInterestFile
        ? await uploadFile(form.conflictOfInterestFile, 'conflictOfInterest', txnId)
        : existingTransaction?.conflictOfInterestFileUrl;

      const newTransaction: Omit<Transaction, 'id'> = {
        title: form.title.trim(),
        date: form.date || todayISO(),
        amount,
        direction,
        type: form.type,
        funding: form.type !== 'Debit card purchase' ? form.funding : undefined,
        budgetLine,
        notes: form.notes.trim(),
        zelleInfo: form.type === 'Reimbursement' ? form.zelleInfo.trim() : undefined,
        reimbursedMemberName:
          form.type === 'Reimbursement' ? form.reimbursedMemberName.trim() : undefined,
        isIndividualVendor:
          form.type === 'Direct payment' ? form.isIndividualVendor : undefined,
        noReceiptAcknowledged:
          form.type === 'Debit card purchase' ? form.noReceiptAcknowledged : undefined,
        receiptFileUrl,
        contractFileUrl,
        w9FileUrl,
        contractedServicesFileUrl,
        conflictOfInterestFileUrl,
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

      await submitTransaction(newTransaction, txnId, uploadTokens);
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
    form.type === 'Direct payment' ||
    form.type === 'Reimbursement' ||
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
      {/* ── Always-visible fields ── */}
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
          <option value="Debit card purchase">Debit Card Purchase</option>
          <option value="Direct payment">Direct Payment</option>
          <option value="Reimbursement">Reimbursement</option>
          <option value="Deposit">Deposit</option>
        </select>
      </div>

      {/* ── Conditional expanded section ── */}
      <div className={styles['wl-form-section']}>
        {/* Funding source (all types except Debit card purchase) */}
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

        {form.type === 'Debit card purchase' && (
          <DebitCardFields
            form={form}
            isEditing={isEditing}
            existingTransaction={existingTransaction}
            scanning={scanning}
            requestedDocTypes={requestedDocTypes}
            onReceiptChange={handleReceiptChange}
            onChange={handleChange}
            onRequestDocument={handleRequestDocument}
          />
        )}

        {form.type === 'Direct payment' && (
          <DirectPaymentFields
            form={form}
            isEditing={isEditing}
            existingTransaction={existingTransaction}
            requestedDocTypes={requestedDocTypes}
            onChange={handleChange}
            onRequestDocument={handleRequestDocument}
          />
        )}

        {form.type === 'Reimbursement' && (
          <ReimbursementFields
            form={form}
            isEditing={isEditing}
            existingTransaction={existingTransaction}
            scanning={scanning}
            requestedDocTypes={requestedDocTypes}
            onReceiptChange={handleReceiptChange}
            onChange={handleChange}
            onRequestDocument={handleRequestDocument}
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
                submitTransaction(
                  pendingTransaction.transaction,
                  pendingTransaction.id,
                  uploadTokens,
                )
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
