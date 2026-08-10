import { useEffect, useRef, useState } from 'react';

import { useLedger } from '../../../hooks/useLedger';
import { downloadReceiptsZip } from '../../../services/downloadReceiptsZip';
import { Transaction } from '../../../types';
import { formatCurrency } from '../../../utils/calculations';
import { POLICY_EXEMPTION_FORM_URL } from '../../../utils/constants';
import styles from './ReconciliationModal.module.css';

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

type Step = 'review' | 'reload';

export const ReconciliationModal = ({ isOpen, onClose }: ReconciliationModalProps) => {
  const {
    activeOrganization,
    reconcileTransactions,
    uploadExemptionForm,
    auditLog,
    requestReload,
  } = useLedger();

  // Unreconciled debit card transactions
  const unreconciledTxns: Transaction[] = (activeOrganization?.transactions ?? []).filter(
    (t) => t.budgetLine === 'Debit Card' && t.reconciledAt == null,
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const [zipping, setZipping] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [step, setStep] = useState<Step>('review');
  const [reconSummary, setReconSummary] = useState<{
    transactionCount: number;
    totalAmount: number;
    exemptionCount: number;
  } | null>(null);
  const [snapshotTxnsWithReceipts, setSnapshotTxnsWithReceipts] = useState<Transaction[]>(
    [],
  );
  const [reloadAmountInput, setReloadAmountInput] = useState('');
  const [requestingReload, setRequestingReload] = useState(false);
  const [reloadRequested, setReloadRequested] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  // A transaction is "covered" if it has a receipt or an attached exemption form
  const isCovered = (t: Transaction) => !!(t.receiptFileUrl || t.exemptionFormUrl);

  // Reset selection whenever the modal opens (the false→true transition only —
  // NOT on every subsequent change to coveredIds/uncoveredCount while it stays
  // open, since reconciling flips those via Realtime a moment later and would
  // otherwise reset `step` back to 'review' right under the success screen).
  const coveredIds = unreconciledTxns
    .filter(isCovered)
    .map((t) => t.id)
    .join(',');
  const uncoveredCount = unreconciledTxns.filter((t) => !isCovered(t)).length;
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelected(
        uncoveredCount === 0 && coveredIds ? new Set(coveredIds.split(',')) : new Set(),
      );
      setError(null);
      setUploading({});
      setUploadError({});
      setStep('review');
      setReconSummary(null);
      setReloadAmountInput('');
      setRequestingReload(false);
      setReloadRequested(false);
      setReloadError(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, coveredIds, uncoveredCount]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // All uncovered transactions in the list (blocks reconciliation entirely)
  const uncoveredAll = unreconciledTxns.filter((t) => !isCovered(t));

  // If ANY unreconciled transaction is missing a receipt/exemption form,
  // hide ALL checkboxes — nothing can be selected until every transaction is covered
  const hideCheckboxes = uncoveredAll.length > 0;

  const coveredCount = unreconciledTxns.filter(isCovered).length;
  const displayCount = hideCheckboxes ? coveredCount : selected.size;

  const canConfirm = !hideCheckboxes && selected.size > 0;

  const handleFileChange = async (txnId: string, file: File | null) => {
    if (!file) return;
    setUploading((prev) => ({ ...prev, [txnId]: true }));
    setUploadError((prev) => ({ ...prev, [txnId]: '' }));
    try {
      await uploadExemptionForm(txnId, file);
    } catch (err) {
      setUploadError((prev) => ({
        ...prev,
        [txnId]: err instanceof Error ? err.message : 'Upload failed.',
      }));
    } finally {
      setUploading((prev) => ({ ...prev, [txnId]: false }));
    }
  };

  const handleConfirm = async () => {
    if (selected.size === 0) {
      setError('Select at least one transaction to reconcile.');
      return;
    }
    if (uncoveredAll.length > 0) {
      setError(
        `${uncoveredAll.length} transaction(s) are missing a receipt or exemption form.`,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const reconciledTxns = unreconciledTxns.filter((t) => selected.has(t.id));
      const totalAmount = reconciledTxns
        .filter((t) => t.direction === 'Outflow')
        .reduce((sum, t) => sum + t.amount, 0);
      const exemptionCount = reconciledTxns.filter((t) => t.exemptionFormUrl).length;

      setSnapshotTxnsWithReceipts(
        reconciledTxns.filter((t) => t.receiptFileUrl || t.exemptionFormUrl),
      );
      const priorTotals = auditLog
        .filter((e) => e.action === 'reconcile' && e.reconciliationSummary)
        .map((e) => e.reconciliationSummary!.totalAmount);
      const suggested =
        [...priorTotals, totalAmount].reduce((sum, n) => sum + n, 0) /
        (priorTotals.length + 1);

      await reconcileTransactions([...selected]);

      const summary = { transactionCount: selected.size, totalAmount, exemptionCount };
      setReconSummary(summary);
      setReloadAmountInput(suggested.toFixed(2));
      setStep('reload');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconciliation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReload = async () => {
    if (!reconSummary) return;
    const amount = parseFloat(reloadAmountInput);
    if (Number.isNaN(amount) || amount <= 0) {
      setReloadError('Enter a valid reload amount.');
      return;
    }
    setRequestingReload(true);
    setReloadError(null);
    try {
      await requestReload(
        amount,
        reconSummary.totalAmount,
        reconSummary.transactionCount,
      );
      setReloadRequested(true);
    } catch (err) {
      setReloadError(err instanceof Error ? err.message : 'Reload request failed.');
    } finally {
      setRequestingReload(false);
    }
  };

  const handleDownloadZip = async () => {
    setZipping(true);
    try {
      await downloadReceiptsZip(snapshotTxnsWithReceipts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate ZIP.');
    } finally {
      setZipping(false);
    }
  };

  if (!isOpen) return null;

  const lastDate = activeOrganization?.lastReconciliationDate;

  return (
    <div className="wl-modal-root">
      <div className="wl-modal-overlay" aria-hidden="true" onClick={onClose} />
      <div
        className="wl-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recon-title"
      >
        <div className="wl-modal-header">
          <h2 id="recon-title" className="wl-modal-title">
            Reconcile Debit Card
          </h2>
          <button
            type="button"
            className="wl-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="wl-modal-body">
          {step === 'review' && (
            <>
              <p className={styles['wl-recon-subtitle']}>
                {lastDate
                  ? `Showing unreconciled transactions since ${formatDate(lastDate)}.`
                  : 'Showing all unreconciled debit card transactions.'}
              </p>

              {unreconciledTxns.length === 0 ? (
                <div className={styles['wl-recon-empty']}>
                  <span className={styles['wl-recon-empty-icon']}>✓</span>
                  <p>All debit card transactions are already reconciled.</p>
                </div>
              ) : (
                <>
                  <div className={styles['wl-recon-list']}>
                    {unreconciledTxns.map((t) => {
                      const isMissing = !isCovered(t);

                      return (
                        <div
                          key={t.id}
                          className={`${styles['wl-recon-item']}${isMissing ? ` ${styles['wl-recon-item--warning']}` : ''}`}
                        >
                          <div
                            className={`${styles['wl-recon-row']}${isMissing ? ` ${styles['wl-recon-row--disabled']}` : ''}`}
                          >
                            <span className={styles['wl-recon-row-title']}>
                              {t.title}
                            </span>
                            {t.receiptFileUrl && (
                              <span
                                className={`${styles['wl-recon-badge']} ${styles['wl-recon-badge--ok']}`}
                                title="Receipt uploaded"
                              >
                                🧾
                              </span>
                            )}
                            {t.exemptionFormUrl && (
                              <span
                                className={`${styles['wl-recon-badge']} ${styles['wl-recon-badge--ok']}`}
                                title="Exemption form attached"
                              >
                                📋
                              </span>
                            )}
                            {isMissing && (
                              <span
                                className={`${styles['wl-recon-badge']} ${styles['wl-recon-badge--warn']}`}
                                title={
                                  t.noReceiptAcknowledged
                                    ? 'Submitted without receipt — attach completed PERF to reconcile'
                                    : 'Missing receipt — attach receipt or completed PERF to reconcile'
                                }
                              >
                                ⚠
                              </span>
                            )}
                            <span className={styles['wl-recon-row-amount']}>
                              {t.direction === 'Outflow' ? '−' : '+'}
                              {formatCurrency(t.amount)}
                            </span>
                          </div>

                          {/* Missing receipt sub-panel */}
                          {isMissing && (
                            <div className={styles['wl-recon-missing']}>
                              <p className={styles['wl-recon-missing-msg']}>
                                {t.noReceiptAcknowledged
                                  ? 'Submitted without receipt. '
                                  : 'No receipt on file. '}
                                <a
                                  href={POLICY_EXEMPTION_FORM_URL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles['wl-recon-exemption-link']}
                                >
                                  {t.noReceiptAcknowledged
                                    ? 'Attach completed Policy Exemption Request Form ↗'
                                    : 'Submit Policy Exemption Request Form ↗'}
                                </a>
                              </p>
                              <div className={styles['wl-recon-upload-row']}>
                                <input
                                  ref={(el) => {
                                    fileInputRefs.current[t.id] = el;
                                  }}
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  style={{ display: 'none' }}
                                  onChange={(e) =>
                                    handleFileChange(t.id, e.target.files?.[0] ?? null)
                                  }
                                />
                                <button
                                  type="button"
                                  className={styles['wl-btn-upload-exemption']}
                                  onClick={() => fileInputRefs.current[t.id]?.click()}
                                  disabled={uploading[t.id]}
                                >
                                  {uploading[t.id]
                                    ? 'Uploading…'
                                    : '↑ Attach Completed Exemption Form'}
                                </button>
                                {uploadError[t.id] && (
                                  <span className={styles['wl-recon-upload-error']}>
                                    {uploadError[t.id]}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {uncoveredAll.length > 0 && (
                    <div className={styles['wl-recon-block-warning']}>
                      ⚠ {uncoveredAll.length} transaction
                      {uncoveredAll.length !== 1 ? 's' : ''} cannot be reconciled until{' '}
                      {uncoveredAll.length === 1 ? 'it has' : 'they have'} a receipt or
                      attached exemption form.
                    </div>
                  )}

                  {error && (
                    <div className="wl-form-error" style={{ marginTop: 12 }}>
                      {error}
                    </div>
                  )}

                  <div className={styles['wl-recon-actions']}>
                    <button
                      type="button"
                      className="wl-btn-primary"
                      onClick={handleConfirm}
                      disabled={submitting || !canConfirm || hideCheckboxes}
                      title={
                        hideCheckboxes
                          ? 'Resolve all missing receipts before reconciling'
                          : undefined
                      }
                    >
                      {submitting
                        ? 'Reconciling…'
                        : `Confirm & Reconcile (${displayCount})`}
                    </button>
                    <button
                      type="button"
                      className="wl-btn-cancel"
                      onClick={onClose}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {step === 'reload' && reconSummary && (
            <>
              <div className={styles['wl-recon-success']}>
                <span className={styles['wl-recon-success-icon']}>✓</span>
                <p className={styles['wl-recon-success-title']}>
                  Reconciliation complete!
                </p>
                <div className={styles['wl-recon-success-stats']}>
                  <div className={styles['wl-recon-success-stat']}>
                    <span className={styles['wl-recon-success-stat-value']}>
                      {reconSummary.transactionCount}
                    </span>
                    <span className={styles['wl-recon-success-stat-label']}>
                      transaction{reconSummary.transactionCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className={styles['wl-recon-success-stat']}>
                    <span className={styles['wl-recon-success-stat-value']}>
                      {formatCurrency(reconSummary.totalAmount)}
                    </span>
                    <span className={styles['wl-recon-success-stat-label']}>total</span>
                  </div>
                  {reconSummary.exemptionCount > 0 && (
                    <div className={styles['wl-recon-success-stat']}>
                      <span className={styles['wl-recon-success-stat-value']}>
                        {reconSummary.exemptionCount}
                      </span>
                      <span className={styles['wl-recon-success-stat-label']}>
                        exemption{reconSummary.exemptionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles['wl-recon-reload']}>
                <h3 className={styles['wl-recon-reload-title']}>
                  Request a Debit Card Reload
                </h3>
                {reloadRequested ? (
                  <p className={styles['wl-recon-reload-confirm']}>
                    ✓ Reload request for {formatCurrency(parseFloat(reloadAmountInput))}{' '}
                    submitted.
                  </p>
                ) : (
                  <>
                    <p className={styles['wl-recon-reload-hint']}>
                      Suggested based on the average of past reconciliations — adjust if
                      needed.
                    </p>
                    <div className={styles['wl-recon-reload-row']}>
                      <div className="wl-form-group">
                        <label className="wl-form-label" htmlFor="reload-amount">
                          Amount
                        </label>
                        <div className={styles['wl-amount-input-wrap']}>
                          <span className={styles['wl-amount-input-prefix']}>$</span>
                          <input
                            id="reload-amount"
                            type="text"
                            inputMode="decimal"
                            className={`wl-form-input ${styles['wl-amount-input']}`}
                            value={reloadAmountInput}
                            onChange={(e) => setReloadAmountInput(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles['wl-btn-download-zip']}
                        onClick={handleRequestReload}
                        disabled={requestingReload}
                      >
                        {requestingReload ? 'Submitting…' : 'Request Reload'}
                      </button>
                    </div>
                    {reloadError && <div className="wl-form-error">{reloadError}</div>}
                  </>
                )}
              </div>

              <div className={styles['wl-recon-actions']}>
                {snapshotTxnsWithReceipts.length > 0 && (
                  <button
                    type="button"
                    className={styles['wl-btn-download-zip']}
                    onClick={handleDownloadZip}
                    disabled={zipping}
                  >
                    {zipping
                      ? 'Bundling…'
                      : `⬇ Receipts ZIP (${snapshotTxnsWithReceipts.length})`}
                  </button>
                )}
                <button type="button" className="wl-btn-primary" onClick={onClose}>
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
