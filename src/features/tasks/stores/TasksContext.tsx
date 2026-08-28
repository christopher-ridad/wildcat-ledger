import React, { createContext } from 'react';

import { useLedger } from '../../ledger/hooks/useLedger';
import { TasksContextValue } from '../types';
import { useTasksData } from './useTasksData';
import { useTasksMutations } from './useTasksMutations';

export const TasksContext = createContext<TasksContextValue | undefined>(undefined);

// Financial Tasks is its own bounded domain -- a shared to-do list, not
// financial-record data -- with its own data loading and mutations, kept
// independent of LedgerContext. It still depends on the ledger feature for
// "which org / what role" (activeOrganizationId, userRole), the same
// org-membership concept every org-scoped feature needs, rather than
// duplicating that lookup itself.
export const TasksProvider = ({ children }: { children: React.ReactNode }) => {
  const { activeOrganizationId, userRole } = useLedger();

  const { financialTasks, financialTaskRequirements } =
    useTasksData(activeOrganizationId);
  const mutations = useTasksMutations(activeOrganizationId, userRole);

  const value: TasksContextValue = {
    financialTasks,
    financialTaskRequirements,
    ...mutations,
  };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
};
