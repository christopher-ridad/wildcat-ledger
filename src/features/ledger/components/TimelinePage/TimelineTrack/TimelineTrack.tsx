import { useEffect, useMemo, useRef, useState } from 'react';

import { FinancialTask } from '../../../types';
import { computeMarkerLayout, PX_PER_DAY } from '../../../utils/timelinePositions';
import { todayDateString } from '../../../utils/today';
import { TaskMarker } from '../TaskMarker';
import styles from './TimelineTrack.module.css';

interface TimelineTrackProps {
  tasks: FinancialTask[];
  peopleNames: Record<string, string>;
  canEdit: boolean;
  isTaskPending: (taskId: string) => boolean;
  taskError: (taskId: string) => string;
  onToggleComplete: (task: FinancialTask, completed: boolean) => void;
  onEdit: (task: FinancialTask) => void;
  onDelete: (task: FinancialTask) => void;
}

const SCROLL_STEP_DAYS = 7;

export const TimelineTrack = ({
  tasks,
  peopleNames,
  canEdit,
  isTaskPending,
  taskError,
  onToggleComplete,
  onEdit,
  onDelete,
}: TimelineTrackProps) => {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  const { positions, trackWidth, todayX } = useMemo(
    () => computeMarkerLayout(tasks, todayDateString()),
    [tasks],
  );

  // Scroll the "today" landmark into view once on mount -- not on every
  // tasks change, or completing a task elsewhere would yank the view back
  // to today while someone's looking at a different part of the timeline.
  useEffect(() => {
    todayRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: 'auto',
    });
  }, []);

  // Only one popover open at a time. While one is open, clicking anywhere
  // outside it (or its own marker) or pressing Escape closes it.
  useEffect(() => {
    if (!activeTaskId) return;
    const closeIfOutside = (e: MouseEvent) => {
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest('[data-task-popover-active="true"]')
      ) {
        return;
      }
      setActiveTaskId(null);
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveTaskId(null);
    };
    // Capture phase so this runs before a marker's own bubble-phase
    // onClick -- re-clicking the already-active dot lands here first (and
    // no-ops, since the click target is inside the active marker), then the
    // dot's own handler toggles it closed.
    document.addEventListener('click', closeIfOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', closeIfOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeTaskId]);

  const scrollByDays = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({
      left: direction * SCROLL_STEP_DAYS * PX_PER_DAY,
      behavior: 'smooth',
    });
  };

  const handleEdit = (task: FinancialTask) => {
    // Close first -- opening the edit form modal on top of a still-open
    // floating popover would stack two overlays awkwardly.
    setActiveTaskId(null);
    onEdit(task);
  };

  return (
    <div className={styles['wl-timeline-track-wrap']}>
      <div className={styles['wl-timeline-scroll-buttons']}>
        <button
          type="button"
          onClick={() => scrollByDays(-1)}
          aria-label="Scroll to earlier dates"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => scrollByDays(1)}
          aria-label="Scroll to later dates"
        >
          →
        </button>
      </div>

      <div className={styles['wl-timeline-scroll']} ref={scrollRef}>
        <div className={styles['wl-timeline-track']} style={{ width: trackWidth }}>
          <div className={styles['wl-timeline-line']} />

          <div
            ref={todayRef}
            className={styles['wl-timeline-today']}
            style={{ left: todayX }}
          >
            <span className={styles['wl-timeline-today-tick']} />
            <span className={styles['wl-timeline-today-label']}>Today</span>
          </div>

          {positions.map(({ task, x }, index) => (
            <TaskMarker
              key={task.id}
              task={task}
              x={x}
              index={index}
              isActive={activeTaskId === task.id}
              onToggleActive={() =>
                setActiveTaskId((prev) => (prev === task.id ? null : task.id))
              }
              peopleNames={peopleNames}
              canEdit={canEdit}
              pending={isTaskPending(task.id)}
              error={taskError(task.id) || undefined}
              onToggleComplete={(completed) => onToggleComplete(task, completed)}
              onEdit={() => handleEdit(task)}
              onDelete={() => onDelete(task)}
            />
          ))}
        </div>
      </div>

      {tasks.length === 0 && <p className={styles['wl-timeline-empty']}>No tasks yet.</p>}
    </div>
  );
};
