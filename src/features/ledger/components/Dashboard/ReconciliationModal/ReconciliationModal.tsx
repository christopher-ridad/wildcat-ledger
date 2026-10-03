import { useRef, useState } from 'react';

import { pluralize } from '../../../../../utils/pluralize';
import { useAsyncAction, useAsyncActionMap } from '../../../hooks/useAsyncAction';
import { useLedger } from '../../../hooks/useLedger';
import { useResetOnOpen } from '../../../hooks/useResetOnOpen';
import { calculateReconciliationFormData } from '../../../services/debitCardReconciliationForm';
import { downloadReceiptsZip } from '../../../services/downloadReceiptsZip';
import {
  downloadReconciliationPdf,
  generateReconciliationPdf,
  ReloadChoice,
} from '../../../services/generateReconciliationPdf';
import { Transaction } from '../../../types';
import { formatCurrency, formatDate, formatTimestamp } from '../../../utils/calculations';
import {
  POLICY_EXEMPTION_FORM_URL,
  SOFO_SALES_TAX_REIMBURSEMENT_URL,
} from '../../../utils/constants';
import { needsTaxReimbursement } from '../../../utils/documentRequirements';
import { Modal } from '../Modal';
import styles from './ReconciliationModal.module.css';
import { setIncluded } from './reconciliationSelection';

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'review' | 'reload';

