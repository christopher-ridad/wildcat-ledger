import { useEffect, useRef, useState } from 'react';

import { useAsyncActionMap } from '../../../hooks/useAsyncAction';
import { useLedger } from '../../../hooks/useLedger';
import { FinancialTask } from '../../../types';
import { groupTasksByMonth } from '../../../utils/groupTasksByMonth';
import { todayDateString } from '../../../utils/today';
import { MonthColumn } from '../MonthColumn';
import { TaskFormModal } from '../TaskFormModal';
import styles from './TimelineBoard.module.css';

const MONTH_COLUMN_WIDTH = 280;
const MONTH_COLUMN_GAP = 24;

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const groups = groupTasksByMonth(financialTasks);

  // Scroll the current month into view once on mount -- not on every
  // financialTasks/groups change, or completing a task elsewhere would yank
  // the view back to "today" while someone's looking at a different month.
  useEffect(() => {
    const currentMonthKey = todayDateString().slice(0, 7);
    scrollRef.current
      ?.querySelector(`[data-month-key="${currentMonthKey}"]`)
      ?.scrollIntoView({ inline: 'start', behavior: 'auto', block: 'nearest' });
  }, []);

  const scrollByOneMonth = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({
      left: direction * (MONTH_COLUMN_WIDTH + MONTH_COLUMN_GAP),
      behavior: 'smooth',
    });
  };

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
        <div className={styles['wl-timeline-scroll-buttons']}>
          <button
            type="button"
            onClick={() => scrollByOneMonth(-1)}
            aria-label="Scroll to earlier months"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollByOneMonth(1)}
            aria-label="Scroll to later months"
          >
            →
          </button>
        </div>
        {canEdit && (
          <button type="button" className="wl-btn-primary" onClick={openAddForm}>
            + Add Task
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <p className={styles['wl-timeline-empty']}>No tasks yet.</p>
      ) : (
        <div className={styles['wl-timeline-scroll']} ref={scrollRef}>
          {groups.map((group) => (
            <MonthColumn
              key={group.monthKey}
              monthKey={group.monthKey}
              label={group.label}
              tasks={group.tasks}
              peopleNames={peopleNames}
              canEdit={canEdit}
              isTaskPending={isTaskPending}
              taskError={taskError}
              onToggleComplete={handleToggleComplete}
              onEdit={openEditForm}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

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
