import { FinancialTask } from '../../../types';
import { todayDateString } from '../../../utils/today';
import { TaskCard } from '../TaskCard';
import styles from './MonthColumn.module.css';

interface MonthColumnProps {
  monthKey: string;
  label: string;
  tasks: FinancialTask[];
  peopleNames: Record<string, string>;
  canEdit: boolean;
  isTaskPending: (taskId: string) => boolean;
  taskError: (taskId: string) => string;
  onToggleComplete: (task: FinancialTask, completed: boolean) => void;
  onEdit: (task: FinancialTask) => void;
  onDelete: (task: FinancialTask) => void;
}

export const MonthColumn = ({
  monthKey,
  label,
  tasks,
  peopleNames,
  canEdit,
  isTaskPending,
  taskError,
  onToggleComplete,
  onEdit,
  onDelete,
}: MonthColumnProps) => {
  const isCurrentMonth = monthKey === todayDateString().slice(0, 7);

  return (
    <div
      className={[
        styles['wl-timeline-month'],
        isCurrentMonth ? styles['wl-timeline-month--current'] : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-month-key={monthKey}
    >
      <div className={styles['wl-timeline-month-header']}>{label}</div>
      <div className={styles['wl-timeline-month-body']}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            peopleNames={peopleNames}
            canEdit={canEdit}
            pending={isTaskPending(task.id)}
            error={taskError(task.id) || undefined}
            onToggleComplete={(completed) => onToggleComplete(task, completed)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task)}
          />
        ))}
      </div>
    </div>
  );
};
