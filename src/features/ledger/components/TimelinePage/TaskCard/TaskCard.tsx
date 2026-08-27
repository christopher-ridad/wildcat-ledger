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
}: TaskCardProps) => {
  const urgency = getTaskUrgency(task.dueDate, task.completedAt);
  const isComplete = urgency === 'complete';
  const urgencyLabel = URGENCY_LABEL[urgency];

  return (
    <div
      className={[styles['wl-task-card'], styles[`wl-task-card--${urgency}`]]
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
        <span className={styles['wl-task-card-title']}>{task.title}</span>
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
