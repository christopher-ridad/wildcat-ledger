import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { FinancialTask } from '../../../types';
import { getTaskUrgency } from '../../../utils/taskUrgency';
import { TaskCard } from '../TaskCard';
import styles from './TaskMarker.module.css';

interface TaskMarkerProps {
  task: FinancialTask;
  x: number;
  index: number;
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

const STAGGER_STEP_MS = 40;
const STAGGER_CAP_MS = 600;
const POPOVER_GAP_PX = 8;

interface PopoverPosition {
  left: number;
  top: number;
}

export const TaskMarker = ({
  task,
  x,
  index,
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
  const direction = index % 2 === 0 ? 'above' : 'below';
  const urgency = getTaskUrgency(task.dueDate, task.completedAt);
  const dotRef = useRef<HTMLButtonElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const titleId = `task-popover-title-${task.id}`;

  // Only track position while the popover is actually open -- the dot's
  // rect can change as the horizontally-scrolling track moves, and this
  // keeps the portaled popover pinned to it live rather than stale from the
  // moment it opened.
  useEffect(() => {
    if (!isActive) {
      setPopoverPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = dotRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = rect.left + rect.width / 2;
      const top =
        direction === 'above' ? rect.top - POPOVER_GAP_PX : rect.bottom + POPOVER_GAP_PX;
      setPopoverPosition({ left, top });
    };

    updatePosition();
    // Capture phase: scroll doesn't bubble, but capturing on document still
    // catches scroll on any descendant scrollable ancestor, including the
    // track's own horizontal scroll container.
    document.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isActive, direction]);

  const animationDelay = Math.min(index * STAGGER_STEP_MS, STAGGER_CAP_MS);

  return (
    <div
      className={[styles['wl-marker'], styles[`wl-marker--${direction}`]]
        .filter(Boolean)
        .join(' ')}
      style={{ left: x, animationDelay: `${animationDelay}ms` }}
      data-task-popover-active={isActive ? 'true' : undefined}
    >
      <button
        ref={dotRef}
        type="button"
        className={[styles['wl-marker-dot'], styles[`wl-marker-dot--${urgency}`]]
          .filter(Boolean)
          .join(' ')}
        onClick={onToggleActive}
        aria-haspopup="dialog"
        aria-expanded={isActive}
        aria-label={task.title}
      />
      <span className={styles['wl-marker-stem']} />
      <span className={styles['wl-marker-label']}>{task.title}</span>

      {isActive &&
        popoverPosition &&
        createPortal(
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
            direction={direction}
            style={{ left: popoverPosition.left, top: popoverPosition.top }}
          />,
          document.body,
        )}
    </div>
  );
};
