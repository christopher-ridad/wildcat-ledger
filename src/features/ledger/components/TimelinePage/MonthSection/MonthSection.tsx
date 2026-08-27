import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { FinancialTask } from '../../../types';
import { MonthGroup } from '../../../utils/groupTasksByQuarter';
import { TaskRow } from '../TaskRow';
import styles from './MonthSection.module.css';

interface MonthSectionProps {
  month: MonthGroup;
  peopleNames: Record<string, string>;
  canEdit: boolean;
  isTaskPending: (taskId: string) => boolean;
  taskError: (taskId: string) => string;
  onToggleComplete: (task: FinancialTask, completed: boolean) => void;
  onEdit: (task: FinancialTask) => void;
  onDelete: (task: FinancialTask) => void;
}

export const MonthSection = ({
  month,
  peopleNames,
  canEdit,
  isTaskPending,
  taskError,
  onToggleComplete,
  onEdit,
  onDelete,
}: MonthSectionProps) => {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>();

  return (
    <section className={styles['wl-month-section']}>
      <h3
        ref={ref}
        className={styles['wl-month-section-label']}
        data-revealed={revealed ? 'true' : undefined}
      >
        {month.label}
      </h3>

      {month.entries.map((entry, entryIndex) => {
        if (entry.isToday) {
          return (
            <div key="today" className={styles['wl-today-divider']} role="separator">
              <span className={styles['wl-today-divider-label']}>Today</span>
            </div>
          );
        }

        const task = entry.task!;
        return (
          <TaskRow
            key={task.id}
            task={task}
            staggerIndex={entryIndex}
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
    </section>
  );
};
