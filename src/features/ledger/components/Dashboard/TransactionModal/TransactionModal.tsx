import { useEffect } from 'react';

import { Transaction } from '../../../types';
import { AddTransactionForm } from '../AddTransactionForm';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTransaction?: Transaction;
}

export const TransactionModal = ({
  isOpen,
  onClose,
  existingTransaction,
}: TransactionModalProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="wl-modal-root">
      <div className="wl-modal-overlay" aria-hidden="true" onClick={onClose} />
      <div
        className="wl-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="wl-modal-header">
          <h2 id="modal-title" className="wl-modal-title">
            {existingTransaction ? 'Edit Transaction' : 'Add Transaction'}
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
          <AddTransactionForm
            onSuccess={onClose}
            existingTransaction={existingTransaction}
          />
        </div>
      </div>
    </div>
  );
};
