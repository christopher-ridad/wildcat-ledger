import type { CSSProperties } from 'react';

import { FinancialTask } from '../../../types';
import { getTaskUrgency } from '../../../utils/taskUrgency';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: FinancialTask;
  peopleNames: Record<string, string>;
  canEdit: boolean;
  // True while this specific card's toggle or delete is in flight -- so one
  // card's in-progress action doesn't disable every other visible card.
  pending: boolean;
  error?: string;
  onToggleComplete: (completed: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  // This card only ever renders as a floating popover anchored to a
  // TaskMarker now -- titleId/direction/style come from that marker (the
  // marker owns the aria wiring and the getBoundingClientRect()-derived
  // fixed position; this component just renders content into them).
  titleId: string;
  direction: 'above' | 'below';
  style?: CSSProperties;
}

const URGENCY_LABEL: Record<string, string | null> = {
  overdue: '(overdue)',
  dueSoon: '(due soon)',
  dueThisWeek: '(this week)',
  normal: null,
  complete: null,
};

export const TaskCard = ({
  task,
  peopleNames,
  canEdit,
  pending,
  error,
  onToggleComplete,
  onEdit,
  onDelete,
  titleId,
  direction,
  style,
}: TaskCardProps) => {
  const urgency = getTaskUrgency(task.dueDate, task.completedAt);
  const isComplete = urgency === 'complete';
  const urgencyLabel = URGENCY_LABEL[urgency];

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      data-task-popover-active="true"
      style={style}
      className={[
        styles['wl-task-card'],
        styles[`wl-task-card--${urgency}`],
        styles[`wl-task-card--${direction}`],
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <label className={styles['wl-task-card-checkbox-row']}>
        <input
          type="checkbox"
          checked={isComplete}
          disabled={pending}
          onChange={(e) => onToggleComplete(e.target.checked)}
        />
        <span id={titleId} className={styles['wl-task-card-title']}>
          {task.title}
        </span>
      </label>

      {task.description && (
        <p className={styles['wl-task-card-description']}>{task.description}</p>
      )}

      <div className={styles['wl-task-card-meta']}>
        <span className={styles[`wl-task-card-due--${urgency}`]}>
          Due {task.dueDate}
          {urgencyLabel && ` ${urgencyLabel}`}
        </span>
        {task.assigneeEmail && (
          <span>{peopleNames[task.assigneeEmail] ?? task.assigneeEmail}</span>
        )}
      </div>

      {error && (
        <div className={styles['wl-task-card-error']} role="alert">
          {error}
        </div>
      )}

      {canEdit && (
        <div className={styles['wl-task-card-actions']}>
          <button
            type="button"
            onClick={onEdit}
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
  );
};
