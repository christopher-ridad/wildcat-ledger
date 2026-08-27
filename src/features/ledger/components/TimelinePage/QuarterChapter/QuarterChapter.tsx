import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { FinancialTask } from '../../../types';
import { QuarterGroup } from '../../../utils/groupTasksByQuarter';
import { MonthSection } from '../MonthSection';
import styles from './QuarterChapter.module.css';

interface QuarterChapterProps {
  quarter: QuarterGroup;
  peopleNames: Record<string, string>;
  canEdit: boolean;
  isTaskPending: (taskId: string) => boolean;
  taskError: (taskId: string) => string;
  onToggleComplete: (task: FinancialTask, completed: boolean) => void;
  onEdit: (task: FinancialTask) => void;
  onDelete: (task: FinancialTask) => void;
}

// quarter.key is `${academicYearStart}-${order}` (order: Fall=0, Winter=1,
// Spring=2) -- the section number and month-range subtitle both derive from
// that order, resetting to 01/02/03 for each academic year rather than
// counting continuously, so a second scaffolded year still reads as its own
// three-chapter structure.
const MONTH_RANGE = ['September – December', 'January – March', 'April – June'];

export const QuarterChapter = ({
  quarter,
  peopleNames,
  canEdit,
  isTaskPending,
  taskError,
  onToggleComplete,
  onEdit,
  onDelete,
}: QuarterChapterProps) => {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>();
  const order = Number(quarter.key.split('-')[1]);
  const sectionNumber = String(order + 1).padStart(2, '0');

  return (
    <section className={styles['wl-quarter-chapter']}>
      <div
        ref={ref}
        className={styles['wl-quarter-chapter-opener']}
        data-revealed={revealed ? 'true' : undefined}
      >
        <span className={styles['wl-quarter-chapter-number']}>{sectionNumber}</span>
        <div>
          <h2 className={styles['wl-quarter-chapter-heading']}>{quarter.label}</h2>
          <p className={styles['wl-quarter-chapter-range']}>{MONTH_RANGE[order]}</p>
        </div>
      </div>

      {quarter.months.map((month) => (
        <MonthSection
          key={month.key}
          month={month}
          peopleNames={peopleNames}
          canEdit={canEdit}
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
