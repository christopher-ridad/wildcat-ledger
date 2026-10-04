import { useRef, useState } from 'react';

import { pluralize } from '../../../../../utils/pluralize';
import { useAsyncAction, useAsyncActionMap } from '../../../hooks/useAsyncAction';
import { useLedger } from '../../../hooks/useLedger';
import { useResetOnOpen } from '../../../hooks/useResetOnOpen';
import { calculateReconciliationFormData } from '../../../services/debitCardReconciliationForm';
import { ReconciliationRound, Transaction } from '../../../types';
import { formatCurrency, formatDate, formatTimestamp } from '../../../utils/calculations';
import {
  POLICY_EXEMPTION_FORM_URL,
  SOFO_SALES_TAX_REIMBURSEMENT_URL,
} from '../../../utils/constants';
import { needsTaxReimbursement } from '../../../utils/documentRequirements';
import { Modal } from '../Modal';
import { FinishReconciliation } from './FinishReconciliation';
import styles from './ReconciliationModal.module.css';
import { getIncludableIds, setIncluded } from './reconciliationSelection';

const LEAVE_OUT_HINT =
  'Purchases older than it can still be reconciled now; it and anything newer stay for next time.';

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'review' | 'finish';

export const ReconciliationModal = ({ isOpen, onClose }: ReconciliationModalProps) => {
  const {
    activeOrganization,
    reconcileTransactions,
    fetchLastReconciliation,
    uploadExemptionForm,
    markTaxReimbursed,
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
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [step, setStep] = useState<Step>('review');
  // The round on the finishing screen, and the org's most recent one (for
  // "View last reconciliation").
  const [round, setRound] = useState<ReconciliationRound | null>(null);
  const [lastRound, setLastRound] = useState<ReconciliationRound | null>(null);
  const [justReconciled, setJustReconciled] = useState(false);
  const [formDownloaded, setFormDownloaded] = useState(false);
  const [zipDownloaded, setZipDownloaded] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  // "Covered" per docs/BUSINESS_RULES.md#debit-card-reconciliation. A
  // service fee has no receipt to cover.
  const isCovered = (t: Transaction) =>
    !!(t.receiptFileUrl || t.exemptionFormUrl || t.isServiceFee);
  // See docs/BUSINESS_RULES.md#dual-approval-workflow -- a reconciled
  // transaction can never be edited/deleted, so an outstanding request
  // needs resolving from the dashboard before reconciling.
  const pendingChangeFor = (t: Transaction) => pendingChangeForTransaction(t.id);

  const isBlocked = (t: Transaction) =>
    !isCovered(t) || needsTaxReimbursement(t) || !!pendingChangeFor(t);
  const includableIds = getIncludableIds(unreconciledTxns, isBlocked);
  const includableKey = [...includableIds].join(',');
  // Reset selection whenever the modal opens (the false→true transition only —
  // NOT on every subsequent change to the list while it stays open, since
  // reconciling changes it via Realtime a moment later and would otherwise
  // reset `step` back to 'review' right under the success screen).
  useResetOnOpen(isOpen, () => {
    setSelected(new Set(includableIds));
    confirmAction.setError(null);
    uploadAction.reset();
    reimburseAction.reset();
    setStep('review');
    setRound(null);
    setLastRound(null);
    setJustReconciled(false);
    setFormDownloaded(false);
    setZipDownloaded(false);
    setConfirmingClose(false);
    fetchLastReconciliation()
      .then(setLastRound)
      .catch(() => setLastRound(null));
  }, [includableKey]);

  const uncoveredAll = unreconciledTxns.filter((t) => !isCovered(t));
  const unresolvedTaxAll = unreconciledTxns.filter(needsTaxReimbursement);
  const pendingAll = unreconciledTxns.filter((t) => pendingChangeFor(t));
  const selectedBlocked = unreconciledTxns.filter(
    (t) => selected.has(t.id) && isBlocked(t),
  );

  const canConfirm = selected.size > 0 && selectedBlocked.length === 0;

  // Once a purchase's blocker is resolved mid-session, tick it (and anything
  // older) -- unless an older purchase is still blocked.
  const includeOnceResolved = (txnId: string) => {
    const txn = unreconciledTxns.find((t) => t.id === txnId);
    if (!txn) return;
    const othersBlocked = (t: Transaction) => t.id !== txnId && isBlocked(t);
    if (!getIncludableIds(unreconciledTxns, othersBlocked).has(txnId)) return;
    setSelected((prev) => setIncluded(unreconciledTxns, prev, txn, true));
  };

  const handleFileChange = async (txnId: string, file: File | null) => {
    if (!file) return;
    await uploadAction.run(
      txnId,
      async () => {
        await uploadExemptionForm(txnId, file);
        // The auto-select effect only runs when the modal opens, so a
        // purchase that just became covered mid-session is ticked here.
        includeOnceResolved(txnId);
      },
      'Upload failed.',
    );
  };

  const handleMarkReimbursed = async (txnId: string) => {
    await reimburseAction.run(
      txnId,
      async () => {
        await markTaxReimbursed(txnId);
        // See the matching comment in handleFileChange.
        includeOnceResolved(txnId);
      },
      'Failed to mark as reimbursed.',
    );
  };

  const handleConfirm = async () => {
    if (selected.size === 0) {
      confirmAction.setError('Select at least one transaction to reconcile.');
      return;
    }
    if (selectedBlocked.length > 0) {
      confirmAction.setError(
        `${selectedBlocked.length} selected ${pluralize(selectedBlocked.length, 'transaction')} can't be reconciled yet.`,
      );
      return;
    }
    if (!activeOrganization) return;
    await confirmAction.run(async () => {
      // Frozen now: the reload step and any later revisit use these numbers,
      // which would drift with card activity if recomputed.
      const formData = calculateReconciliationFormData(activeOrganization, [...selected]);
      const saved = await reconcileTransactions([...selected], formData);
      setRound(saved);
      setLastRound(saved);
      setJustReconciled(true);
      setStep('finish');
    }, 'Reconciliation failed.');
  };

  const openLastRound = () => {
    if (!lastRound) return;
    setRound(lastRound);
    setJustReconciled(false);
    setStep('finish');
  };

  // A just-reconciled round's finishing screen asks before closing until the
  // form (and receipts ZIP, if it has receipts) are downloaded. It can always
  // be reopened from "View last reconciliation".
  const roundHasReceipts =
    !!round &&
    (activeOrganization?.transactions ?? []).some(
      (t) =>
        round.transactionIds.includes(t.id) && (t.receiptFileUrl || t.exemptionFormUrl),
    );
  const notYetDownloaded = [
    !formDownloaded && 'the reconciliation form',
    roundHasReceipts && !zipDownloaded && 'the receipts ZIP',
  ].filter(Boolean);

  const requestClose = () => {
    if (step === 'finish' && justReconciled && notYetDownloaded.length > 0) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  };

  const lastDate = activeOrganization?.lastReconciliationDate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
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
          {lastRound && (
            <button
              type="button"
              className={styles['wl-recon-view-last']}
              onClick={openLastRound}
            >
              View last reconciliation ({formatTimestamp(lastRound.reconciledAt)})
            </button>
          )}

          {unreconciledTxns.length > 0 && (
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
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          disabled={!selected.has(t.id) && !includableIds.has(t.id)}
                          onChange={(e) =>
                            setSelected((prev) =>
                              setIncluded(unreconciledTxns, prev, t, e.target.checked),
                            )
                          }
                        />
                        <span className={styles['wl-recon-row-date']}>
                          {formatDate(t.date)}
                        </span>
                        <span className={styles['wl-recon-row-title']}>{t.title}</span>
                        {t.isServiceFee && (
                          <span className={styles['wl-recon-fee-badge']}>
                            Service fee
                          </span>
                        )}
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
                  attached exemption form. {LEAVE_OUT_HINT}
                </div>
              )}

              {unresolvedTaxAll.length > 0 && (
                <div className={styles['wl-recon-block-warning']}>
                  ⚠ {unresolvedTaxAll.length}{' '}
                  {pluralize(unresolvedTaxAll.length, 'transaction')} cannot be reconciled
                  until {unresolvedTaxAll.length === 1 ? 'its' : 'their'} tax
                  reimbursement to SOFO is resolved. {LEAVE_OUT_HINT}
                </div>
              )}

              {pendingAll.length > 0 && (
                <div className={styles['wl-recon-block-warning']}>
                  ⚠ {pendingAll.length} {pluralize(pendingAll.length, 'transaction')}{' '}
                  cannot be reconciled until {pendingAll.length === 1 ? 'its' : 'their'}{' '}
                  pending edit or delete request {pendingAll.length === 1 ? 'is' : 'are'}{' '}
                  resolved. {LEAVE_OUT_HINT}
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
                  disabled={confirmAction.pending || !canConfirm}
                >
                  {confirmAction.pending
                    ? 'Reconciling…'
                    : `Confirm & Reconcile (${selected.size})`}
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

      {step === 'finish' && round && (
        <>
          <FinishReconciliation
            key={round.id}
            round={round}
            justReconciled={justReconciled}
            onRoundChange={(updated) => {
              setRound(updated);
              setLastRound(updated);
            }}
            onFormDownloaded={() => setFormDownloaded(true)}
            onZipDownloaded={() => setZipDownloaded(true)}
            onDone={requestClose}
          />

          {confirmingClose && (
            <div className={styles['wl-recon-close-confirm']} role="alertdialog">
              <p className={styles['wl-recon-close-confirm-msg']}>
                ⚠ You haven&apos;t downloaded {notYetDownloaded.join(' or ')} yet. You can
                come back to it later from &ldquo;View last reconciliation.&rdquo;
              </p>
              <div className={styles['wl-recon-close-confirm-actions']}>
                <button
                  type="button"
                  className="wl-btn-primary"
                  onClick={() => setConfirmingClose(false)}
                >
                  Keep working
                </button>
                <button type="button" className="wl-btn-cancel" onClick={onClose}>
                  Close anyway
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};
