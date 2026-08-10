import { useState } from 'react';

import { useAuth } from '../../../../authentication/hooks/useAuth';
import { PaymentStatus, PendingChange, Transaction } from '../../../types';
import { formatCurrency } from '../../../utils/calculations';
import { diffChangedKeys } from '../../../utils/diff';
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

const PAYMENT_STATUS_TYPES: Transaction['type'][] = ['Direct payment', 'Reimbursement'];

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
}) => {
  const [showDetail, setShowDetail] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const isInflow = t.direction === 'Inflow';
  const fileCount = getTransactionFiles(t).length;
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
    onUpdatePaymentStatus(t.id, status).finally(() => setStatusUpdating(false));
  };

  const colSpan = canEdit ? 6 : 5;
  const isReconciled = t.budgetLine === 'Debit Card' && t.reconciledAt != null;
  const paymentStatus = PAYMENT_STATUS_TYPES.includes(t.type)
    ? (t.paymentStatus ?? 'Pending')
    : null;

  const changedKeys =
    pending?.type === 'edit' ? diffChangedKeys(pending.before, pending.after) : [];

  return (
    <>
      <tr className={pending ? styles['wl-row--pending'] : ''}>
        <td className={`${styles['wl-td']} ${styles['wl-td-title']}`}>
          <span className={styles['wl-td-title-text']}>{t.title}</span>
          {isReconciled && (
            <span className={styles['wl-reconciled-badge']}>Reconciled</span>
          )}
          {paymentStatus &&
            (canEdit && !pending ? (
              <select
                aria-label="Payment status"
                className={`${styles['wl-status-select']} ${STATUS_BADGE_CLASS[paymentStatus]}`}
                value={paymentStatus}
                disabled={statusUpdating}
                onChange={(e) => handleStatusChange(e.target.value as PaymentStatus)}
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid</option>
              </select>
            ) : (
              <span
                className={`${styles['wl-status-badge']} ${STATUS_BADGE_CLASS[paymentStatus]}`}
              >
                {paymentStatus}
              </span>
            ))}
          {pending && (
            <span className={styles['wl-pending-type-badge']}>
              {pending.type === 'delete' ? 'Delete requested' : 'Edit requested'}
            </span>
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
                {fileCount > 0 && (
                  <button
                    type="button"
                    className={styles['wl-action-btn']}
                    onClick={() => onViewFiles(t)}
                    aria-label={`View ${fileCount} attached file${fileCount !== 1 ? 's' : ''}`}
                    title="View attached files"
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
