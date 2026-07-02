import React, { useEffect, useState } from 'react';

import { useAuth } from '../hooks/useAuth';
import { useLedger } from '../hooks/useLedger';
import { PendingChange, Transaction } from '../types';
import { formatCurrency } from '../utilities/calculations';
import { diffChangedKeys } from '../utilities/diff';
import { getSignedFileUrl } from '../utilities/storage';
import { TransactionModal } from './TransactionModal';

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};

const FILE_LABELS: { key: keyof Transaction; label: string }[] = [
  { key: 'receiptFileUrl', label: 'Receipt' },
  { key: 'contractFileUrl', label: 'RSO Agreement / Contract' },
  { key: 'w9FileUrl', label: 'W-9 Form' },
  { key: 'contractedServicesFileUrl', label: 'Contracted Services Form' },
  { key: 'conflictOfInterestFileUrl', label: 'Conflict of Interest Form' },
];

const getTransactionFiles = (t: Transaction) =>
  FILE_LABELS.flatMap(({ key, label }) => {
    const url = t[key];
    return typeof url === 'string' ? [{ label, url }] : [];
  });

const FilePreviewCard = ({ label, url: path }: { label: string; url: string }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSignedFileUrl(path)
      .then((url) => {
        if (!cancelled) setSignedUrl(url);
      })
      .catch(() => {
        if (!cancelled) setImgFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div className="wl-file-card">
      <div className="wl-file-card-label">{label}</div>
      {!imgFailed && signedUrl ? (
        <img
          src={signedUrl}
          alt={label}
          className="wl-file-preview-img"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="wl-file-pdf-placeholder">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
          <span>PDF Document</span>
        </div>
      )}
      {signedUrl && (
        <a
          href={signedUrl}
          target="_blank"
          rel="noreferrer"
          className="wl-file-open-link"
        >
          Open in new tab ↗
        </a>
      )}
    </div>
  );
};

const TransactionFilesModal = ({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) => {
  const files = getTransactionFiles(transaction);

  return (
    <div className="wl-modal-root" role="dialog" aria-modal="true">
      <div
        className="wl-modal-overlay"
        role="button"
        tabIndex={0}
        aria-label="Close"
        onClick={onClose}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClose()}
      />
      <div className="wl-modal wl-files-modal">
        <div className="wl-modal-header">
          <h2 className="wl-modal-title">Attachments — {transaction.title}</h2>
          <button className="wl-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="wl-modal-body">
          {files.length === 0 ? (
            <p className="wl-files-empty">No files attached to this transaction.</p>
          ) : (
            <div className="wl-files-grid">
              {files.map(({ label, url }) => (
                <FilePreviewCard key={label} label={label} url={url} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TransactionRow = ({
  t,
  canEdit,
  pending,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onCancel,
  onViewFiles,
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
}) => {
  const [showDetail, setShowDetail] = useState(false);
  const [actioning, setActioning] = useState(false);
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
  const colSpan = canEdit ? 6 : 5;
  const isReconciled = t.budgetLine === 'Debit Card' && t.reconciledAt != null;

  const changedKeys =
    pending?.type === 'edit' ? diffChangedKeys(pending.before, pending.after) : [];

  return (
    <>
      <tr className={pending ? 'wl-row--pending' : ''}>
        <td className="wl-td wl-td-title">
          <span className="wl-td-title-text">{t.title}</span>
          {isReconciled && <span className="wl-reconciled-badge">Reconciled</span>}
          {pending && (
            <span className="wl-pending-type-badge">
              {pending.type === 'delete' ? 'Delete requested' : 'Edit requested'}
            </span>
          )}
        </td>
        <td className="wl-td wl-td-date">{formatDate(t.date)}</td>
        <td
          className={`wl-td wl-td-amount ${isInflow ? 'wl-amount-positive' : 'wl-amount-negative'}`}
        >
          {isInflow ? '+' : '-'}
          {formatCurrency(t.amount)}
        </td>
        <td className="wl-td wl-td-type">{t.type}</td>
        <td className="wl-td wl-td-budget">
          <span className="wl-budget-chip">{t.budgetLine}</span>
        </td>
        {canEdit && (
          <td className="wl-td wl-td-actions">
            {pending ? (
              isMyPending ? (
                <div className="wl-approve-actions">
                  <span className="wl-pending-badge">Awaiting Approval</span>
                  <button
                    type="button"
                    className="wl-btn-reject"
                    disabled={actioning}
                    onClick={() => handleAction(onCancel, pending.id)}
                  >
                    {actioning ? '…' : 'Cancel'}
                  </button>
                </div>
              ) : canApprove ? (
                <div className="wl-approve-actions">
                  {pending.type === 'edit' && (
                    <button
                      type="button"
                      className="wl-btn-view-details"
                      onClick={() => setShowDetail((v) => !v)}
                    >
                      {showDetail ? 'Hide' : 'View details'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="wl-btn-approve"
                    disabled={actioning}
                    onClick={() => handleAction(onApprove, pending.id)}
                  >
                    {actioning ? '…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className="wl-btn-reject"
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
                    className="wl-action-btn"
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
                      className="wl-action-btn"
                      onClick={() => onEdit(t)}
                      aria-label="Edit transaction"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="wl-action-btn wl-action-btn--delete"
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
        <tr className="wl-pending-detail-row">
          <td colSpan={colSpan} className="wl-pending-detail-cell">
            {pending.type === 'delete' ? (
              <p className="wl-pending-detail-delete">
                This transaction will be <strong>permanently deleted</strong> if approved.
              </p>
            ) : changedKeys.length > 0 ? (
              <div className="wl-pending-detail-diff">
                <div className="wl-pending-detail-col wl-pending-detail-col--before">
                  <span className="wl-pending-detail-label">Before</span>
                  {changedKeys.map((k) => (
                    <div key={k} className="wl-pending-detail-row-item">
                      <span className="wl-pending-detail-field">{k}</span>
                      <span className="wl-pending-detail-value wl-pending-detail-value--before">
                        {String((pending.before as Record<string, unknown>)[k] ?? '—')}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="wl-pending-detail-col wl-pending-detail-col--after">
                  <span className="wl-pending-detail-label">After</span>
                  {changedKeys.map((k) => (
                    <div key={k} className="wl-pending-detail-row-item">
                      <span className="wl-pending-detail-field">{k}</span>
                      <span className="wl-pending-detail-value wl-pending-detail-value--after">
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

export const TransactionList = () => {
  const {
    filteredTransactions,
    deleteTransaction,
    userRole,
    pendingChanges,
    approvePendingChange,
    rejectPendingChange,
    cancelPendingChange,
  } = useLedger();
  const canEdit = userRole === 'treasurer' || userRole === 'president';
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(
    null,
  );
  const [viewingFilesTransaction, setViewingFilesTransaction] =
    useState<Transaction | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deletingTransaction) return;
    await deleteTransaction(deletingTransaction.id);
    setDeletingTransaction(null);
  };

  if (filteredTransactions.length === 0) {
    return (
      <div className="wl-card wl-empty-state">
        <p>No transactions match this filter.</p>
      </div>
    );
  }

  return (
    <>
      <div className="wl-card wl-table-card">
        <div className="wl-table-wrap">
          <table className="wl-table" aria-label="Transactions">
            <thead>
              <tr>
                <th className="wl-th">Title</th>
                <th className="wl-th">Date</th>
                <th className="wl-th">Amount</th>
                <th className="wl-th">Type</th>
                <th className="wl-th">Budget Line</th>
                {canEdit && <th className="wl-th">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t) => (
                <React.Fragment key={t.id}>
                  <TransactionRow
                    t={t}
                    canEdit={canEdit}
                    pending={pendingChanges.find((p) => p.transactionId === t.id)}
                    onEdit={setEditingTransaction}
                    onDelete={setDeletingTransaction}
                    onApprove={approvePendingChange}
                    onReject={rejectPendingChange}
                    onCancel={cancelPendingChange}
                    onViewFiles={setViewingFilesTransaction}
                  />
                  {deletingTransaction?.id === t.id && (
                    <tr className="wl-delete-confirm-row">
                      <td colSpan={canEdit ? 6 : 5} className="wl-delete-confirm-cell">
                        <div className="wl-inline-confirm wl-inline-confirm--inline">
                          <p>
                            Submit a delete request for <strong>{t.title}</strong>?<br />
                            The other approver will need to confirm before it is removed.
                          </p>
                          <div className="wl-overdraft-actions">
                            <button
                              type="button"
                              className="wl-btn-warning"
                              style={{ background: '#dc2626' }}
                              onClick={handleDeleteConfirm}
                            >
                              Submit Request
                            </button>
                            <button
                              type="button"
                              className="wl-btn-cancel"
                              onClick={() => setDeletingTransaction(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionModal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        existingTransaction={editingTransaction ?? undefined}
      />

      {viewingFilesTransaction && (
        <TransactionFilesModal
          transaction={viewingFilesTransaction}
          onClose={() => setViewingFilesTransaction(null)}
        />
      )}
    </>
  );
};
