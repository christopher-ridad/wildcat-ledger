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
  // This card only ever renders as a floating popover growing out of its
  // TaskMarker's own content cell (which is position:relative) -- titleId
  // comes from the marker for aria wiring, direction matches which side of
  // the central line that marker's content sits on, so the popover expands
  // outward (away from the line) instead of crossing over it.
  titleId: string;
  direction: 'left' | 'right';
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
}: TaskCardProps) => {
  const urgency = getTaskUrgency(task.dueDate, task.completedAt);
  const isComplete = urgency === 'complete';
  const urgencyLabel = URGENCY_LABEL[urgency];

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      data-task-popover-active="true"
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
