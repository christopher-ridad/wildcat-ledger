import { FinancialTask, FinancialTaskRequirement } from '../../types';
import { MonthGroup } from '../../utils/groupTasksByQuarter';
import { TaskRow } from '../TaskRow';
import styles from './MonthSection.module.css';

interface MonthSectionProps {
  month: MonthGroup;
  requirementsByTaskId: Map<string, FinancialTaskRequirement[]>;
  peopleNames: Record<string, string>;
  canEdit: boolean;
  isTaskPending: (taskId: string) => boolean;
  taskError: (taskId: string) => string;
  isRequirementPending: (requirementId: string) => boolean;
  onToggleComplete: (task: FinancialTask, completed: boolean) => void;
  onToggleRequirement: (
    requirement: FinancialTaskRequirement,
    completed: boolean,
  ) => void;
  onEdit: (task: FinancialTask) => void;
  onDelete: (task: FinancialTask) => void;
}

export const MonthSection = ({
  month,
  requirementsByTaskId,
  peopleNames,
  canEdit,
  isTaskPending,
  taskError,
  isRequirementPending,
  onToggleComplete,
  onToggleRequirement,
  onEdit,
  onDelete,
}: MonthSectionProps) => (
  <section className={styles['wl-month-section']}>
    <h3 className={styles['wl-month-section-label']}>{month.label}</h3>

    {month.tasks.map((task, taskIndex) => (
      <TaskRow
        key={task.id}
        task={task}
        staggerIndex={taskIndex}
        requirements={requirementsByTaskId.get(task.id) ?? []}
        peopleNames={peopleNames}
        canEdit={canEdit}
        pending={isTaskPending(task.id)}
        error={taskError(task.id) || undefined}
        isRequirementPending={isRequirementPending}
        onToggleComplete={(completed) => onToggleComplete(task, completed)}
        onToggleRequirement={onToggleRequirement}
        onEdit={() => onEdit(task)}
        onDelete={() => onDelete(task)}
      />
    ))}
  </section>
);
