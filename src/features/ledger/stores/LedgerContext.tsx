import React, { createContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '../../../config/supabase';
import { useAuth } from '../../authentication/hooks/useAuth';
import {
  rowToAuditEntry,
  rowToOrganization,
  rowToPendingChange,
  rowToTransaction,
} from '../services/dbMapping';
import { documentPath, uploadDocument } from '../services/storage';
import {
  AuditEntry,
  BudgetAllocations,
  BudgetLine,
  DebitCardSettings,
  LedgerContextValue,
  Organization,
  PaymentStatus,
  PendingChange,
  Transaction,
  UserRole,
} from '../types';
import { applyFilters, calculateBudgetLineSummaries } from '../utils/calculations';
import { EMPTY_ALLOCATIONS } from '../utils/constants';

export const LedgerContext = createContext<LedgerContextValue | undefined>(undefined);

// Shared by the three org-scoped Realtime-backed loaders below (transactions,
// audit_log, pending_changes), which otherwise repeated this same
// select-by-org_id-and-map query shape.
async function fetchOrgRows<T>(
  table: string,
  orgId: string,
  mapRow: (row: Record<string, unknown>) => T,
  orderBy?: { column: string; ascending: boolean },
): Promise<T[]> {
  const query = supabase.from(table).select('*').eq('org_id', orgId);
  const { data } = orderBy
    ? await query.order(orderBy.column, { ascending: orderBy.ascending })
    : await query;
  return (data ?? []).map(mapRow);
}

export const LedgerProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const userEmail = user?.email ?? null;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [peopleNames, setPeopleNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
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

    loadTransactions();
    loadAuditLog();
    loadPendingChanges();

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOrganizationId]);

  const generateTransactionId = (): string => {
    if (!activeOrganizationId) throw new Error('No active organization');
    return crypto.randomUUID();
  };

  // Shared by the mutation actions below, which otherwise repeated this same
  // guard-if-no-active-org / call-rpc-scoped-to-it / throw-on-error shape.
  const callOrgRpc = async (name: string, params: Record<string, unknown> = {}) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase.rpc(name, {
      p_org_id: activeOrganizationId,
      ...params,
    });
    if (error) throw error;
  };

  // Same shape as callOrgRpc, for the mutations that patch the active
  // organization row directly instead of going through an RPC.
  const updateActiveOrganization = async (patch: Record<string, unknown>) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase
      .from('organizations')
      .update(patch)
      .eq('id', activeOrganizationId);
    if (error) throw error;
  };

  const addTransaction = async (
    transaction: Omit<Transaction, 'id'>,
    id?: string,
    uploadTokens?: Record<string, string>,
  ) => {
    const txnId = id ?? crypto.randomUUID();
    await callOrgRpc('create_transaction_with_audit', {
      p_transaction_id: txnId,
      p_transaction: transaction,
      p_upload_tokens: uploadTokens ?? {},
    });
  };

  const updateTransaction = async (id: string, transaction: Omit<Transaction, 'id'>) => {
    if (userRole !== 'sofoApprover') return;
    await callOrgRpc('request_transaction_change_with_audit', {
      p_transaction_id: id,
      p_type: 'edit',
      p_after: transaction,
    });
  };

  const deleteTransaction = async (id: string) => {
    if (userRole !== 'sofoApprover') return;
    await callOrgRpc('request_transaction_change_with_audit', {
      p_transaction_id: id,
      p_type: 'delete',
      p_after: null,
    });
  };

  const updatePaymentStatus = async (transactionId: string, status: PaymentStatus) =>
    callOrgRpc('update_payment_status_with_audit', {
      p_transaction_id: transactionId,
      p_status: status,
    });

  const approvePendingChange = async (pendingId: string) =>
    callOrgRpc('resolve_pending_change_with_audit', {
      p_pending_id: pendingId,
      p_approved: true,
    });

  const rejectPendingChange = async (pendingId: string) =>
    callOrgRpc('resolve_pending_change_with_audit', {
      p_pending_id: pendingId,
      p_approved: false,
    });

  const cancelPendingChange = async (pendingId: string) =>
    callOrgRpc('cancel_pending_change_with_audit', { p_pending_id: pendingId });

  const updateBudgetAllocations = async (allocations: BudgetAllocations) =>
    updateActiveOrganization({ budget_allocations: allocations });

  const initializeBudgetAllocations = async (allocations: BudgetAllocations) =>
    updateActiveOrganization({
      budget_allocations: allocations,
      is_budget_lines_set: true,
    });

  const updateDebitCardSettings = async (settings: DebitCardSettings) =>
    updateActiveOrganization({
      debit_card_project_id: settings.projectId ?? null,
      debit_card_account_number: settings.accountNumber ?? null,
      debit_card_last_four: settings.lastFourDigits ?? null,
      debit_card_icn: settings.inventoryControlNumber ?? null,
      debit_card_load_balance: settings.loadBalance ?? null,
    });

  const reconcileTransactions = async (transactionIds: string[]) =>
    callOrgRpc('reconcile_transactions_with_audit', {
      p_transaction_ids: transactionIds,
    });

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

  const markTaxReimbursed = async (transactionId: string) =>
    callOrgRpc('mark_tax_reimbursed_with_audit', { p_transaction_id: transactionId });

  const requestTransactionDocument = async (transactionId: string, docType: string) => {
    if (!activeOrganizationId) throw new Error('No active organization');
    const token = crypto.randomUUID();
    const { error } = await supabase.rpc('add_transaction_upload_tokens', {
      p_org_id: activeOrganizationId,
      p_transaction_id: transactionId,
      p_tokens: { [docType]: token },
    });
    if (error) throw error;
    return token;
  };

  const activeOrganization =
    organizations.find((o: Organization) => o.id === activeOrganizationId) ?? null;

  const userRole = ((): UserRole | null => {
    if (!userEmail || !activeOrganization) return null;
    if (activeOrganization.sofoApprovers?.includes(userEmail)) return 'sofoApprover';
    if (activeOrganization.officers?.includes(userEmail)) return 'officer';
    return null;
  })();
  const canEdit = userRole === 'sofoApprover';

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

  // Shared by the multiple places (transaction list, reconciliation modal)
  // that otherwise each re-scanned pendingChanges to find the one for a
  // given transaction.
  const pendingChangesByTransactionId = useMemo(
    () => new Map(pendingChanges.map((p) => [p.transactionId, p])),
    [pendingChanges],
  );
  const pendingChangeForTransaction = (transactionId: string) =>
    pendingChangesByTransactionId.get(transactionId);

  const value: LedgerContextValue = {
    auditLog,
    pendingChanges,
    pendingChangeForTransaction,
    organizations,
    loading,
    activeOrganizationId,
    setActiveOrganizationId,
    activeOrganization,
    userRole,
    canEdit,
    peopleNames,
    generateTransactionId,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updatePaymentStatus,
    approvePendingChange,
    rejectPendingChange,
    cancelPendingChange,
    updateBudgetAllocations,
    initializeBudgetAllocations,
    updateDebitCardSettings,
    reconcileTransactions,
    uploadExemptionForm,
    markTaxReimbursed,
    requestTransactionDocument,
    selectedBudgetLine,
    setSelectedBudgetLine,
    filteredTransactions,
    budgetLineSummaries,
  };

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
};
