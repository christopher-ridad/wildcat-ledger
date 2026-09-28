import { useEffect, useState } from 'react';

import { supabase } from '../../../config/supabase';
import { rowToFinancialTask, rowToFinancialTaskRequirement } from '../services/dbMapping';
import { FinancialTask, FinancialTaskRequirement } from '../types';

// Owns loading and keeping live (via Realtime) the active organization's
// financial_tasks and financial_task_requirements -- split out of the
// ledger feature's useOrganizationsData so tasks data-loading doesn't
// depend on anything transaction-specific. Takes activeOrganizationId as a
// param (from the ledger feature's org-membership state) rather than
// reading it from a shared context directly.
export function useTasksData(activeOrganizationId: string | null) {
  const [financialTasks, setFinancialTasks] = useState<FinancialTask[]>([]);
  const [financialTaskRequirements, setFinancialTaskRequirements] = useState<
    FinancialTaskRequirement[]
  >([]);

  useEffect(() => {
    if (!activeOrganizationId) {
      setFinancialTasks([]);
      setFinancialTaskRequirements([]);
      return;
    }

    // Guards against a stale response from a previous org's fetch landing
    // after the user has already switched to a different one -- unlike
    // useOrganizationsData's per-org state, financialTasks/Requirements
    // aren't keyed by org_id, so an unguarded late write here would
    // silently show the wrong org's tasks.
    let cancelled = false;

    const loadFinancialTasks = async () => {
      const { data } = await supabase
        .from('financial_tasks')
        .select('*')
        .eq('org_id', activeOrganizationId)
        .order('due_date', { ascending: true });
      if (cancelled) return;
      setFinancialTasks((data ?? []).map(rowToFinancialTask));
    };

    const loadFinancialTaskRequirements = async () => {
      const { data } = await supabase
        .from('financial_task_requirements')
        .select('*')
        .eq('org_id', activeOrganizationId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      setFinancialTaskRequirements((data ?? []).map(rowToFinancialTaskRequirement));
    };

    loadFinancialTasks();
    loadFinancialTaskRequirements();

    const channel = supabase
      .channel(`org-${activeOrganizationId}-tasks-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_tasks',
          filter: `org_id=eq.${activeOrganizationId}`,
        },
        loadFinancialTasks,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_task_requirements',
          filter: `org_id=eq.${activeOrganizationId}`,
        },
        loadFinancialTaskRequirements,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeOrganizationId]);

  return { financialTasks, financialTaskRequirements };
}
