import { useId, useState } from 'react';

import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { FinancialTask } from '../../../types';
import { getTaskUrgency } from '../../../utils/taskUrgency';
import styles from './TaskRow.module.css';

interface TaskRowProps {
  task: FinancialTask;
  staggerIndex: number;
  peopleNames: Record<string, string>;
  canEdit: boolean;
  pending: boolean;
  error?: string;
  onToggleComplete: (completed: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const STAGGER_STEP_MS = 70;
const STAGGER_CAP_MS = 280;

const STATUS_LABEL: Record<string, string | null> = {
  overdue: 'Overdue',
  dueSoon: 'Due soon',
  dueThisWeek: 'Due this week',
  normal: null,
  complete: null,
};

export const TaskRow = ({
  task,
  staggerIndex,
  peopleNames,
  canEdit,
  pending,
  error,
  onToggleComplete,
  onEdit,
  onDelete,
}: TaskRowProps) => {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>();
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const urgency = getTaskUrgency(task.dueDate, task.completedAt);
  const isComplete = urgency === 'complete';
  const statusLabel = STATUS_LABEL[urgency];
  const transitionDelay = `${Math.min(staggerIndex * STAGGER_STEP_MS, STAGGER_CAP_MS)}ms`;

  const handleEdit = () => {
    // Collapse first so the row doesn't sit expanded-and-stale behind the
    // edit form while its fields are being changed elsewhere.
    setExpanded(false);
    onEdit();
  };

  return (
    <div
      ref={ref}
      className={[styles['wl-task-row'], styles[`wl-task-row--${urgency}`]]
        .filter(Boolean)
        .join(' ')}
      data-revealed={revealed ? 'true' : undefined}
      style={{ transitionDelay }}
    >
      <div className={styles['wl-task-row-header']}>
        <input
          type="checkbox"
          checked={isComplete}
          disabled={pending}
          aria-label={`Mark ${task.title} as complete`}
          onChange={(e) => onToggleComplete(e.target.checked)}
        />
        <button
          type="button"
          className={styles['wl-task-row-toggle']}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className={styles['wl-task-row-title']}>{task.title}</span>
          <span className={styles['wl-task-row-due']}>
            Due {task.dueDate}
            {statusLabel && ` · ${statusLabel}`}
          </span>
          <span
            className={[
              styles['wl-task-row-chevron'],
              expanded ? styles['wl-task-row-chevron--open'] : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          />
        </button>
      </div>

      {error && (
        <div className={styles['wl-task-row-error']} role="alert">
          {error}
        </div>
      )}

      {expanded && (
        <div id={detailsId} className={styles['wl-task-row-details']}>
          {task.description && (
            <p className={styles['wl-task-row-description']}>{task.description}</p>
          )}
          {task.assigneeEmail && (
            <p className={styles['wl-task-row-assignee']}>
              {peopleNames[task.assigneeEmail] ?? task.assigneeEmail}
            </p>
          )}
          {canEdit && (
            <div className={styles['wl-task-row-actions']}>
              <button
                type="button"
                onClick={handleEdit}
                disabled={pending}
                aria-label={`Edit ${task.title}`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                aria-label={`Delete ${task.title}`}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
