import { useId, useState } from 'react';

import { FinancialTask, FinancialTaskRequirement } from '../../../types';
import { getTaskUrgency } from '../../../utils/taskUrgency';
import styles from './TaskRow.module.css';

interface TaskRowProps {
  task: FinancialTask;
  // This task's position among its month's entries (0-based) -- staggers
  // its entrance animation slightly behind the ones before it.
  staggerIndex: number;
  requirements: FinancialTaskRequirement[];
  peopleNames: Record<string, string>;
  canEdit: boolean;
  pending: boolean;
  error?: string;
  isRequirementPending: (requirementId: string) => boolean;
  onToggleComplete: (completed: boolean) => void;
  onToggleRequirement: (
    requirement: FinancialTaskRequirement,
    completed: boolean,
  ) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const STAGGER_STEP_MS = 70;
const STAGGER_CAP_MS = 280;

const STATUS_LABEL: Record<string, string | null> = {
  overdue: 'Overdue',
  dueSoon: 'Due soon',
  dueThisWeek: 'Due this week',
  normal: 'Upcoming',
  complete: null,
};

export const TaskRow = ({
  task,
  staggerIndex,
  requirements,
  peopleNames,
  canEdit,
  pending,
  error,
  isRequirementPending,
  onToggleComplete,
  onToggleRequirement,
  onEdit,
  onDelete,
}: TaskRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const urgency = getTaskUrgency(task.dueDate, task.completedAt);
  const isComplete = urgency === 'complete';
  const statusLabel = STATUS_LABEL[urgency];
  const animationDelay = `${Math.min(staggerIndex * STAGGER_STEP_MS, STAGGER_CAP_MS)}ms`;

  const handleEdit = () => {
    // Collapse first so the row doesn't sit expanded-and-stale behind the
    // edit form while its fields are being changed elsewhere.
    setExpanded(false);
    onEdit();
  };

  return (
    <div
      className={[styles['wl-task-row'], styles[`wl-task-row--${urgency}`]]
        .filter(Boolean)
        .join(' ')}
      style={{ animationDelay }}
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
            {task.paymentType && ` · ${task.paymentType}`}
            {statusLabel && `${task.paymentType ? ',' : ' ·'} ${statusLabel}`}
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
          {task.assigneeEmails.length > 0 && (
            <p className={styles['wl-task-row-assignee']}>
              Assigned to:{' '}
              {task.assigneeEmails.map((email) => peopleNames[email] ?? email).join(', ')}
            </p>
          )}

          {requirements.length > 0 && (
            <ul className={styles['wl-task-row-requirements']}>
              {requirements.map((requirement) => (
                <li key={requirement.id} className={styles['wl-task-row-requirement']}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!requirement.completedAt}
                      disabled={isRequirementPending(requirement.id)}
                      onChange={(e) => onToggleRequirement(requirement, e.target.checked)}
                    />
                    <span>{requirement.label}</span>
                  </label>
                </li>
              ))}
            </ul>
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
