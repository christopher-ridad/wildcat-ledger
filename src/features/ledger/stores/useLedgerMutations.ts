import { supabase } from '../../../config/supabase';
import { documentPath, uploadDocument } from '../services/storage';
import {
  BudgetAllocations,
  DebitCardSettings,
  PaymentStatus,
  Transaction,
  UserRole,
} from '../types';

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

  const addFinancialTask = async (task: {
    title: string;
    description?: string;
    dueDate: string;
    assigneeEmail?: string;
  }) => {
    if (userRole !== 'sofoApprover' || !activeOrganizationId) return;
    const { error } = await supabase.from('financial_tasks').insert({
      org_id: activeOrganizationId,
      title: task.title,
      description: task.description ?? null,
      due_date: task.dueDate,
      assignee_email: task.assigneeEmail ?? null,
    });
    if (error) throw error;
  };

  const updateFinancialTask = async (
    id: string,
    task: {
      title: string;
      description?: string;
      dueDate: string;
      assigneeEmail?: string;
    },
  ) => {
    if (userRole !== 'sofoApprover') return;
    const { error } = await supabase
      .from('financial_tasks')
      .update({
        title: task.title,
        description: task.description ?? null,
        due_date: task.dueDate,
        assignee_email: task.assigneeEmail ?? null,
      })
      .eq('id', id);
    if (error) throw error;
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
  };
}
