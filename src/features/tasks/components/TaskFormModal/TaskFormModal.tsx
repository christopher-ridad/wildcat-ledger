import { useState } from 'react';

import { SUPPORTED_TYPES } from '../../../ledger/components/Dashboard/AddTransactionForm/types';
import { Modal } from '../../../ledger/components/Dashboard/Modal';
import { useAsyncAction } from '../../../ledger/hooks/useAsyncAction';
import { useResetOnOpen } from '../../../ledger/hooks/useResetOnOpen';
import { TransactionType } from '../../../ledger/types';
import { FinancialTask } from '../../types';
import {
  academicYearStartOf,
  isDateInSupportedQuarter,
} from '../../utils/groupTasksByQuarter';
import { todayDateString } from '../../utils/today';
import styles from './TaskFormModal.module.css';

// Deposits are a Debit Card reload, not something an org ever needs a
// to-do reminder to submit paperwork for -- exclude it here without
// touching SUPPORTED_TYPES itself, which AddTransactionForm still needs
// the full list from.
const TASK_PAYMENT_TYPES = SUPPORTED_TYPES.filter((type) => type !== 'Deposit');

// Outside the academic year (before Fall starts or after Spring ends, see
// isDateInSupportedQuarter) a task's due date would silently never show up
// under any quarter tab, so the form refuses it outright instead of
// accepting one that just disappears.
const UNSUPPORTED_MONTH_MESSAGE =
  'Due date must fall between September 23 and June 11. Financial Tasks doesn’t track dates over the summer.';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: FinancialTask;
  rosterEmails: string[];
  peopleNames: Record<string, string>;
  onSave: (task: {
    title: string;
    description?: string;
    dueDate: string;
    assigneeEmails: string[];
    paymentType?: TransactionType;
    isIndividualVendor?: boolean;
  }) => Promise<void>;
}

export const TaskFormModal = ({
  isOpen,
  onClose,
  task,
  rosterEmails,
  peopleNames,
  onSave,
}: TaskFormModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeEmails, setAssigneeEmails] = useState<string[]>([]);
  const [paymentType, setPaymentType] = useState<TransactionType | ''>('');
  const [isIndividualVendor, setIsIndividualVendor] = useState(false);
  const saveAction = useAsyncAction();

  useResetOnOpen(isOpen, () => {
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setDueDate(task?.dueDate ?? '');
    setAssigneeEmails(task?.assigneeEmails ?? []);
    setPaymentType(task?.paymentType ?? '');
    setIsIndividualVendor(task?.isIndividualVendor ?? false);
    saveAction.setError(null);
  }, [task]);

  // Matches the guard on the delete-confirmation dialog: Modal's Escape/
  // overlay-click both route through onClose too, not just the Cancel
  // button, so this needs the same in-flight guard the explicit Cancel
  // button gets via its `disabled` prop.
  const handleClose = () => {
    if (saveAction.pending) return;
    onClose();
  };

  const toggleAssignee = (email: string) => {
    setAssigneeEmails((current) =>
      current.includes(email) ? current.filter((e) => e !== email) : [...current, email],
    );
  };

  const handleDueDateChange = (value: string) => {
    if (value && !isDateInSupportedQuarter(value)) {
      saveAction.setError(UNSUPPORTED_MONTH_MESSAGE);
      return;
    }
    saveAction.setError(null);
    setDueDate(value);
  };

  const handleSave = async () => {
    if (!title.trim() || !dueDate) {
      saveAction.setError('Title and due date are required.');
      return;
    }
    if (!isDateInSupportedQuarter(dueDate)) {
      saveAction.setError(UNSUPPORTED_MONTH_MESSAGE);
      return;
    }
    await saveAction.run(async () => {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        assigneeEmails,
        paymentType: paymentType || undefined,
        isIndividualVendor:
          paymentType === 'Payment Request' ? isIndividualVendor : undefined,
      });
      onClose();
    }, 'Failed to save. Try again.');
  };

  // The task's current assignees stay selectable even if they've since left
  // the roster, so editing an existing task never silently drops them.
  const assigneeOptions = [
    ...rosterEmails,
    ...(task?.assigneeEmails ?? []).filter((email) => !rosterEmails.includes(email)),
  ];

  // The supported range (Sep 23 -> Jun 11, see isDateInSupportedQuarter) is
  // one contiguous span across the academic year, so min/max fully express
  // it -- this is what actually grays out the unselectable days in the
  // native calendar popup, not just the onChange/save-time rejection above
  // (which still matters for a typed-in date the picker itself can't stop).
  const [todayYear, todayMonth] = todayDateString().split('-').map(Number);
  const currentYearStart = academicYearStartOf(todayYear, todayMonth);
  const minDueDate = `${currentYearStart}-09-23`;
  const maxDueDate = `${currentYearStart + 1}-06-11`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      titleId="task-form-title"
      title={task ? 'Edit Task' : 'Add Task'}
    >
      <div className={styles['wl-task-form-fields']}>
        <div className="wl-form-group">
          <label className="wl-form-label" htmlFor="task-title">
            Title
          </label>
          <input
            id="task-title"
            type="text"
            className="wl-form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Submit Contract for..."
          />
        </div>

        <div className="wl-form-group">
          <label className="wl-form-label" htmlFor="task-due-date">
            Due Date
          </label>
          <input
            id="task-due-date"
            type="date"
            className="wl-form-input"
            value={dueDate}
            min={minDueDate}
            max={maxDueDate}
            onChange={(e) => handleDueDateChange(e.target.value)}
          />
        </div>

        <div className="wl-form-group">
          <label className="wl-form-label" htmlFor="task-payment-type">
            Payment Type (optional)
          </label>
          <select
            id="task-payment-type"
            className={styles['wl-form-select']}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as TransactionType | '')}
          >
            <option value="">No payment type</option>
            {TASK_PAYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {paymentType === 'Payment Request' && (
            <label className={styles['wl-form-checkbox']}>
              <input
                type="checkbox"
                checked={isIndividualVendor}
                onChange={(e) => setIsIndividualVendor(e.target.checked)}
              />
              <span>Is this an individual vendor?</span>
            </label>
          )}

          {paymentType && (
            <p className={styles['wl-form-hint']}>
              We&rsquo;ll automatically add the required documents for {paymentType} to
              this task&rsquo;s checklist.
            </p>
          )}
        </div>

        <div className="wl-form-group">
          <label className="wl-form-label" htmlFor="task-description">
            Description (optional)
          </label>
          <textarea
            id="task-description"
            className={styles['wl-form-textarea']}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="wl-form-group">
          <span className="wl-form-label" id="task-assignees-label">
            Assign to (optional)
          </span>
          {assigneeOptions.length === 0 ? (
            <p className={styles['wl-form-hint']}>No one on the roster yet.</p>
          ) : (
            <div
              className={styles['wl-assignee-list']}
              role="group"
              aria-labelledby="task-assignees-label"
            >
              {assigneeOptions.map((email) => (
                <label key={email} className={styles['wl-assignee-option']}>
                  <input
                    type="checkbox"
                    checked={assigneeEmails.includes(email)}
                    onChange={() => toggleAssignee(email)}
                  />
                  <span>{peopleNames[email] ?? email}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {saveAction.error && <div className="wl-form-error">{saveAction.error}</div>}

      <div className={styles['wl-task-form-actions']}>
        <button
          type="button"
          className="wl-btn-primary"
          onClick={handleSave}
          disabled={saveAction.pending}
        >
          {saveAction.pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="wl-btn-cancel"
          onClick={onClose}
          disabled={saveAction.pending}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};
