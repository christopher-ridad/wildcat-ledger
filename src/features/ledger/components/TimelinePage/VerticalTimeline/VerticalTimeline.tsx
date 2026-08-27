import { useEffect, useMemo, useState } from 'react';

import { FinancialTask } from '../../../types';
import { assignTaskSides, groupTasksByQuarter } from '../../../utils/groupTasksByQuarter';
import { todayDateString } from '../../../utils/today';
import { QuarterSection } from '../QuarterSection';
import styles from './VerticalTimeline.module.css';

interface VerticalTimelineProps {
  tasks: FinancialTask[];
  peopleNames: Record<string, string>;
  canEdit: boolean;
  isTaskPending: (taskId: string) => boolean;
  taskError: (taskId: string) => string;
  onToggleComplete: (task: FinancialTask, completed: boolean) => void;
  onEdit: (task: FinancialTask) => void;
  onDelete: (task: FinancialTask) => void;
}

export const VerticalTimeline = ({
  tasks,
  peopleNames,
  canEdit,
  isTaskPending,
  taskError,
  onToggleComplete,
  onEdit,
  onDelete,
}: VerticalTimelineProps) => {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const quarters = useMemo(() => groupTasksByQuarter(tasks, todayDateString()), [tasks]);
  const taskSides = useMemo(() => assignTaskSides(quarters), [quarters]);

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

  const handleEdit = (task: FinancialTask) => {
    // Close first -- opening the edit form modal on top of a still-open
    // floating popover would stack two overlays awkwardly.
    setActiveTaskId(null);
    onEdit(task);
  };

  return (
    <div className={styles['wl-vertical-timeline']}>
      {tasks.length === 0 && (
        <p className={styles['wl-vertical-timeline-empty']}>
          No tasks yet -- add one to get started.
        </p>
      )}

      {quarters.map((quarter) => (
        <QuarterSection
          key={quarter.key}
          quarter={quarter}
          taskSides={taskSides}
          peopleNames={peopleNames}
          canEdit={canEdit}
          activeTaskId={activeTaskId}
          onToggleActive={(taskId) =>
            setActiveTaskId((prev) => (prev === taskId ? null : taskId))
          }
          isTaskPending={isTaskPending}
          taskError={taskError}
          onToggleComplete={onToggleComplete}
          onEdit={handleEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
