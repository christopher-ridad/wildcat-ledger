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

export const LedgerProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const userEmail = user?.email ?? null;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
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
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

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
          const { data: txnRows } = await supabase
            .from('transactions')
            .select('*')
            .eq('org_id', row.id);
          const transactions = (txnRows ?? []).map(rowToTransaction);
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

  const addTransaction = async (
    transaction: Omit<Transaction, 'id'>,
    id?: string,
    uploadTokens?: Record<string, string>,
  ) => {
    if (!activeOrganizationId) return;
    const txnId = id ?? crypto.randomUUID();
    const { error } = await supabase.rpc('create_transaction_with_audit', {
      p_org_id: activeOrganizationId,
      p_transaction_id: txnId,
      p_transaction: transaction,
      p_upload_tokens: uploadTokens ?? {},
    });
    if (error) throw error;
  };

  const updateTransaction = async (id: string, transaction: Omit<Transaction, 'id'>) => {
    if (!activeOrganizationId) return;
    const role = userRole;
    if (role !== 'treasurer' && role !== 'president') return;
    const { error } = await supabase.rpc('request_transaction_change_with_audit', {
      p_org_id: activeOrganizationId,
      p_transaction_id: id,
      p_type: 'edit',
      p_after: transaction,
    });
    if (error) throw error;
  };

  const deleteTransaction = async (id: string) => {
    if (!activeOrganizationId) return;
    const role = userRole;
    if (role !== 'treasurer' && role !== 'president') return;
    const { error } = await supabase.rpc('request_transaction_change_with_audit', {
      p_org_id: activeOrganizationId,
      p_transaction_id: id,
      p_type: 'delete',
      p_after: null,
    });
    if (error) throw error;
  };

  const updatePaymentStatus = async (transactionId: string, status: PaymentStatus) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase.rpc('update_payment_status_with_audit', {
      p_org_id: activeOrganizationId,
      p_transaction_id: transactionId,
      p_status: status,
    });
    if (error) throw error;
  };

  const approvePendingChange = async (pendingId: string) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase.rpc('resolve_pending_change_with_audit', {
      p_org_id: activeOrganizationId,
      p_pending_id: pendingId,
      p_approved: true,
    });
    if (error) throw error;
  };

  const rejectPendingChange = async (pendingId: string) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase.rpc('resolve_pending_change_with_audit', {
      p_org_id: activeOrganizationId,
      p_pending_id: pendingId,
      p_approved: false,
    });
    if (error) throw error;
  };

  const cancelPendingChange = async (pendingId: string) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase.rpc('cancel_pending_change_with_audit', {
      p_org_id: activeOrganizationId,
      p_pending_id: pendingId,
    });
    if (error) throw error;
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

  const updateDebitCardSettings = async (settings: DebitCardSettings) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase
      .from('organizations')
      .update({
        debit_card_project_id: settings.projectId ?? null,
        debit_card_account_number: settings.accountNumber ?? null,
        debit_card_last_four: settings.lastFourDigits ?? null,
        debit_card_icn: settings.inventoryControlNumber ?? null,
        debit_card_load_balance: settings.loadBalance ?? null,
      })
      .eq('id', activeOrganizationId);
    if (error) throw error;
  };

  const reconcileTransactions = async (transactionIds: string[]) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase.rpc('reconcile_transactions_with_audit', {
      p_org_id: activeOrganizationId,
      p_transaction_ids: transactionIds,
    });
    if (error) throw error;
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

  const markTaxReimbursed = async (transactionId: string) => {
    if (!activeOrganizationId) return;
    const { error } = await supabase.rpc('mark_tax_reimbursed_with_audit', {
      p_org_id: activeOrganizationId,
      p_transaction_id: transactionId,
    });
    if (error) throw error;
  };

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
    loading,
    activeOrganizationId,
    setActiveOrganizationId,
    activeOrganization,
    userRole,
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
