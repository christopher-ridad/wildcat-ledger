import { useState } from 'react';

import { pluralize } from '../../../../../utils/pluralize';
import { todayDateString } from '../../../../../utils/today';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { useLedger } from '../../../hooks/useLedger';
import { downloadReceiptsZip } from '../../../services/downloadReceiptsZip';
import {
  downloadReconciliationPdf,
  generateReconciliationPdf,
  ReloadChoice,
} from '../../../services/generateReconciliationPdf';
import { Funding, ReconciliationRound } from '../../../types';
import { formatCurrency, formatDate, formatTimestamp } from '../../../utils/calculations';
import { FUNDING_LINES } from '../../../utils/constants';
import { getSupersededReloadIds } from '../../../utils/debitCardReloads';
import styles from './ReconciliationModal.module.css';
import { ReloadFundingChoice } from './ReloadFundingChoice';

interface FinishReconciliationProps {
  round: ReconciliationRound;
  // Just reconciled in this session, as opposed to reopened later.
  justReconciled: boolean;
  onRoundChange: (round: ReconciliationRound) => void;
  onFormDownloaded: () => void;
  onZipDownloaded: () => void;
  onDone: () => void;
}

// The screen after a reconciliation: the reload choice, the reconciliation
// form, and the receipts ZIP for one saved round. Everything here is read
// from and saved back to the round, so it can be reopened later and come
// out the same -- see docs/BUSINESS_RULES.md#revisiting-the-last-reconciliation.
export const FinishReconciliation = ({
  round,
  justReconciled,
  onRoundChange,
  onFormDownloaded,
  onZipDownloaded,
  onDone,
}: FinishReconciliationProps) => {
  const {
    activeOrganization,
    addTransaction,
    generateTransactionId,
    updateReconciliationRound,
  } = useLedger();
  const transactions = activeOrganization?.transactions ?? [];
  const balances = activeOrganization?.budgetAllocations;

  const roundTxns = transactions.filter((t) => round.transactionIds.includes(t.id));
  const totalAmount = roundTxns
    .filter((t) => t.direction === 'Outflow')
    .reduce((sum, t) => sum + t.amount, 0);
  const exemptionCount = roundTxns.filter((t) => t.exemptionFormUrl).length;
  const txnsWithReceipts = roundTxns.filter(
    (t) => t.receiptFileUrl || t.exemptionFormUrl,
  );

  // From the round rather than the ledger: a new reload only shows up in the
  // ledger once Realtime delivers it, and Request Reload mustn't reappear
  // (and be clickable twice) in the meantime.
  // Set the moment the reload is created, before it's saved to the round, so
  // a failed save can't bring Request Reload back and invite a duplicate.
  const [createdReloadId, setCreatedReloadId] = useState<string | null>(null);
  const reloadId = round.reloadTransactionId ?? createdReloadId;
  const reloadRequested = !!reloadId;
  const reloadTxn = transactions.find((t) => t.id === reloadId);
  const reloadSuperseded =
    !!reloadTxn && getSupersededReloadIds(transactions).has(reloadTxn.id);

  const [reloadChoice, setReloadChoice] = useState<ReloadChoice | null>(
    round.reloadChoice ?? (reloadRequested ? 'please-reload' : null),
  );
  const [reloadFunding, setReloadFunding] = useState<Funding | null>(
    reloadTxn?.funding ?? null,
  );
  const [lastReconciliationDateInput, setLastReconciliationDateInput] = useState(
    round.lastReconciliationDate ?? '',
  );
  const reloadAction = useAsyncAction();
  const pdfAction = useAsyncAction();
  const zipAction = useAsyncAction();

  const { formData } = round;
  const askForLastReconciliationDate = !formData.lastReconciliationDate;
  // A reload has to be paid for out of one budget line in full.
  const canFundReload =
    !!balances && FUNDING_LINES.some((line) => balances[line] >= formData.reloadAmount);
  // The form records the reload decision, so it has to be made (and a
  // reload actually requested, if wanted) before the form is generated.
  const canDownloadForm =
    reloadChoice === 'do-not-reload' ||
    (reloadChoice === 'please-reload' && reloadRequested);

  const saveToRound = async (patch: Parameters<typeof updateReconciliationRound>[1]) =>
    onRoundChange(await updateReconciliationRound(round.id, patch));

  const handleRequestReload = async () => {
    if (!reloadFunding) return;
    await reloadAction.run(async () => {
      const newReloadId = generateTransactionId();
      // Always the form's Debit Card Reload Amount: SOFO reloads the full
      // amount owed, never a partial one.
      await addTransaction(
        {
          title: 'Debit Card Reload',
          date: todayDateString(),
          amount: formData.reloadAmount,
          direction: 'Inflow',
          type: 'Journal',
          budgetLine: 'Debit Card',
          funding: reloadFunding,
          notes: `Requested after reconciling ${round.transactionIds.length} ${pluralize(round.transactionIds.length, 'transaction')} (${formatCurrency(totalAmount)} total).`,
        },
        newReloadId,
      );
      setCreatedReloadId(newReloadId);
      try {
        await saveToRound({
          reloadChoice: 'please-reload',
          reloadTransactionId: newReloadId,
        });
      } catch {
        throw new Error(
          "The reload was requested, but it couldn't be saved to this reconciliation. Don't request it again.",
        );
      }
    }, 'Reload request failed.');
  };

  const handleDownloadForm = async () => {
    if (!reloadChoice) return;
    await pdfAction.run(async () => {
      const lastReconciliationDate =
        formData.lastReconciliationDate ?? (lastReconciliationDateInput || undefined);
      const blob = await generateReconciliationPdf(
        { ...formData, lastReconciliationDate },
        reloadChoice,
      );
      downloadReconciliationPdf(blob, formData.orgName);
      onFormDownloaded();
      await saveToRound({
        reloadChoice,
        ...(askForLastReconciliationDate && {
          lastReconciliationDate: lastReconciliationDateInput || undefined,
        }),
      });
    }, 'Could not generate the reconciliation form.');
  };

  const handleDownloadZip = async () => {
    await zipAction.run(async () => {
      await downloadReceiptsZip(txnsWithReceipts);
      onZipDownloaded();
    }, 'Could not generate ZIP.');
  };

  const reloadStatus = reloadSuperseded
    ? 'Superseded by a newer reload request'
    : reloadTxn?.paymentStatus === 'Paid'
      ? 'Reloaded'
      : 'Pending until SOFO puts the money on the card';

  return (
    <>
      <div className={styles['wl-recon-success']}>
        <span className={styles['wl-recon-success-icon']}>✓</span>
        <p className={styles['wl-recon-success-title']}>
          {justReconciled
            ? 'Reconciliation complete!'
            : `Reconciled ${formatTimestamp(round.reconciledAt)}`}
        </p>
        <div className={styles['wl-recon-success-stats']}>
          <div className={styles['wl-recon-success-stat']}>
            <span className={styles['wl-recon-success-stat-value']}>
              {round.transactionIds.length}
            </span>
            <span className={styles['wl-recon-success-stat-label']}>
              {pluralize(round.transactionIds.length, 'transaction')}
            </span>
          </div>
          <div className={styles['wl-recon-success-stat']}>
            <span className={styles['wl-recon-success-stat-value']}>
              {formatCurrency(totalAmount)}
            </span>
            <span className={styles['wl-recon-success-stat-label']}>total</span>
          </div>
          {exemptionCount > 0 && (
            <div className={styles['wl-recon-success-stat']}>
              <span className={styles['wl-recon-success-stat-value']}>
                {exemptionCount}
              </span>
              <span className={styles['wl-recon-success-stat-label']}>
                {pluralize(exemptionCount, 'exemption')}
              </span>
            </div>
          )}
        </div>
      </div>

      <ul className={styles['wl-recon-round-list']} aria-label="Reconciled transactions">
        {roundTxns.map((t) => (
          <li key={t.id} className={styles['wl-recon-round-item']}>
            <span className={styles['wl-recon-row-date']}>{formatDate(t.date)}</span>
            <span className={styles['wl-recon-row-title']}>{t.title}</span>
            <span className={styles['wl-recon-row-amount']}>
              {t.direction === 'Outflow' ? '−' : '+'}
              {formatCurrency(t.amount)}
            </span>
          </li>
        ))}
      </ul>

      <div className={styles['wl-recon-reload']}>
        <h3 className={styles['wl-recon-reload-title']}>Debit Card Reload</h3>
        {askForLastReconciliationDate && (
          <div className="wl-form-group">
            <label className="wl-form-label" htmlFor="last-reconciliation-date">
              Date of Last Reconciliation
            </label>
            <input
              id="last-reconciliation-date"
              type="date"
              className="wl-form-input"
              max={formData.balanceAsOfDate}
              value={lastReconciliationDateInput}
              onChange={(e) => setLastReconciliationDateInput(e.target.value)}
            />
            <p className={styles['wl-recon-reload-hint']}>
              This is the first reconciliation in WildcatLedger. If this card was
              reconciled before, enter that date; leave it blank if it never has been.
            </p>
          </div>
        )}

        <fieldset className={styles['wl-recon-reload-choice']} disabled={reloadRequested}>
          <legend className="wl-form-label">Do you want SOFO to reload the card?</legend>
          <label className={styles['wl-recon-reload-option']}>
            <input
              type="radio"
              name="reload-choice"
              checked={reloadChoice === 'please-reload'}
              disabled={!canFundReload && !reloadRequested}
              onChange={() => setReloadChoice('please-reload')}
            />
            <span>Please reload {formatCurrency(formData.reloadAmount)}</span>
          </label>
          {!canFundReload && !reloadRequested && (
            <p className={styles['wl-recon-reload-hint']}>
              None of ASG, Operating, or Gifts has {formatCurrency(formData.reloadAmount)}{' '}
              to pay for a reload right now.
            </p>
          )}
          {formData.completedReconciliationsPendingReload > 0 && (
            <p className={styles['wl-recon-reload-hint']}>
              This round&apos;s {formatCurrency(formData.reconciliationSubtotal)} plus{' '}
              {formatCurrency(formData.completedReconciliationsPendingReload)} from an
              earlier reconciliation that hasn&apos;t been reloaded yet.
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

        {reloadChoice === 'please-reload' && balances && (
          <ReloadFundingChoice
            amount={formData.reloadAmount}
            balances={balances}
            value={reloadFunding}
            onChange={setReloadFunding}
            disabled={reloadRequested}
          />
        )}

        {reloadChoice === 'please-reload' &&
          (reloadRequested ? (
            <p className={styles['wl-recon-reload-confirm']}>
              ✓ Reload requested: {reloadStatus}.
            </p>
          ) : (
            <button
              type="button"
              className={styles['wl-btn-download-zip']}
              onClick={handleRequestReload}
              disabled={reloadAction.pending || !reloadFunding}
            >
              {reloadAction.pending ? 'Submitting…' : 'Request Reload'}
            </button>
          ))}
        {reloadAction.error && <div className="wl-form-error">{reloadAction.error}</div>}
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
        {txnsWithReceipts.length > 0 && (
          <button
            type="button"
            className={styles['wl-btn-download-zip']}
            onClick={handleDownloadZip}
            disabled={zipAction.pending}
          >
            {zipAction.pending
              ? 'Bundling…'
              : `⬇ Receipts ZIP (${txnsWithReceipts.length})`}
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
        <button type="button" className="wl-btn-primary" onClick={onDone}>
          Done
        </button>
      </div>
    </>
  );
};
