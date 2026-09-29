import { useMemo, useState } from 'react';

import { Modal } from '../../../ledger/components/Dashboard/Modal';
import { useAsyncAction, useAsyncActionMap } from '../../../ledger/hooks/useAsyncAction';
import { useLedger } from '../../../ledger/hooks/useLedger';
import { useTasks } from '../../hooks/useTasks';
import { FinancialTask, FinancialTaskInput, FinancialTaskRequirement } from '../../types';
import { QuarterBoard } from '../QuarterBoard';
import { TaskFormModal } from '../TaskFormModal';
import styles from './TimelineBoard.module.css';

export const TimelineBoard = () => {
  const { activeOrganization, peopleNames, canEdit } = useLedger();
  const {
    financialTasks,
    financialTaskRequirements,
    addFinancialTask,
    updateFinancialTask,
    deleteFinancialTask,
    toggleFinancialTaskComplete,
    toggleFinancialTaskRequirement,
  } = useTasks();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FinancialTask | undefined>(undefined);
  const [deletingTask, setDeletingTask] = useState<FinancialTask | null>(null);
  const toggleAction = useAsyncActionMap();
  const requirementAction = useAsyncActionMap();
  const deleteAction = useAsyncAction();

  const rosterEmails = [
    ...new Set([
      ...(activeOrganization?.officers ?? []),
      ...(activeOrganization?.sofoApprovers ?? []),
    ]),
  ];

  const requirementsByTaskId = useMemo(() => {
    const map = new Map<string, FinancialTaskRequirement[]>();
    for (const requirement of financialTaskRequirements) {
      const existing = map.get(requirement.taskId);
      if (existing) {
        existing.push(requirement);
      } else {
        map.set(requirement.taskId, [requirement]);
      }
    }
    return map;
  }, [financialTaskRequirements]);

  const openAddForm = () => {
    setEditingTask(undefined);
    setFormOpen(true);
  };

  const openEditForm = (task: FinancialTask) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleToggleComplete = (task: FinancialTask, completed: boolean) => {
    toggleAction.run(
      task.id,
      () => toggleFinancialTaskComplete(task.id, completed),
      'Failed to update. Try again.',
    );
  };

  const handleToggleRequirement = (
    requirement: FinancialTaskRequirement,
    completed: boolean,
  ) => {
    requirementAction.run(
      requirement.id,
      () => toggleFinancialTaskRequirement(requirement.id, completed),
      'Failed to update. Try again.',
    );
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTask || deleteAction.pending) return;
    await deleteAction.run(async () => {
      await deleteFinancialTask(deletingTask.id);
      setDeletingTask(null);
    }, 'Failed to delete.');
  };

  // Also reachable via the Modal's Escape key and overlay-click, not just the
  // explicit Cancel button -- guarded the same way so a delete that's still
  // in flight can't be dismissed out from under its own pending/error state.
  const handleDeleteCancel = () => {
    if (deleteAction.pending) return;
    setDeletingTask(null);
    deleteAction.setError(null);
  };

  const handleSave = async (task: FinancialTaskInput) => {
    if (editingTask) {
      await updateFinancialTask(editingTask.id, task);
    } else {
      await addFinancialTask(task);
    }
  };

  const isTaskPending = (taskId: string) => toggleAction.pending(taskId);
  const taskError = (taskId: string) => toggleAction.error(taskId);

  return (
    <div className={styles['wl-timeline-board']}>
      <QuarterBoard
        tasks={financialTasks}
        requirementsByTaskId={requirementsByTaskId}
        peopleNames={peopleNames}
        canEdit={canEdit}
        isTaskPending={isTaskPending}
        taskError={taskError}
        isRequirementPending={requirementAction.pending}
        onToggleComplete={handleToggleComplete}
        onToggleRequirement={handleToggleRequirement}
        onEdit={openEditForm}
        onDelete={setDeletingTask}
        headerActions={
          canEdit && (
            <button type="button" className="wl-btn-primary" onClick={openAddForm}>
              + Add Task
            </button>
          )
        }
      />

      <TaskFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        task={editingTask}
        rosterEmails={rosterEmails}
        peopleNames={peopleNames}
        onSave={handleSave}
      />

      {deletingTask && (
        <Modal
          isOpen
          onClose={handleDeleteCancel}
          titleId="delete-task-confirm-title"
          title="Delete Task"
        >
          <p className={styles['wl-delete-confirm-text']}>
            Delete <strong>{deletingTask.title}</strong>?
          </p>
          <p className={styles['wl-delete-confirm-hint']}>This can&apos;t be undone.</p>
          {deleteAction.error && (
            <div className="wl-form-error" role="alert">
              {deleteAction.error}
            </div>
          )}
          <div className={styles['wl-delete-confirm-actions']}>
            <button
              type="button"
              className="wl-btn-danger"
              onClick={handleDeleteConfirm}
              disabled={deleteAction.pending}
            >
              {deleteAction.pending ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              className="wl-btn-cancel"
              onClick={handleDeleteCancel}
              disabled={deleteAction.pending}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
