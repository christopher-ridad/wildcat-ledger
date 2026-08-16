import React, { useState } from 'react';

import { useLedger } from '../../../hooks/useLedger';
import { Transaction } from '../../../types';
import { TransactionFilesModal } from '../TransactionFilesModal';
import { TransactionModal } from '../TransactionModal';
import { TransactionRow } from '../TransactionRow';
import styles from './TransactionList.module.css';

export const TransactionList = () => {
  const {
    filteredTransactions,
    deleteTransaction,
    canEdit,
    pendingChangeForTransaction,
    approvePendingChange,
    rejectPendingChange,
    cancelPendingChange,
    updatePaymentStatus,
    markTaxReimbursed,
  } = useLedger();
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
      <div className={`${styles['wl-card']} ${styles['wl-empty-state']}`}>
        <p>No transactions match this filter.</p>
      </div>
    );
  }

  return (
    <>
      <div className={`${styles['wl-card']} ${styles['wl-table-card']}`}>
        <div className={styles['wl-table-wrap']}>
          <table className={styles['wl-table']} aria-label="Transactions">
            <thead>
              <tr>
                <th className={styles['wl-th']}>Title</th>
                <th className={styles['wl-th']}>Date</th>
                <th className={styles['wl-th']}>Amount</th>
                <th className={styles['wl-th']}>Type</th>
                <th className={styles['wl-th']}>Status</th>
                <th className={styles['wl-th']}>Budget Line</th>
                {canEdit && <th className={styles['wl-th']}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t) => (
                <React.Fragment key={t.id}>
                  <TransactionRow
                    t={t}
                    canEdit={canEdit}
                    pending={pendingChangeForTransaction(t.id)}
                    onEdit={setEditingTransaction}
                    onDelete={setDeletingTransaction}
                    onApprove={approvePendingChange}
                    onReject={rejectPendingChange}
                    onCancel={cancelPendingChange}
                    onViewFiles={setViewingFilesTransaction}
                    onUpdatePaymentStatus={updatePaymentStatus}
                    onMarkTaxReimbursed={markTaxReimbursed}
                  />
                  {deletingTransaction?.id === t.id && (
                    <tr className={styles['wl-delete-confirm-row']}>
                      <td
                        colSpan={canEdit ? 7 : 6}
                        className={styles['wl-delete-confirm-cell']}
                      >
                        <div
                          className={`${styles['wl-inline-confirm']} ${styles['wl-inline-confirm--inline']}`}
                        >
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
