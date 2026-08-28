import { supabase } from '../../../config/supabase';
import { documentPath, uploadDocument } from '../services/storage';
import {
  BudgetAllocations,
  DebitCardSettings,
  PaymentStatus,
  Transaction,
  TransactionType,
  UserRole,
} from '../types';
import { requirementSeedsForPaymentType } from '../utils/financialTaskRequirements';

// All of LedgerContext's write actions (transaction CRUD, approvals,
// reconciliation, settings, document tokens), split out so LedgerContext.tsx
// itself only has to wire together data loading (useOrganizationsData),
// these mutations, and the derived selectors it exposes. Takes
// activeOrganizationId/userRole as params rather than reading them from
// context directly, since those are themselves derived in LedgerContext.tsx
// from useOrganizationsData's output.
export function useLedgerMutations(
  activeOrganizationId: string | null,
  userRole: UserRole | null,
) {
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

  // Reconciles a task's requirement checklist with what its current payment
  // type actually needs, via a diff-by-key upsert rather than a blind
  // delete-and-regenerate -- a key present both before and after (e.g.
  // 'contract'/'w9' are shared between Payment Request and Payment to NU
  // Employee) is left completely untouched, so completed_at survives
  // unrelated edits and type changes that keep an overlapping requirement.
  // Not wrapped in a transaction/RPC -- an accepted, small race window,
  // consistent with this table's already-lighter consistency bar (no audit
  // trail, no RPC-wrapping for its own CRUD either). Deliberately does not
  // re-derive "what documents does type X need" in SQL -- that logic lives
  // in exactly one place, getRequiredDocuments(), called via
  // requirementSeedsForPaymentType().
  const syncFinancialTaskRequirements = async (
    taskId: string,
    paymentType: TransactionType | undefined,
    isIndividualVendor: boolean,
  ) => {
    if (!activeOrganizationId) return;
    const desired = requirementSeedsForPaymentType(paymentType, isIndividualVendor);
    const desiredKeys = new Set(desired.map((d) => d.key));

    const { data: existing, error: readError } = await supabase
      .from('financial_task_requirements')
      .select('id, key')
      .eq('task_id', taskId);
    if (readError) throw readError;

    const existingKeys = new Set((existing ?? []).map((r) => r.key));
    const toInsert = desired.filter((d) => !existingKeys.has(d.key));
    const toDeleteIds = (existing ?? [])
      .filter((r) => !desiredKeys.has(r.key))
      .map((r) => r.id);

    if (toInsert.length) {
      const { error } = await supabase.from('financial_task_requirements').insert(
        toInsert.map((d) => ({
          task_id: taskId,
          org_id: activeOrganizationId,
          key: d.key,
          label: d.label,
        })),
      );
      if (error) throw error;
    }
    if (toDeleteIds.length) {
      const { error } = await supabase
        .from('financial_task_requirements')
        .delete()
        .in('id', toDeleteIds);
      if (error) throw error;
    }
  };

  const addFinancialTask = async (task: {
    title: string;
    description?: string;
    dueDate: string;
    assigneeEmails?: string[];
    paymentType?: TransactionType;
    isIndividualVendor?: boolean;
  }) => {
    if (userRole !== 'sofoApprover' || !activeOrganizationId) return;
    const { data, error } = await supabase
      .from('financial_tasks')
      .insert({
        org_id: activeOrganizationId,
        title: task.title,
        description: task.description ?? null,
        due_date: task.dueDate,
        assignee_emails: task.assigneeEmails ?? [],
        payment_type: task.paymentType ?? null,
        is_individual_vendor: task.isIndividualVendor ?? false,
      })
      .select('id')
      .single();
    if (error) throw error;
    await syncFinancialTaskRequirements(
      data.id,
      task.paymentType,
      task.isIndividualVendor ?? false,
    );
  };

  const updateFinancialTask = async (
    id: string,
    task: {
      title: string;
      description?: string;
      dueDate: string;
      assigneeEmails?: string[];
      paymentType?: TransactionType;
      isIndividualVendor?: boolean;
    },
  ) => {
    if (userRole !== 'sofoApprover') return;
    const { error } = await supabase
      .from('financial_tasks')
      .update({
        title: task.title,
        description: task.description ?? null,
        due_date: task.dueDate,
        assignee_emails: task.assigneeEmails ?? [],
        payment_type: task.paymentType ?? null,
        is_individual_vendor: task.isIndividualVendor ?? false,
      })
      .eq('id', id);
    if (error) throw error;
    await syncFinancialTaskRequirements(
      id,
      task.paymentType,
      task.isIndividualVendor ?? false,
    );
  };

  const deleteFinancialTask = async (id: string) => {
    if (userRole !== 'sofoApprover') return;
    const { error } = await supabase.from('financial_tasks').delete().eq('id', id);
    if (error) throw error;
  };

  // No role guard -- any org member may toggle. RLS + the update-restricting
  // trigger (migration 0030) limit a non-manager's write to just this
  // column regardless of what's sent here.
  const toggleFinancialTaskComplete = async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from('financial_tasks')
      .update({ completed_at: completed ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) throw error;
  };

  // No role guard -- any org member may toggle, same as
  // toggleFinancialTaskComplete. RLS + the requirement table's own
  // member-update-restricting trigger (migration 0031) limit a
  // non-manager's write to just this column regardless of what's sent here.
  const toggleFinancialTaskRequirement = async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from('financial_task_requirements')
      .update({ completed_at: completed ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) throw error;
  };

  return {
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
    addFinancialTask,
    updateFinancialTask,
    deleteFinancialTask,
    toggleFinancialTaskComplete,
    toggleFinancialTaskRequirement,
  };
}
