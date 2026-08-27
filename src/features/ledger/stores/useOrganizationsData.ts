import { useEffect, useState } from 'react';

import { supabase } from '../../../config/supabase';
import {
  rowToAuditEntry,
  rowToFinancialTask,
  rowToFinancialTaskRequirement,
  rowToOrganization,
  rowToPendingChange,
  rowToTransaction,
} from '../services/dbMapping';
import {
  AuditEntry,
  BudgetLine,
  FinancialTask,
  FinancialTaskRequirement,
  Organization,
  PendingChange,
} from '../types';

// Shared by the three org-scoped Realtime-backed loaders below (transactions,
// audit_log, pending_changes), which otherwise repeated this same
// select-by-org_id-and-map query shape. Row defaults to the untyped shape
// the (untyped) supabase client actually returns; callers passing one of the
// dbMapping.ts row-mapper functions get Row inferred from that function's
// declared (generated-schema) parameter type instead.
async function fetchOrgRows<T, Row = Record<string, unknown>>(
  table: string,
  orgId: string,
  mapRow: (row: Row) => T,
  orderBy?: { column: string; ascending: boolean },
): Promise<T[]> {
  const query = supabase.from(table).select('*').eq('org_id', orgId);
  const { data } = orderBy
    ? await query.order(orderBy.column, { ascending: orderBy.ascending })
    : await query;
  return (data ?? []).map((row) => mapRow(row as Row));
}

// Owns loading and keeping live (via Realtime) everything LedgerContext
// reads from the database: the current user's organizations (each with its
// transactions), the people directory, and the active organization's audit
// log and pending changes. Split out of LedgerContext.tsx so that file's
// mutation actions and derived selectors aren't tangled up with this
// data-loading/subscription plumbing.
export function useOrganizationsData(userEmail: string | null) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [peopleNames, setPeopleNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [financialTasks, setFinancialTasks] = useState<FinancialTask[]>([]);
  const [financialTaskRequirements, setFinancialTaskRequirements] = useState<
    FinancialTaskRequirement[]
  >([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(
    () => localStorage.getItem('activeOrganizationId'),
  );
  const [selectedBudgetLine, setSelectedBudgetLine] = useState<BudgetLine | null>(null);

  const setActiveOrganizationId = (id: string) => {
    localStorage.setItem('activeOrganizationId', id);
    setActiveOrganizationIdState(id);
  };

  // Load orgs the user belongs to (RLS already restricts the select to those
  // rows), each with its transactions, and keep them live via Realtime.
  useEffect(() => {
    if (!userEmail) {
      setOrganizations([]);
      setPeopleNames({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // One-time fetch (not kept live via Realtime) -- a name directory
    // rarely changes, and a stale name just means a page refresh away.
    const loadPeopleNames = async () => {
      const { data } = await supabase.from('people').select('email, name');
      if (!cancelled) {
        setPeopleNames(Object.fromEntries((data ?? []).map((p) => [p.email, p.name])));
      }
    };
    loadPeopleNames();

    const loadOrganizations = async () => {
      const { data: orgRows, error: orgError } = await supabase
        .from('organizations')
        .select('*');
      if (orgError) {
        console.error('Failed to load organizations:', orgError);
        if (!cancelled) setLoading(false);
        return;
      }
      if (!orgRows) {
        if (!cancelled) setLoading(false);
        return;
      }

      const orgs: Organization[] = await Promise.all(
        orgRows.map(async (row) => {
          const transactions = await fetchOrgRows(
            'transactions',
            row.id,
            rowToTransaction,
          );
          return rowToOrganization(row, transactions);
        }),
      );

      if (!cancelled) {
        setOrganizations(orgs);
        setLoading(false);
      }
    };

    loadOrganizations();

    const channel = supabase
      .channel('organizations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organizations' },
        () => loadOrganizations(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userEmail]);

  // When the active org changes, keep its transactions/audit log/pending
  // changes live via Realtime.
  useEffect(() => {
    if (!activeOrganizationId) return;

    const loadTransactions = async () => {
      const transactions = await fetchOrgRows(
        'transactions',
        activeOrganizationId,
        rowToTransaction,
      );
      setOrganizations((prev) =>
        prev.map((o) => (o.id === activeOrganizationId ? { ...o, transactions } : o)),
      );
    };

    const loadAuditLog = async () => {
      setAuditLog(
        await fetchOrgRows('audit_log', activeOrganizationId, rowToAuditEntry, {
          column: 'timestamp',
          ascending: false,
        }),
      );
    };

    const loadPendingChanges = async () => {
      setPendingChanges(
        await fetchOrgRows('pending_changes', activeOrganizationId, rowToPendingChange, {
          column: 'requested_at',
          ascending: false,
        }),
      );
    };

    const loadFinancialTasks = async () => {
      setFinancialTasks(
        await fetchOrgRows('financial_tasks', activeOrganizationId, rowToFinancialTask, {
          column: 'due_date',
          ascending: true,
        }),
      );
    };

    const loadFinancialTaskRequirements = async () => {
      setFinancialTaskRequirements(
        await fetchOrgRows(
          'financial_task_requirements',
          activeOrganizationId,
          rowToFinancialTaskRequirement,
          { column: 'created_at', ascending: true },
        ),
      );
    };

    loadTransactions();
    loadAuditLog();
    loadPendingChanges();
    loadFinancialTasks();
    loadFinancialTaskRequirements();

    const channel = supabase
      .channel(`org-${activeOrganizationId}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `org_id=eq.${activeOrganizationId}`,
        },
        loadTransactions,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_log',
          filter: `org_id=eq.${activeOrganizationId}`,
        },
        loadAuditLog,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_changes',
          filter: `org_id=eq.${activeOrganizationId}`,
        },
        loadPendingChanges,
      )
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
      supabase.removeChannel(channel);
    };
  }, [activeOrganizationId]);

  return {
    organizations,
    peopleNames,
    loading,
    auditLog,
    pendingChanges,
    financialTasks,
    financialTaskRequirements,
    activeOrganizationId,
    setActiveOrganizationId,
    selectedBudgetLine,
    setSelectedBudgetLine,
  };
}
