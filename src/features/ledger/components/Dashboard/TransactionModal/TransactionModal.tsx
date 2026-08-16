import { Transaction } from '../../../types';
import { AddTransactionForm } from '../AddTransactionForm';
import { Modal } from '../Modal';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTransaction?: Transaction;
}

export const TransactionModal = ({
  isOpen,
  onClose,
  existingTransaction,
}: TransactionModalProps) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    titleId="modal-title"
    title={existingTransaction ? 'Edit Transaction' : 'Add Transaction'}
  >
    <AddTransactionForm onSuccess={onClose} existingTransaction={existingTransaction} />
  </Modal>
);
