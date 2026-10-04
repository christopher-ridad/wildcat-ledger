import { Json } from '../../../config/database.types';
import { supabase } from '../../../config/supabase';
import { rowToReconciliationRound } from '../services/dbMapping';
import { ReconciliationFormData } from '../services/debitCardReconciliationForm';
import {
  documentPath,
  removeTransactionDocuments,
  transactionDocumentPaths,
  uploadDocument,
} from '../services/storage';
import {
  BudgetAllocations,
  DebitCardSettings,
  PaymentStatus,
  PendingChange,
  ReconciliationRound,
  ReconciliationRoundUpdate,
  Transaction,
  UserRole,
} from '../types';

// All of LedgerContext's write actions (transaction CRUD, approvals,
// reconciliation, settings, document tokens), split out so LedgerContext.tsx
// itself only has to wire together data loading (useOrganizationsData),
// these mutations, and the derived selectors it exposes. Takes
// activeOrganizationId/userRole as params rather than reading them from
// context directly, since those are themselves derived in LedgerContext.tsx
// from useOrganizationsData's output. pendingChanges is only needed to look
// up a delete's document paths at approval time (see approvePendingChange).
export function useLedgerMutations(
  activeOrganizationId: string | null,
  userRole: UserRole | null,
  pendingChanges: PendingChange[] = [],
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
  //
  // .select().maybeSingle() (rather than a bare .update()) is deliberate: a
  // plain PATCH with no representation requested returns a 204 with no
  // error even when the "managers can update their org" RLS policy matches
  // zero rows, so a permission mismatch would otherwise silently no-op
  // instead of failing. Selecting the row back turns that into a real,
  // visible error -- maybeSingle() (not single()) so that zero-row case
  // surfaces as our own clear message below instead of PostgREST's raw,
  // confusing "Cannot coerce the result to a single JSON object".
  const updateActiveOrganization = async (patch: Record<string, unknown>) => {
    if (!activeOrganizationId) return;
    const { data, error } = await supabase
      .from('organizations')
      .update(patch)
      .eq('id', activeOrganizationId)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error(
        "This organization's settings couldn't be saved -- you may not be listed as a " +
          "SOFO Approver for it. Contact an administrator if that doesn't sound right.",
      );
    }
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

  const approvePendingChange = async (pendingId: string) => {
    const pending = pendingChanges.find((p) => p.id === pendingId);
    await callOrgRpc('resolve_pending_change_with_audit', {
      p_pending_id: pendingId,
      p_approved: true,
    });

    // Best-effort: the transaction row is already gone at this point (the
    // RPC above is the source of truth and already succeeded), so a failure
    // here just leaves an orphaned file for next time rather than blocking
    // or rolling back an approval that already went through.
    if (pending?.type === 'delete' && activeOrganizationId) {
      const paths = transactionDocumentPaths(pending.before);
      try {
        await removeTransactionDocuments(activeOrganizationId, paths);
      } catch (err) {
        console.error(
          'Failed to remove deleted transaction documents from storage:',
          err,
        );
      }
    }
  };

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
      debit_card_load_balance: settings.loadBalance ?? null,
    });

  const reconcileTransactions = async (
    transactionIds: string[],
    formData: ReconciliationFormData,
  ): Promise<ReconciliationRound> => {
    const { data, error } = await supabase.rpc('reconcile_transactions_with_audit', {
      p_org_id: activeOrganizationId ?? '',
      p_transaction_ids: transactionIds,
      p_form_data: formData as unknown as Json,
    });
    if (error) throw error;
    return rowToReconciliationRound(data);
  };

  const fetchLastReconciliation = async (): Promise<ReconciliationRound | null> => {
    if (!activeOrganizationId) return null;
    const { data, error } = await supabase
      .from('debit_card_reconciliations')
      .select('*')
      .eq('org_id', activeOrganizationId)
      .order('reconciled_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToReconciliationRound(data) : null;
  };

  // Selects the row back for the same reason updateActiveOrganization does:
  // an update RLS refuses would otherwise succeed silently.
  const updateReconciliationRound = async (
    id: string,
    patch: ReconciliationRoundUpdate,
  ): Promise<ReconciliationRound> => {
    const { data, error } = await supabase
      .from('debit_card_reconciliations')
      .update({
        ...('reloadChoice' in patch && { reload_choice: patch.reloadChoice ?? null }),
        ...('reloadTransactionId' in patch && {
          reload_transaction_id: patch.reloadTransactionId ?? null,
        }),
        ...('lastReconciliationDate' in patch && {
          last_reconciliation_date: patch.lastReconciliationDate ?? null,
        }),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new Error("Couldn't save the reconciliation. Check your permissions.");
    return rowToReconciliationRound(data);
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
    fetchLastReconciliation,
    updateReconciliationRound,
    uploadExemptionForm,
    markTaxReimbursed,
    requestTransactionDocument,
  };
}
