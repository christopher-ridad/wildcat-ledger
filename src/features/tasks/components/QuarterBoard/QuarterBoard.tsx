import { ReactNode, useMemo, useState } from 'react';

import { FinancialTask, FinancialTaskRequirement } from '../../types';
import { currentQuarterKey, groupTasksByQuarter } from '../../utils/groupTasksByQuarter';
import { todayDateString } from '../../utils/today';
import { MonthSection } from '../MonthSection';
import { QuarterSelector } from '../QuarterSelector';
import styles from './QuarterBoard.module.css';

interface QuarterBoardProps {
  tasks: FinancialTask[];
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
  // Rendered alongside the quarter selector (e.g. "+ Add Task") so the
  // page's controls read as one grouped area instead of a separate,
  // standalone action bar floating above the selector.
  headerActions?: ReactNode;
}

export const QuarterBoard = ({
  tasks,
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
  headerActions,
}: QuarterBoardProps) => {
  const today = todayDateString();
  const quarters = useMemo(() => groupTasksByQuarter(tasks, today), [tasks, today]);
  const [selectedKey, setSelectedKey] = useState(() => currentQuarterKey(today));

  const selectedQuarter = quarters.find((q) => q.key === selectedKey) ?? quarters[0];

  return (
    <div className={styles['wl-quarter-board']}>
      <div className={styles['wl-quarter-board-controls']}>
        <QuarterSelector
          quarters={quarters}
          selectedKey={selectedQuarter.key}
          onSelect={setSelectedKey}
        />
        {headerActions}
      </div>

      <div key={selectedQuarter.key} className={styles['wl-quarter-board-panel']}>
        {selectedQuarter.months.length === 0 ? (
          <p className={styles['wl-quarter-board-empty']}>No tasks this quarter.</p>
        ) : (
          selectedQuarter.months.map((month) => (
            <MonthSection
              key={month.key}
              month={month}
              requirementsByTaskId={requirementsByTaskId}
              peopleNames={peopleNames}
              canEdit={canEdit}
              isTaskPending={isTaskPending}
              taskError={taskError}
              isRequirementPending={isRequirementPending}
              onToggleComplete={onToggleComplete}
              onToggleRequirement={onToggleRequirement}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
};