export const ReconciliationModal = ({ isOpen, onClose }: ReconciliationModalProps) => {
  const {
    activeOrganization,
    reconcileTransactions,
    uploadExemptionForm,
    markTaxReimbursed,
    addTransaction,
    generateTransactionId,
    pendingChangeForTransaction,
  } = useLedger();

  // Unreconciled debit card *purchases* needing a receipt before they can be
  // reconciled. Reload journals also live on the Debit Card budget line but
  // don't need reconciliation — they're tracked via their own payment
  // status instead (see TransactionRow).
  // Newest first, matching the order purchases can be left out in (see
  // setIncluded).
  const unreconciledTxns: Transaction[] = (activeOrganization?.transactions ?? [])
    .filter(
      (t) =>
        t.budgetLine === 'Debit Card' && t.type !== 'Journal' && t.reconciledAt == null,
    )
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const confirmAction = useAsyncAction();
  const uploadAction = useAsyncActionMap();
  const reimburseAction = useAsyncActionMap();
  const zipAction = useAsyncAction();
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
  const [reloadChoice, setReloadChoice] = useState<ReloadChoice | null>(null);
  const reloadAction = useAsyncAction();
  const [reloadRequested, setReloadRequested] = useState(false);
  const [serviceFeesInput, setServiceFeesInput] = useState('0');
  // Only asked for when the app has no earlier reconciliation on record.
  const [lastReconciliationDateInput, setLastReconciliationDateInput] = useState('');
  const pdfAction = useAsyncAction();
  // "Covered" per docs/BUSINESS_RULES.md#debit-card-reconciliation.
  const isCovered = (t: Transaction) => !!(t.receiptFileUrl || t.exemptionFormUrl);
  // See docs/BUSINESS_RULES.md#dual-approval-workflow -- a reconciled
  // transaction can never be edited/deleted, so an outstanding request
  // needs resolving from the dashboard before reconciling.
  const pendingChangeFor = (t: Transaction) => pendingChangeForTransaction(t.id);

  const coveredIds = unreconciledTxns
    .filter(isCovered)
    .map((t) => t.id)
    .join(',');
  const uncoveredCount = unreconciledTxns.filter((t) => !isCovered(t)).length;
  // Reset selection whenever the modal opens (the false→true transition only —
  // NOT on every subsequent change to coveredIds/uncoveredCount while it stays
  // open, since reconciling flips those via Realtime a moment later and would
  // otherwise reset `step` back to 'review' right under the success screen).
  useResetOnOpen(isOpen, () => {
    setSelected(
      uncoveredCount === 0 && coveredIds ? new Set(coveredIds.split(',')) : new Set(),
    );
    confirmAction.setError(null);
    uploadAction.reset();
    reimburseAction.reset();
    setStep('review');
    setReconSummary(null);
    setReloadChoice(null);
    setReloadRequested(false);
    reloadAction.setError(null);
    setServiceFeesInput('0');
    setLastReconciliationDateInput('');
    pdfAction.setError(null);
  }, [coveredIds, uncoveredCount]);

  // All uncovered transactions in the list (blocks reconciliation entirely)
  const uncoveredAll = unreconciledTxns.filter((t) => !isCovered(t));
  const unresolvedTaxAll = unreconciledTxns.filter(needsTaxReimbursement);
  const pendingAll = unreconciledTxns.filter((t) => pendingChangeFor(t));

  // If ANY unreconciled transaction is missing a receipt/exemption form,
  // owes an unresolved tax reimbursement, or has a pending edit/delete
  // request, hide ALL checkboxes — nothing can be selected until every
  // transaction is covered and resolved
  const hideCheckboxes =
    uncoveredAll.length > 0 || unresolvedTaxAll.length > 0 || pendingAll.length > 0;

  const coveredCount = unreconciledTxns.filter(isCovered).length;
  const displayCount = hideCheckboxes ? coveredCount : selected.size;

  const canConfirm = !hideCheckboxes && selected.size > 0;

  const handleFileChange = async (txnId: string, file: File | null) => {
    if (!file) return;
    await uploadAction.run(
      txnId,
      async () => {
        await uploadExemptionForm(txnId, file);
        // The auto-select effect only (re)populates `selected` on the modal's
        // own isOpen false->true transition, not on every coveredIds change
        // while it stays open -- so a transaction that just became covered
        // mid-session needs to be added here, or Confirm stays stuck at (0).
        setSelected((prev) => new Set(prev).add(txnId));
      },
      'Upload failed.',
    );
  };

  const handleMarkReimbursed = async (txnId: string) => {
    await reimburseAction.run(
      txnId,
      async () => {
        await markTaxReimbursed(txnId);
        // See the matching comment in handleFileChange -- the auto-select
        // effect won't pick this up mid-session on its own.
        setSelected((prev) => new Set(prev).add(txnId));
      },
      'Failed to mark as reimbursed.',
    );
  };

  const handleConfirm = async () => {
    if (selected.size === 0) {
      confirmAction.setError('Select at least one transaction to reconcile.');
      return;
    }
    if (uncoveredAll.length > 0) {
      confirmAction.setError(
        `${uncoveredAll.length} transaction(s) are missing a receipt or exemption form.`,
      );
      return;
    }
    if (unresolvedTaxAll.length > 0) {
      confirmAction.setError(
        `${unresolvedTaxAll.length} transaction(s) owe an unresolved tax reimbursement to SOFO.`,
      );
      return;
    }
    if (pendingAll.length > 0) {
      confirmAction.setError(
        `${pendingAll.length} transaction(s) have a pending edit or delete request awaiting approval.`,
      );
      return;
    }
    await confirmAction.run(async () => {
      const reconciledTxns = unreconciledTxns.filter((t) => selected.has(t.id));
      const totalAmount = reconciledTxns
        .filter((t) => t.direction === 'Outflow')
        .reduce((sum, t) => sum + t.amount, 0);
      const exemptionCount = reconciledTxns.filter((t) => t.exemptionFormUrl).length;

      setSnapshotTxnsWithReceipts(
        reconciledTxns.filter((t) => t.receiptFileUrl || t.exemptionFormUrl),
      );

      await reconcileTransactions([...selected]);

      const summary = { transactionCount: selected.size, totalAmount, exemptionCount };
      setReconSummary(summary);
      setStep('reload');
    }, 'Reconciliation failed.');
  };

  // Recomputed live off current state (selected, service fees, whether a
  // reload has actually been requested yet) rather than snapshotted once --
  // cheap, pure, and lets the download always reflect the treasurer's
  // latest input instead of going stale if they adjust something first.
  const reconciliationFormData = activeOrganization
    ? calculateReconciliationFormData(
        activeOrganization,
        [...selected],
        parseFloat(serviceFeesInput) || 0,
      )
    : null;

  // A never-configured Load Balance defaults to 0 (see
  // calculateReconciliationFormData), which makes the generated form's
  // Total Expenditures come out negative -- a real, visible mismatch
  // rather than a silently wrong number, but better caught here before
  // generating the form at all.
  const loadBalanceNotSet = !activeOrganization?.debitCardSettings.loadBalance;

  const handleRequestReload = async () => {
    if (!reconSummary || !reconciliationFormData) return;
    // Always the form's Debit Card Reload Amount: SOFO reloads the full
    // amount owed, never a partial one.
    const amount = reconciliationFormData.reloadAmount;
    await reloadAction.run(async () => {
      await addTransaction(
        {
          title: 'Debit Card Reload',
          date: new Date().toISOString().slice(0, 10),
          amount,
          direction: 'Inflow',
          type: 'Journal',
          budgetLine: 'Debit Card',
          notes: `Requested after reconciling ${reconSummary.transactionCount} ${pluralize(reconSummary.transactionCount, 'transaction')} (${formatCurrency(reconSummary.totalAmount)} total).`,
        },
        generateTransactionId(),
      );
      setReloadRequested(true);
    }, 'Reload request failed.');
  };

  // The form records the reload decision, so it has to be made (and a
  // reload actually requested, if wanted) before the form is generated.
  const canDownloadForm =
    reloadChoice === 'do-not-reload' ||
    (reloadChoice === 'please-reload' && reloadRequested);

  const handleDownloadForm = async () => {
    if (!reconciliationFormData || !reloadChoice) return;
    await pdfAction.run(async () => {
      const blob = await generateReconciliationPdf(
        {
          ...reconciliationFormData,
          lastReconciliationDate:
            reconciliationFormData.lastReconciliationDate ??
            (lastReconciliationDateInput || undefined),
        },
        reloadChoice,
      );
      downloadReconciliationPdf(blob, reconciliationFormData.orgName);
    }, 'Could not generate the reconciliation form.');
  };

  const handleDownloadZip = async () => {
    await zipAction.run(async () => {
      await downloadReceiptsZip(snapshotTxnsWithReceipts);
    }, 'Could not generate ZIP.');
  };

  const lastDate = activeOrganization?.lastReconciliationDate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      titleId="recon-title"
      title="Reconcile Debit Card"
    >
      {step === 'review' && (
        <>
          <p className={styles['wl-recon-subtitle']}>
            {lastDate
              ? `Showing unreconciled transactions since ${formatTimestamp(lastDate)}.`
              : 'Showing all unreconciled debit card transactions.'}
          </p>

          {!hideCheckboxes && unreconciledTxns.length > 0 && (
            <p className={styles['wl-recon-subtitle']}>
              Untick purchases to leave them for the next reconciliation. Only the most
              recent ones can be left out, so unticking one also unticks everything newer.
            </p>
          )}

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
                  const needsTax = needsTaxReimbursement(t);
                  const pending = pendingChangeFor(t);
                  const isBlocking = isMissing || needsTax || !!pending;

                  return (
                    <div
                      key={t.id}
                      className={`${styles['wl-recon-item']}${isBlocking ? ` ${styles['wl-recon-item--warning']}` : ''}`}
                    >
                      <label
                        className={`${styles['wl-recon-row']}${isBlocking ? ` ${styles['wl-recon-row--disabled']}` : ''}`}
                      >
                        {!hideCheckboxes && (
                          <input
                            type="checkbox"
                            checked={selected.has(t.id)}
                            onChange={(e) =>
                              setSelected((prev) =>
                                setIncluded(unreconciledTxns, prev, t, e.target.checked),
                              )
                            }
                          />
                        )}
                        <span className={styles['wl-recon-row-date']}>
                          {formatDate(t.date)}
                        </span>
                        <span className={styles['wl-recon-row-title']}>{t.title}</span>
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
                                ? 'Submitted without receipt. Attach a completed PERF to reconcile.'
                                : 'Missing receipt. Attach a receipt or completed PERF to reconcile.'
                            }
                          >
                            ⚠
                          </span>
                        )}
                        {needsTax && (
                          <span
                            className={`${styles['wl-recon-badge']} ${styles['wl-recon-badge--warn']}`}
                            title="Owes an unresolved tax reimbursement to SOFO"
                          >
                            💲
                          </span>
                        )}
                        {pending && (
                          <span
                            className={`${styles['wl-recon-badge']} ${styles['wl-recon-badge--warn']}`}
                            title="Awaiting approval. Resolve before reconciling."
                          >
                            ⏳
                          </span>
                        )}
                        <span className={styles['wl-recon-row-amount']}>
                          {t.direction === 'Outflow' ? '−' : '+'}
                          {formatCurrency(t.amount)}
                        </span>
                      </label>

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
                              disabled={uploadAction.pending(t.id)}
                            >
                              {uploadAction.pending(t.id)
                                ? 'Uploading…'
                                : '↑ Attach Completed Exemption Form'}
                            </button>
                            {uploadAction.error(t.id) && (
                              <span className={styles['wl-recon-upload-error']}>
                                {uploadAction.error(t.id)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {needsTax && (
                        <div className={styles['wl-recon-missing']}>
                          <p className={styles['wl-recon-missing-msg']}>
                            Owes {formatCurrency(t.taxAmount ?? 0)} in tax to SOFO.{' '}
                            <a
                              href={SOFO_SALES_TAX_REIMBURSEMENT_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles['wl-recon-exemption-link']}
                            >
                              Submit to SOFO ↗
                            </a>
                          </p>
                          <div className={styles['wl-recon-upload-row']}>
                            <button
                              type="button"
                              className={styles['wl-btn-upload-exemption']}
                              onClick={() => handleMarkReimbursed(t.id)}
                              disabled={reimburseAction.pending(t.id)}
                            >
                              {reimburseAction.pending(t.id)
                                ? 'Marking…'
                                : 'Mark as Reimbursed'}
                            </button>
                            {reimburseAction.error(t.id) && (
                              <span className={styles['wl-recon-upload-error']}>
                                {reimburseAction.error(t.id)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {pending && (
                        <div className={styles['wl-recon-missing']}>
                          <p className={styles['wl-recon-missing-msg']}>
                            Has a pending {pending.type === 'delete' ? 'delete' : 'edit'}{' '}
                            request awaiting approval. Resolve it from the dashboard, then
                            reopen this dialog.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {uncoveredAll.length > 0 && (
                <div className={styles['wl-recon-block-warning']}>
                  ⚠ {uncoveredAll.length} {pluralize(uncoveredAll.length, 'transaction')}{' '}
                  cannot be reconciled until{' '}
                  {uncoveredAll.length === 1 ? 'it has' : 'they have'} a receipt or
                  attached exemption form.
                </div>
              )}

              {unresolvedTaxAll.length > 0 && (
                <div className={styles['wl-recon-block-warning']}>
                  ⚠ {unresolvedTaxAll.length}{' '}
                  {pluralize(unresolvedTaxAll.length, 'transaction')} cannot be reconciled
                  until {unresolvedTaxAll.length === 1 ? 'its' : 'their'} tax
                  reimbursement to SOFO is resolved.
                </div>
              )}

              {pendingAll.length > 0 && (
                <div className={styles['wl-recon-block-warning']}>
                  ⚠ {pendingAll.length} {pluralize(pendingAll.length, 'transaction')}{' '}
                  cannot be reconciled until {pendingAll.length === 1 ? 'its' : 'their'}{' '}
                  pending edit or delete request {pendingAll.length === 1 ? 'is' : 'are'}{' '}
                  resolved.
                </div>
              )}

              {confirmAction.error && (
                <div className="wl-form-error" style={{ marginTop: 12 }}>
                  {confirmAction.error}
                </div>
              )}

              <div className={styles['wl-recon-actions']}>
                <button
                  type="button"
                  className="wl-btn-primary"
                  onClick={handleConfirm}
                  disabled={confirmAction.pending || !canConfirm || hideCheckboxes}
                  title={
                    hideCheckboxes
                      ? 'Resolve all missing receipts before reconciling'
                      : undefined
                  }
                >
                  {confirmAction.pending
                    ? 'Reconciling…'
                    : `Confirm & Reconcile (${displayCount})`}
                </button>
                <button
                  type="button"
                  className="wl-btn-cancel"
                  onClick={onClose}
                  disabled={confirmAction.pending}
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
            <p className={styles['wl-recon-success-title']}>Reconciliation complete!</p>
            <div className={styles['wl-recon-success-stats']}>
              <div className={styles['wl-recon-success-stat']}>
                <span className={styles['wl-recon-success-stat-value']}>
                  {reconSummary.transactionCount}
                </span>
                <span className={styles['wl-recon-success-stat-label']}>
                  {pluralize(reconSummary.transactionCount, 'transaction')}
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
                    {pluralize(reconSummary.exemptionCount, 'exemption')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className={styles['wl-recon-reload']}>
            <h3 className={styles['wl-recon-reload-title']}>Debit Card Reload</h3>
            {loadBalanceNotSet && (
              <div className={styles['wl-recon-block-warning']}>
                ⚠ This org&apos;s debit card Load Balance isn&apos;t set, so the
                reconciliation form won&apos;t be accurate. Set it under SOFO / CO
                Settings first.
              </div>
            )}
            <div className="wl-form-group">
              <label className="wl-form-label" htmlFor="service-fees">
                Service Fees (if any)
              </label>
              <div className={styles['wl-amount-input-wrap']}>
                <span className={styles['wl-amount-input-prefix']}>$</span>
                <input
                  id="service-fees"
                  type="text"
                  inputMode="decimal"
                  className={`wl-form-input ${styles['wl-amount-input']}`}
                  placeholder="0.00"
                  value={serviceFeesInput}
                  disabled={reloadRequested}
                  onChange={(e) => setServiceFeesInput(e.target.value)}
                />
              </div>
            </div>

            {reconciliationFormData && !reconciliationFormData.lastReconciliationDate && (
              <div className="wl-form-group">
                <label className="wl-form-label" htmlFor="last-reconciliation-date">
                  Date of Last Reconciliation
                </label>
                <input
                  id="last-reconciliation-date"
                  type="date"
                  className="wl-form-input"
                  max={reconciliationFormData.balanceAsOfDate}
                  value={lastReconciliationDateInput}
                  onChange={(e) => setLastReconciliationDateInput(e.target.value)}
                />
                <p className={styles['wl-recon-reload-hint']}>
                  This is the first reconciliation in WildcatLedger. If this card was
                  reconciled before, enter that date; leave it blank if it never has been.
                </p>
              </div>
            )}

            {reconciliationFormData && (
              <fieldset
                className={styles['wl-recon-reload-choice']}
                disabled={reloadRequested}
              >
                <legend className="wl-form-label">
                  Do you want SOFO to reload the card?
                </legend>
                <label className={styles['wl-recon-reload-option']}>
                  <input
                    type="radio"
                    name="reload-choice"
                    checked={reloadChoice === 'please-reload'}
                    onChange={() => setReloadChoice('please-reload')}
                  />
                  <span>
                    Please reload {formatCurrency(reconciliationFormData.reloadAmount)}
                  </span>
                </label>
                {reconciliationFormData.completedReconciliationsPendingReload > 0 && (
                  <p className={styles['wl-recon-reload-hint']}>
                    This round&apos;s{' '}
                    {formatCurrency(reconciliationFormData.reconciliationSubtotal)} plus{' '}
                    {formatCurrency(
                      reconciliationFormData.completedReconciliationsPendingReload,
                    )}{' '}
                    from an earlier reconciliation that hasn&apos;t been reloaded yet.
                  </p>
                )}
                <label className={styles['wl-recon-reload-option']}>
                  <input
                    type="radio"
                    name="reload-choice"
                    checked={reloadChoice === 'do-not-reload'}
                    onChange={() => setReloadChoice('do-not-reload')}
                  />
                  <span>Do not reload at this time</span>
                </label>
              </fieldset>
            )}

            {reloadChoice === 'please-reload' &&
              (reloadRequested ? (
                <p className={styles['wl-recon-reload-confirm']}>
                  ✓ Reload requested. It stays Pending until SOFO puts the money on the
                  card.
                </p>
              ) : (
                <button
                  type="button"
                  className={styles['wl-btn-download-zip']}
                  onClick={handleRequestReload}
                  disabled={reloadAction.pending}
                >
                  {reloadAction.pending ? 'Submitting…' : 'Request Reload'}
                </button>
              ))}
            {reloadAction.error && (
              <div className="wl-form-error">{reloadAction.error}</div>
            )}
          </div>

          {zipAction.error && (
            <div className="wl-form-error" style={{ marginTop: 12 }}>
              {zipAction.error}
            </div>
          )}
          {pdfAction.error && (
            <div className="wl-form-error" style={{ marginTop: 12 }}>
              {pdfAction.error}
            </div>
          )}

          <div className={styles['wl-recon-actions']}>
            {snapshotTxnsWithReceipts.length > 0 && (
              <button
                type="button"
                className={styles['wl-btn-download-zip']}
                onClick={handleDownloadZip}
                disabled={zipAction.pending}
              >
                {zipAction.pending
                  ? 'Bundling…'
                  : `⬇ Receipts ZIP (${snapshotTxnsWithReceipts.length})`}
              </button>
            )}
            <button
              type="button"
              className={styles['wl-btn-download-zip']}
              onClick={handleDownloadForm}
              disabled={pdfAction.pending || !canDownloadForm}
              title={canDownloadForm ? undefined : 'Choose whether to reload first'}
            >
              {pdfAction.pending ? 'Generating…' : '⬇ Reconciliation Form (PDF)'}
            </button>
            <button type="button" className="wl-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};
