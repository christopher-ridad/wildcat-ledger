import { Fragment } from 'react';

import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { FinancialTask } from '../../../types';
import { MonthGroup, TaskSide } from '../../../utils/groupTasksByQuarter';
import { TaskMarker } from '../TaskMarker';
import { TimelineLineSegment } from '../TimelineLineSegment';
import styles from './MonthLandmark.module.css';

interface MonthLandmarkProps {
  month: MonthGroup;
  taskSides: Map<string, TaskSide>;
  peopleNames: Record<string, string>;
  canEdit: boolean;
  activeTaskId: string | null;
  onToggleActive: (taskId: string) => void;
  isTaskPending: (taskId: string) => boolean;
  taskError: (taskId: string) => string;
  onToggleComplete: (task: FinancialTask, completed: boolean) => void;
  onEdit: (task: FinancialTask) => void;
  onDelete: (task: FinancialTask) => void;
}

// Returns a Fragment (no wrapping div) so its rows -- the month label row,
// an optional "Today" landmark row, and one row per task -- land as direct
// children of QuarterSection's shared grid.
export const MonthLandmark = ({
  month,
  taskSides,
  peopleNames,
  canEdit,
  activeTaskId,
  onToggleActive,
  isTaskPending,
  taskError,
  onToggleComplete,
  onEdit,
  onDelete,
}: MonthLandmarkProps) => {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>();

  return (
    <>
      <div ref={ref} className={styles['wl-month-line-cell']}>
        <TimelineLineSegment revealed={revealed} />
      </div>
      <div
        className={styles['wl-month-label']}
        data-revealed={revealed ? 'true' : undefined}
      >
        {month.label}
      </div>

      {month.entries.map((entry) => {
        if (entry.isToday) {
          return (
            <Fragment key="today">
              <div className={styles['wl-today-line-cell']}>
                <TimelineLineSegment revealed={revealed} />
                <span
                  className={styles['wl-today-tick']}
                  data-revealed={revealed ? 'true' : undefined}
                />
              </div>
              <div
                className={styles['wl-today-label']}
                data-revealed={revealed ? 'true' : undefined}
              >
                Today
              </div>
            </Fragment>
          );
        }

        const task = entry.task!;
        return (
          <TaskMarker
            key={task.id}
            task={task}
            side={taskSides.get(task.id) ?? 'left'}
            isActive={activeTaskId === task.id}
            onToggleActive={() => onToggleActive(task.id)}
            peopleNames={peopleNames}
            canEdit={canEdit}
            pending={isTaskPending(task.id)}
            error={taskError(task.id) || undefined}
            onToggleComplete={(completed) => onToggleComplete(task, completed)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task)}
          />
        );
      })}
    </>
  );
};
