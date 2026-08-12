import { useState } from 'react';

import { useAuth } from '../../../../authentication/hooks/useAuth';
import { PaymentStatus, PendingChange, Transaction } from '../../../types';
import { formatCurrency } from '../../../utils/calculations';
import { SOFO_SALES_TAX_REIMBURSEMENT_URL } from '../../../utils/constants';
import { diffChangedKeys } from '../../../utils/diff';
import { getMissingDocuments } from '../../../utils/documentRequirements';
import { getTransactionFiles } from '../TransactionFilesModal';
import styles from './TransactionRow.module.css';

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};

const STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
  Pending: styles['wl-status-badge--pending'],
  Approved: styles['wl-status-badge--approved'],
  Paid: styles['wl-status-badge--paid'],
};

const PAYMENT_STATUS_TYPES: Transaction['type'][] = [
  'Payment Request',
  'Non-Officer Reimbursement',
  'Payment to NU Employee',
];

// Reload deposits skip the "Approved" middle state — approving a reload IS
// reloading it, there's no separate paid-out step — so they only ever go
// Pending -> Paid, and "Paid" reads as "Reloaded" for that transaction type.
const statusLabel = (status: PaymentStatus, isReloadDeposit: boolean) =>
  isReloadDeposit && status === 'Paid' ? 'Reloaded' : status;

