import { useMemo, useState } from 'react';

import { useAsyncActionMap } from '../../../hooks/useAsyncAction';
import { useLedger } from '../../../hooks/useLedger';
import { FinancialTask, FinancialTaskRequirement, TransactionType } from '../../../types';
import { QuarterBoard } from '../QuarterBoard';
import { TaskFormModal } from '../TaskFormModal';
import styles from './TimelineBoard.module.css';

export const TimelineBoard = () => {
  const {
    financialTasks,
    financialTaskRequirements,
    activeOrganization,
    peopleNames,
    canEdit,
    addFinancialTask,
    updateFinancialTask,
    deleteFinancialTask,
    toggleFinancialTaskComplete,
    toggleFinancialTaskRequirement,
  } = useLedger();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FinancialTask | undefined>(undefined);
  const toggleAction = useAsyncActionMap();
  const deleteAction = useAsyncActionMap();
  const requirementAction = useAsyncActionMap();

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

  const handleDelete = (task: FinancialTask) => {
    deleteAction.run(task.id, () => deleteFinancialTask(task.id), 'Failed to delete.');
  };

  const handleSave = async (task: {
    title: string;
    description?: string;
    dueDate: string;
    assigneeEmails: string[];
    paymentType?: TransactionType;
    isIndividualVendor?: boolean;
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
        onDelete={handleDelete}
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
    </div>
  );
};
