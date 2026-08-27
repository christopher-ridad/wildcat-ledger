import { useMemo } from 'react';

import { FinancialTask } from '../../../types';
import { groupTasksByQuarter } from '../../../utils/groupTasksByQuarter';
import { todayDateString } from '../../../utils/today';
import { QuarterChapter } from '../QuarterChapter';
import styles from './ChapterTimeline.module.css';

interface ChapterTimelineProps {
  tasks: FinancialTask[];
  peopleNames: Record<string, string>;
  canEdit: boolean;
  isTaskPending: (taskId: string) => boolean;
  taskError: (taskId: string) => string;
  onToggleComplete: (task: FinancialTask, completed: boolean) => void;
  onEdit: (task: FinancialTask) => void;
  onDelete: (task: FinancialTask) => void;
}

export const ChapterTimeline = ({
  tasks,
  peopleNames,
  canEdit,
  isTaskPending,
  taskError,
  onToggleComplete,
  onEdit,
  onDelete,
}: ChapterTimelineProps) => {
  const quarters = useMemo(() => groupTasksByQuarter(tasks, todayDateString()), [tasks]);

  return (
    <div className={styles['wl-chapter-timeline']}>
      {tasks.length === 0 && (
        <p className={styles['wl-chapter-timeline-empty']}>No tasks yet.</p>
      )}

      {quarters.map((quarter) => (
        <QuarterChapter
          key={quarter.key}
          quarter={quarter}
          peopleNames={peopleNames}
          canEdit={canEdit}
          isTaskPending={isTaskPending}
          taskError={taskError}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
