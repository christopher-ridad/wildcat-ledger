import { useState } from 'react';

import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { useResetOnOpen } from '../../../hooks/useResetOnOpen';
import { FinancialTask } from '../../../types';
import { Modal } from '../../Dashboard/Modal';
import styles from './TaskFormModal.module.css';

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
    assigneeEmail?: string;
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
  const [assigneeEmail, setAssigneeEmail] = useState('');
  const saveAction = useAsyncAction();

  useResetOnOpen(isOpen, () => {
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setDueDate(task?.dueDate ?? '');
    setAssigneeEmail(task?.assigneeEmail ?? '');
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

  const handleSave = async () => {
    if (!title.trim() || !dueDate) {
      saveAction.setError('Title and due date are required.');
      return;
    }
    await saveAction.run(async () => {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        assigneeEmail: assigneeEmail || undefined,
      });
      onClose();
    }, 'Failed to save. Try again.');
  };

  // The task's current assignee stays selectable even if they've since left
  // the roster, so editing an existing task never silently drops them.
  const assigneeOptions =
    task?.assigneeEmail && !rosterEmails.includes(task.assigneeEmail)
      ? [...rosterEmails, task.assigneeEmail]
      : rosterEmails;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      titleId="task-form-title"
      title={task ? 'Edit Task' : 'Add Task'}
    >
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
          onChange={(e) => setDueDate(e.target.value)}
        />
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
        <label className="wl-form-label" htmlFor="task-assignee">
          Assign to (optional)
        </label>
        <select
          id="task-assignee"
          className={styles['wl-form-select']}
          value={assigneeEmail}
          onChange={(e) => setAssigneeEmail(e.target.value)}
        >
          <option value="">Unassigned</option>
          {assigneeOptions.map((email) => (
            <option key={email} value={email}>
              {peopleNames[email] ?? email}
            </option>
          ))}
        </select>
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
