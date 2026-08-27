import { useState } from 'react';

import { useAsyncActionMap } from '../../../hooks/useAsyncAction';
import { useLedger } from '../../../hooks/useLedger';
import { FinancialTask } from '../../../types';
import { TaskFormModal } from '../TaskFormModal';
import { TimelineTrack } from '../TimelineTrack';
import styles from './TimelineBoard.module.css';

export const TimelineBoard = () => {
  const {
    financialTasks,
    activeOrganization,
    peopleNames,
    canEdit,
    addFinancialTask,
    updateFinancialTask,
    deleteFinancialTask,
    toggleFinancialTaskComplete,
  } = useLedger();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FinancialTask | undefined>(undefined);
  const toggleAction = useAsyncActionMap();
  const deleteAction = useAsyncActionMap();

  const rosterEmails = [
    ...new Set([
      ...(activeOrganization?.officers ?? []),
      ...(activeOrganization?.sofoApprovers ?? []),
    ]),
  ];

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

  const handleDelete = (task: FinancialTask) => {
    deleteAction.run(task.id, () => deleteFinancialTask(task.id), 'Failed to delete.');
  };

  const handleSave = async (task: {
    title: string;
    description?: string;
    dueDate: string;
    assigneeEmail?: string;
  }) => {
    if (editingTask) {
      await updateFinancialTask(editingTask.id, task);
    } else {
      await addFinancialTask(task);
    }
  };

  const isTaskPending = (taskId: string) =>
    toggleAction.pending(taskId) || deleteAction.pending(taskId);
  const taskError = (taskId: string) =>
    toggleAction.error(taskId) || deleteAction.error(taskId);

  return (
    <div className={styles['wl-timeline-board']}>
      <div className={styles['wl-timeline-board-header']}>
        {canEdit && (
          <button type="button" className="wl-btn-primary" onClick={openAddForm}>
            + Add Task
          </button>
        )}
      </div>

      <TimelineTrack
        tasks={financialTasks}
        peopleNames={peopleNames}
        canEdit={canEdit}
        isTaskPending={isTaskPending}
        taskError={taskError}
        onToggleComplete={handleToggleComplete}
        onEdit={openEditForm}
        onDelete={handleDelete}
      />

      <TaskFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        task={editingTask}
        rosterEmails={rosterEmails}
        peopleNames={peopleNames}
        onSave={handleSave}
      />
    </div>
  );
};