export const TransactionRow = ({
  t,
  canEdit,
  pending,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onCancel,
  onViewFiles,
  onUpdatePaymentStatus,
  onMarkTaxReimbursed,
}: {
  t: Transaction;
  canEdit: boolean;
  pending: PendingChange | undefined;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onApprove: (pendingId: string) => Promise<void>;
  onReject: (pendingId: string) => Promise<void>;
  onCancel: (pendingId: string) => Promise<void>;
  onViewFiles: (t: Transaction) => void;
  onUpdatePaymentStatus: (transactionId: string, status: PaymentStatus) => Promise<void>;
  onMarkTaxReimbursed: (transactionId: string) => Promise<void>;
}) => {
  const [showDetail, setShowDetail] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [reimbursing, setReimbursing] = useState(false);
  const isInflow = t.direction === 'Inflow';
  const fileCount = getTransactionFiles(t).length;
  const missingDocs = getMissingDocuments(t);
  const { user } = useAuth();
  const currentEmail = user?.email;
  const isMyPending = !!pending && pending.requestedBy === currentEmail;
  const canApprove = !!pending && !isMyPending && canEdit;

  const handleAction = (fn: (id: string) => Promise<void>, id: string) => {
    if (actioning) return;
    setActioning(true);
    fn(id).finally(() => setActioning(false));
  };

  const handleStatusChange = (status: PaymentStatus) => {
    setStatusUpdating(true);
    setStatusError(null);
    onUpdatePaymentStatus(t.id, status)
      .catch((err) => {
        setStatusError(err instanceof Error ? err.message : 'Failed to update status.');
      })
      .finally(() => setStatusUpdating(false));
  };

  const handleMarkReimbursed = () => {
    setReimbursing(true);
    onMarkTaxReimbursed(t.id).finally(() => setReimbursing(false));
  };

  const colSpan = canEdit ? 7 : 6;
  // Debit Card purchases should never carry tax (orgs are tax-exempt when
  // the exemption form is presented at purchase). When it happens anyway,
  // flag it until self-attested as reimbursed to SOFO -- the actual
  // payment happens on SOFO's own external form, no integration here.
  const needsTaxReimbursement =
    t.type === 'Debit Card' &&
    !t.taxExemptFormSubmitted &&
    (t.taxAmount ?? 0) > 0 &&
    !t.taxReimbursed;
  // A Deposit on the Debit Card line is a reload — it goes through the same
  // payment-status lifecycle as Direct Payment/Reimbursement, not
  // reconciliation (that's only for purchases needing a receipt).
  const isReloadDeposit = t.budgetLine === 'Debit Card' && t.type === 'Deposit';
  const isDebitCardPurchase = t.budgetLine === 'Debit Card' && !isReloadDeposit;
  const isReconciled = isDebitCardPurchase && t.reconciledAt != null;
  const paymentStatus =
    PAYMENT_STATUS_TYPES.includes(t.type) || isReloadDeposit
      ? (t.paymentStatus ?? 'Pending')
      : null;

  const changedKeys =
    pending?.type === 'edit' ? diffChangedKeys(pending.before, pending.after) : [];

  return (
    <>
      <tr className={pending ? styles['wl-row--pending'] : ''}>
        <td className={`${styles['wl-td']} ${styles['wl-td-title']}`}>
          <span className={styles['wl-td-title-text']}>{t.title}</span>
          {pending && (
            <span className={styles['wl-pending-type-badge']}>
              {pending.type === 'delete' ? 'Delete requested' : 'Edit requested'}
            </span>
          )}
          {missingDocs.length > 0 && (
            <div className={styles['wl-missing-docs-badge']}>
              ⚠ Missing: {missingDocs.map((d) => d.label).join(', ')}
            </div>
          )}
          {needsTaxReimbursement && (
            <div className={styles['wl-tax-owed']}>
              <span className={styles['wl-tax-owed-badge']}>
                ⚠ Tax owed: {formatCurrency(t.taxAmount ?? 0)}
              </span>
              {canEdit && (
                <>
                  <a
                    href={SOFO_SALES_TAX_REIMBURSEMENT_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={styles['wl-tax-owed-link']}
                  >
                    Submit to SOFO ↗
                  </a>
                  <button
                    type="button"
                    className={styles['wl-tax-owed-mark-btn']}
                    disabled={reimbursing}
                    onClick={handleMarkReimbursed}
                  >
                    {reimbursing ? 'Marking…' : 'Mark as Reimbursed'}
                  </button>
                </>
              )}
            </div>
          )}
        </td>
        <td className={`${styles['wl-td']} ${styles['wl-td-date']}`}>
          {formatDate(t.date)}
        </td>
        <td
          className={`${styles['wl-td']} ${styles['wl-td-amount']} ${isInflow ? 'wl-amount-positive' : 'wl-amount-negative'}`}
        >
          {isInflow ? '+' : '-'}
          {formatCurrency(t.amount)}
        </td>
        <td className={`${styles['wl-td']} ${styles['wl-td-type']}`}>{t.type}</td>
        <td className={`${styles['wl-td']} ${styles['wl-td-status']}`}>
          {isDebitCardPurchase ? (
            <span
              className={
                isReconciled
                  ? styles['wl-reconciled-badge']
                  : styles['wl-not-reconciled-badge']
              }
            >
              {isReconciled ? 'Reconciled' : 'Not Reconciled'}
            </span>
          ) : paymentStatus ? (
            canEdit && !pending ? (
              <>
                <select
                  aria-label="Payment status"
                  className={`${styles['wl-status-select']} ${STATUS_BADGE_CLASS[paymentStatus]}`}
                  value={paymentStatus}
                  disabled={statusUpdating}
                  onChange={(e) => handleStatusChange(e.target.value as PaymentStatus)}
                >
                  <option value="Pending">Pending</option>
                  {!isReloadDeposit && <option value="Approved">Approved</option>}
                  <option value="Paid">{statusLabel('Paid', isReloadDeposit)}</option>
                </select>
                {statusError && (
                  <div className={styles['wl-status-error']} role="alert">
                    {statusError}
                  </div>
                )}
              </>
            ) : (
              <span
                className={`${styles['wl-status-badge']} ${STATUS_BADGE_CLASS[paymentStatus]}`}
              >
                {statusLabel(paymentStatus, isReloadDeposit)}
              </span>
            )
          ) : (
            <span className={styles['wl-status-empty']}>—</span>
          )}
        </td>
        <td className={`${styles['wl-td']} ${styles['wl-td-budget']}`}>
          <span className={styles['wl-budget-chip']}>{t.budgetLine}</span>
        </td>
        {canEdit && (
          <td className={`${styles['wl-td']} ${styles['wl-td-actions']}`}>
            {pending ? (
              isMyPending ? (
                <div className={styles['wl-approve-actions']}>
                  <span className={styles['wl-pending-badge']}>Awaiting Approval</span>
                  <button
                    type="button"
                    className={styles['wl-btn-reject']}
                    disabled={actioning}
                    onClick={() => handleAction(onCancel, pending.id)}
                  >
                    {actioning ? '…' : 'Cancel'}
                  </button>
                </div>
              ) : canApprove ? (
                <div className={styles['wl-approve-actions']}>
                  {pending.type === 'edit' && (
                    <button
                      type="button"
                      className={styles['wl-btn-view-details']}
                      onClick={() => setShowDetail((v) => !v)}
                    >
                      {showDetail ? 'Hide' : 'View details'}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles['wl-btn-approve']}
                    disabled={actioning}
                    onClick={() => handleAction(onApprove, pending.id)}
                  >
                    {actioning ? '…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className={styles['wl-btn-reject']}
                    disabled={actioning}
                    onClick={() => handleAction(onReject, pending.id)}
                  >
                    {actioning ? '…' : 'Reject'}
                  </button>
                </div>
              ) : null
            ) : (
              <>
                {(fileCount > 0 || missingDocs.length > 0) && (
                  <button
                    type="button"
                    className={styles['wl-action-btn']}
                    onClick={() => onViewFiles(t)}
                    aria-label={
                      fileCount > 0
                        ? `View ${fileCount} attached file${fileCount !== 1 ? 's' : ''}`
                        : 'View missing documents'
                    }
                    title="View documents"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                )}
                {!isReconciled && (
                  <>
                    <button
                      type="button"
                      className={styles['wl-action-btn']}
                      onClick={() => onEdit(t)}
                      aria-label="Edit transaction"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={`${styles['wl-action-btn']} ${styles['wl-action-btn--delete']}`}
                      onClick={() => onDelete(t)}
                      aria-label="Delete transaction"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </>
                )}
              </>
            )}
          </td>
        )}
      </tr>
      {canApprove && showDetail && (
        <tr className={styles['wl-pending-detail-row']}>
          <td colSpan={colSpan} className={styles['wl-pending-detail-cell']}>
            {pending.type === 'delete' ? (
              <p className={styles['wl-pending-detail-delete']}>
                This transaction will be <strong>permanently deleted</strong> if approved.
              </p>
            ) : changedKeys.length > 0 ? (
              <div className={styles['wl-pending-detail-diff']}>
                <div
                  className={`${styles['wl-pending-detail-col']} ${styles['wl-pending-detail-col--before']}`}
                >
                  <span className={styles['wl-pending-detail-label']}>Before</span>
                  {changedKeys.map((k) => (
                    <div key={k} className={styles['wl-pending-detail-row-item']}>
                      <span className={styles['wl-pending-detail-field']}>{k}</span>
                      <span
                        className={`${styles['wl-pending-detail-value']} ${styles['wl-pending-detail-value--before']}`}
                      >
                        {String((pending.before as Record<string, unknown>)[k] ?? '—')}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  className={`${styles['wl-pending-detail-col']} ${styles['wl-pending-detail-col--after']}`}
                >
                  <span className={styles['wl-pending-detail-label']}>After</span>
                  {changedKeys.map((k) => (
                    <div key={k} className={styles['wl-pending-detail-row-item']}>
                      <span className={styles['wl-pending-detail-field']}>{k}</span>
                      <span
                        className={`${styles['wl-pending-detail-value']} ${styles['wl-pending-detail-value--after']}`}
                      >
                        {String((pending.after as Record<string, unknown>)[k] ?? '—')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </td>
        </tr>
      )}
    </>
  );
};
