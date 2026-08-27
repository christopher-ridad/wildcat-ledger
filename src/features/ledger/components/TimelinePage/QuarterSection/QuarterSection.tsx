import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { FinancialTask } from '../../../types';
import { QuarterGroup, TaskSide } from '../../../utils/groupTasksByQuarter';
import { MonthLandmark } from '../MonthLandmark';
import { TimelineLineSegment } from '../TimelineLineSegment';
import styles from './QuarterSection.module.css';

interface QuarterSectionProps {
  quarter: QuarterGroup;
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

// Owns the shared 3-column grid (content-left | center line | content-right)
// that everything within this quarter -- the heading, each MonthLandmark's
// rows, and each TaskMarker -- lays out against. MonthLandmark and
// TaskMarker return Fragments rather than wrapping divs specifically so
// their rows land as direct children of this grid.
export const QuarterSection = ({
  quarter,
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
}: QuarterSectionProps) => {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>();

  return (
    <section className={styles['wl-quarter-section']}>
      <div ref={ref} className={styles['wl-quarter-line-cell']}>
        <TimelineLineSegment revealed={revealed} />
      </div>
      <h2
        className={styles['wl-quarter-heading']}
        data-revealed={revealed ? 'true' : undefined}
      >
        {quarter.label}
      </h2>

      {quarter.months.map((month) => (
        <MonthLandmark
          key={month.key}
          month={month}
          taskSides={taskSides}
          peopleNames={peopleNames}
          canEdit={canEdit}
          activeTaskId={activeTaskId}
          onToggleActive={onToggleActive}
          isTaskPending={isTaskPending}
          taskError={taskError}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
};
