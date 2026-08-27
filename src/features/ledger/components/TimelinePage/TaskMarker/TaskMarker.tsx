import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { FinancialTask } from '../../../types';
import { getTaskUrgency } from '../../../utils/taskUrgency';
import { TaskCard } from '../TaskCard';
import { TimelineLineSegment } from '../TimelineLineSegment';
import styles from './TaskMarker.module.css';

interface TaskMarkerProps {
  task: FinancialTask;
  side: 'left' | 'right';
  isActive: boolean;
  onToggleActive: () => void;
  peopleNames: Record<string, string>;
  canEdit: boolean;
  pending: boolean;
  error?: string;
  onToggleComplete: (completed: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

// Renders as a Fragment (not a wrapping div) with two grid items -- a
// centered line/dot cell and a side content cell -- so both land as direct
// children of the parent grid QuarterSection owns. See TimelineLineSegment
// for why the line itself is built from per-row slivers instead of one
// absolutely-positioned full-height line.
export const TaskMarker = ({
  task,
  side,
  isActive,
  onToggleActive,
  peopleNames,
  canEdit,
  pending,
  error,
  onToggleComplete,
  onEdit,
  onDelete,
}: TaskMarkerProps) => {
  const urgency = getTaskUrgency(task.dueDate, task.completedAt);
  const titleId = `task-popover-title-${task.id}`;
  const { ref, revealed } = useScrollReveal<HTMLDivElement>();

  return (
    <>
      <div
        ref={ref}
        className={styles['wl-marker-line-cell']}
        data-task-popover-active={isActive ? 'true' : undefined}
      >
        <TimelineLineSegment revealed={revealed} />
        <button
          type="button"
          className={[styles['wl-marker-dot'], styles[`wl-marker-dot--${urgency}`]]
            .filter(Boolean)
            .join(' ')}
          data-revealed={revealed ? 'true' : undefined}
          onClick={onToggleActive}
          aria-haspopup="dialog"
          aria-expanded={isActive}
          aria-label={task.title}
        />
      </div>

      <div
        className={[styles['wl-marker-content'], styles[`wl-marker-content--${side}`]]
          .filter(Boolean)
          .join(' ')}
        data-revealed={revealed ? 'true' : undefined}
        data-task-popover-active={isActive ? 'true' : undefined}
      >
        <span className={styles['wl-marker-label']}>{task.title}</span>

        {isActive && (
          <TaskCard
            task={task}
            peopleNames={peopleNames}
            canEdit={canEdit}
            pending={pending}
            error={error}
            onToggleComplete={onToggleComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            titleId={titleId}
            direction={side}
          />
        )}
      </div>
    </>
  );
};
