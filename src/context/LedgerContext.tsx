import React, { createContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '../config/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  AuditAction,
  AuditEntry,
  BudgetAllocations,
  BudgetLine,
  LedgerContextValue,
  Organization,
  PendingChange,
  ReloadRequest,
  Transaction,
  UserRole,
} from '../types';
import { applyFilters, calculateBudgetLineSummaries } from '../utilities/calculations';
import {
  rowToAuditEntry,
  rowToOrganization,
  rowToPendingChange,
  rowToReloadRequest,
  rowToTransaction,
  transactionToRow,
} from '../utilities/dbMapping';
import { documentPath, uploadDocument } from '../utilities/storage';

export const LedgerContext = createContext<LedgerContextValue | undefined>(undefined);

const EMPTY_ALLOCATIONS: BudgetAllocations = {
  ASG: 0,
  Operating: 0,
  Gifts: 0,
  'Debit Card': 0,
};

export const LedgerProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const userEmail = user?.email ?? null;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [reloadRequests, setReloadRequests] = useState<ReloadRequest[]>([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(
    () => localStorage.getItem('activeOrganizationId'),
  );

  const setActiveOrganizationId = (id: string) => {
    localStorage.setItem('activeOrganizationId', id);
    setActiveOrganizationIdState(id);
  };
  const [selectedBudgetLine, setSelectedBudgetLine] = useState<BudgetLine | null>(null);

  // Load orgs the user belongs to (RLS already restricts the select to those
  // rows), each with its transactions, and keep them live via Realtime.
  useEffect(() => {
    if (!userEmail) {
      setOrganizations([]);
      return;
    }

    let cancelled = false;

    const loadOrganizations = async () => {
      const { data: orgRows, error: orgError } = await supabase
        .from('organizations')
        .select('*');
      if (orgError) {
        console.error('Failed to load organizations:', orgError);
        return;
      }
      if (!orgRows) return;

      const orgs: Organization[] = await Promise.all(
        orgRows.map(async (row) => {
          const { data: txnRows } = await supabase
            .from('transactions')
            .select('*')
            .eq('org_id', row.id);
          const transactions = (txnRows ?? []).map(rowToTransaction);
          return rowToOrganization(row, transactions);
        }),
      );

      if (!cancelled) setOrganizations(orgs);
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
  // changes/reload requests live via Realtime.
  useEffect(() => {
    if (!activeOrganizationId) return;

    const loadTransactions = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('org_id', activeOrganizationId);
      const transactions = (data ?? []).map(rowToTransaction);
      setOrganizations((prev) =>
        prev.map((o) => (o.id === activeOrganizationId ? { ...o, transactions } : o)),
      );
    };

    const loadAuditLog = async () => {
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .eq('org_id', activeOrganizationId)
        .order('timestamp', { ascending: false });
      setAuditLog((data ?? []).map(rowToAuditEntry));
    };

    const loadPendingChanges = async () => {
      const { data } = await supabase
        .from('pending_changes')
        .select('*')
        .eq('org_id', activeOrganizationId)
        .order('requested_at', { ascending: false });
      setPendingChanges((data ?? []).map(rowToPendingChange));
    };

    const loadReloadRequests = async () => {
      const { data } = await supabase
        .from('reload_requests')
        .select('*')
        .eq('org_id', activeOrganizationId)
        .order('requested_at', { ascending: false });
      setReloadRequests((data ?? []).map(rowToReloadRequest));
    };

    loadTransactions();
    loadAuditLog();
    loadPendingChanges();
    loadReloadRequests();

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
          table: 'reload_requests',
          filter: `org_id=eq.${activeOrganizationId}`,
        },
        loadReloadRequests,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOrganizationId]);

  const writeAuditEntry = async (
    action: AuditAction,
    transactionId: string,
    transactionTitle: string,
    before: Omit<Transaction, 'id'> | null,
    after: Omit<Transaction, 'id'> | null,
    extra?: {
      reconciliationSummary?: AuditEntry['reconciliationSummary'];
      reloadAmount?: number;
    },
  ) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase.from('audit_log').insert({
      org_id: activeOrganizationId,
      action,
      performed_by: userEmail ?? 'unknown',
      timestamp: Date.now(),
      transaction_id: transactionId,
      transaction_title: transactionTitle,
      before,
      after,
      reconciliation_summary: extra?.reconciliationSummary ?? null,
      reload_amount: extra?.reloadAmount ?? null,
    });
    if (error) throw error;
  };

  const omitId = (t: Transaction): Omit<Transaction, 'id'> => {
    const { id: omitted, ...rest } = t;
    void omitted;
    return rest;
  };

  const generateTransactionId = (): string => {
    if (!activeOrganizationId) throw new Error('No active organization');
    return crypto.randomUUID();
  };

  // Outflows decrease a budget line's balance, inflows increase it; reversing
  // a transaction (edit/delete) just negates this same signed amount.
  const signedAmount = (t: Pick<Transaction, 'direction' | 'amount'>): number =>
    t.direction === 'Inflow' ? t.amount : -t.amount;

  const adjustBudgetAllocation = async (line: BudgetLine, delta: number) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase.rpc('adjust_budget_allocation', {
      p_org_id: activeOrganizationId,
      p_line: line,
      p_delta: delta,
    });
    if (error) throw error;
  };

  const addTransaction = async (
    transaction: Omit<Transaction, 'id'>,
    id?: string,
    uploadTokens?: Record<string, string>,
  ) => {
    if (!activeOrganizationId) return;
    const txnId = id ?? crypto.randomUUID();
    const { error } = await supabase.from('transactions').insert({
      id: txnId,
      org_id: activeOrganizationId,
      ...transactionToRow(transaction),
      upload_tokens: uploadTokens ?? {},
    });
    if (error) throw error;
    await adjustBudgetAllocation(transaction.budgetLine, signedAmount(transaction));
    await writeAuditEntry('create', txnId, transaction.title, null, transaction);
  };

  const updateTransaction = async (id: string, transaction: Omit<Transaction, 'id'>) => {
    if (!activeOrganizationId) return;
    const role = userRole;
    if (role !== 'treasurer' && role !== 'president') return;
    const old = activeOrganization?.transactions.find((t) => t.id === id);
    if (!old) return;
    if (old.budgetLine === 'Debit Card' && old.reconciledAt != null) {
      throw new Error('This transaction has been reconciled and cannot be edited.');
    }
    const { error } = await supabase.from('pending_changes').insert({
      org_id: activeOrganizationId,
      type: 'edit',
      transaction_id: id,
      transaction_title: transaction.title,
      requested_by: userEmail ?? 'unknown',
      requested_by_role: role,
      requested_at: Date.now(),
      before: omitId(old),
      after: transaction,
    });
    if (error) throw error;
    await writeAuditEntry(
      'request_edit',
      id,
      transaction.title,
      omitId(old),
      transaction,
    );
  };

  const deleteTransaction = async (id: string) => {
    if (!activeOrganizationId) return;
    const role = userRole;
    if (role !== 'treasurer' && role !== 'president') return;
    const old = activeOrganization?.transactions.find((t) => t.id === id);
    if (!old) return;
    if (old.budgetLine === 'Debit Card' && old.reconciledAt != null) {
      throw new Error('This transaction has been reconciled and cannot be deleted.');
    }
    const { error } = await supabase.from('pending_changes').insert({
      org_id: activeOrganizationId,
      type: 'delete',
      transaction_id: id,
      transaction_title: old.title,
      requested_by: userEmail ?? 'unknown',
      requested_by_role: role,
      requested_at: Date.now(),
      before: omitId(old),
      after: null,
    });
    if (error) throw error;
    await writeAuditEntry('request_delete', id, old.title, omitId(old), null);
  };

  const approvePendingChange = async (pendingId: string) => {
    if (!activeOrganizationId) return;
    const pending = pendingChanges.find((p) => p.id === pendingId);
    if (!pending) return;

    await writeAuditEntry(
      'approve',
      pending.transactionId,
      pending.transactionTitle,
      pending.before,
      pending.after,
    );

    if (pending.type === 'edit' && pending.after) {
      const { error } = await supabase
        .from('transactions')
        .update(transactionToRow(pending.after))
        .eq('id', pending.transactionId);
      if (error) throw error;
      await adjustBudgetAllocation(
        pending.before.budgetLine,
        -signedAmount(pending.before),
      );
      await adjustBudgetAllocation(pending.after.budgetLine, signedAmount(pending.after));
    } else if (pending.type === 'delete') {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', pending.transactionId);
      if (error) throw error;
      await adjustBudgetAllocation(
        pending.before.budgetLine,
        -signedAmount(pending.before),
      );
    }

    const { error: deleteError } = await supabase
      .from('pending_changes')
      .delete()
      .eq('id', pendingId);
    if (deleteError) throw deleteError;
  };

  const rejectPendingChange = async (pendingId: string) => {
    if (!activeOrganizationId) return;
    const pending = pendingChanges.find((p) => p.id === pendingId);
    const { error } = await supabase.from('pending_changes').delete().eq('id', pendingId);
    if (error) throw error;
    setPendingChanges((prev) => prev.filter((p) => p.id !== pendingId));
    if (pending) {
      await writeAuditEntry(
        'reject',
        pending.transactionId,
        pending.transactionTitle,
        pending.before,
        pending.after,
      );
    }
  };

  const cancelPendingChange = async (pendingId: string) => {
    if (!activeOrganizationId) return;
    const pending = pendingChanges.find((p) => p.id === pendingId);
    const { error } = await supabase.from('pending_changes').delete().eq('id', pendingId);
    if (error) throw error;
    setPendingChanges((prev) => prev.filter((p) => p.id !== pendingId));
    if (pending) {
      await writeAuditEntry(
        'cancel',
        pending.transactionId,
        pending.transactionTitle,
        pending.before,
        pending.after,
      );
    }
  };

  const updateBudgetAllocations = async (allocations: BudgetAllocations) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase
      .from('organizations')
      .update({ budget_allocations: allocations })
      .eq('id', activeOrganizationId);
    if (error) throw error;
  };

  const initializeBudgetAllocations = async (allocations: BudgetAllocations) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase
      .from('organizations')
      .update({ budget_allocations: allocations, is_budget_lines_set: true })
      .eq('id', activeOrganizationId);
    if (error) throw error;
  };

  const reconcileTransactions = async (transactionIds: string[]) => {
    if (!activeOrganizationId) return;
    const now = Date.now();
    const { error: txnError } = await supabase
      .from('transactions')
      .update({ reconciled_at: now })
      .in('id', transactionIds);
    if (txnError) throw txnError;
    const { error: orgError } = await supabase
      .from('organizations')
      .update({ last_reconciliation_date: now })
      .eq('id', activeOrganizationId);
    if (orgError) throw orgError;

    const txnsToReconcile = (activeOrganization?.transactions ?? []).filter((t) =>
      transactionIds.includes(t.id),
    );
    const totalAmount = txnsToReconcile
      .filter((t) => t.direction === 'Outflow')
      .reduce((sum, t) => sum + t.amount, 0);
    const exemptionCount = txnsToReconcile.filter((t) => t.exemptionFormUrl).length;

    await writeAuditEntry(
      'reconcile',
      '',
      `${transactionIds.length} transaction${transactionIds.length !== 1 ? 's' : ''} reconciled`,
      null,
      null,
      {
        reconciliationSummary: {
          transactionCount: transactionIds.length,
          totalAmount,
          exemptionCount,
          transactionIds,
        },
      },
    );
  };

  const requestReload = async (
    amount: number,
    reconciledTotal: number,
    transactionCount: number,
  ) => {
    if (!activeOrganizationId) return;
    const now = Date.now();
    const { error } = await supabase.from('reload_requests').insert({
      org_id: activeOrganizationId,
      amount,
      requested_by: userEmail ?? 'unknown',
      requested_at: now,
      reconciled_total: reconciledTotal,
      transaction_count: transactionCount,
    });
    if (error) throw error;
    await writeAuditEntry(
      'reload_request',
      '',
      `Reload request: $${amount.toFixed(2)}`,
      null,
      null,
      {
        reloadAmount: amount,
      },
    );
  };

  const uploadExemptionForm = async (transactionId: string, file: File) => {
    if (!activeOrganizationId) return;
    const path = documentPath(
      activeOrganizationId,
      transactionId,
      file,
      'exemption-form',
    );
    await uploadDocument(path, file);
    const { error } = await supabase
      .from('transactions')
      .update({ exemption_form_url: path })
      .eq('id', transactionId);
    if (error) throw error;
  };

  const activeOrganization =
    organizations.find((o: Organization) => o.id === activeOrganizationId) ?? null;

  const userRole = ((): UserRole | null => {
    if (!userEmail || !activeOrganization) return null;
    if (activeOrganization.treasurer?.includes(userEmail)) return 'treasurer';
    if (activeOrganization.president?.includes(userEmail)) return 'president';
    if (activeOrganization.officers?.includes(userEmail)) return 'officer';
    if (activeOrganization.admins?.includes(userEmail)) return 'treasurer';
    return null;
  })();

  const transactions = activeOrganization?.transactions ?? [];
  const budgetAllocations = activeOrganization?.budgetAllocations ?? EMPTY_ALLOCATIONS;

  const filteredTransactions = useMemo(
    () => applyFilters(transactions, selectedBudgetLine),
    [transactions, selectedBudgetLine],
  );

  const budgetLineSummaries = useMemo(
    () => calculateBudgetLineSummaries(transactions, budgetAllocations),
    [transactions, budgetAllocations],
  );

  const value: LedgerContextValue = {
    auditLog,
    pendingChanges,
    organizations,
    activeOrganizationId,
    setActiveOrganizationId,
    activeOrganization,
    userRole,
    generateTransactionId,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    approvePendingChange,
    rejectPendingChange,
    cancelPendingChange,
    updateBudgetAllocations,
    initializeBudgetAllocations,
    reconcileTransactions,
    uploadExemptionForm,
    reloadRequests,
    requestReload,
    selectedBudgetLine,
    setSelectedBudgetLine,
    filteredTransactions,
    budgetLineSummaries,
  };

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
};
