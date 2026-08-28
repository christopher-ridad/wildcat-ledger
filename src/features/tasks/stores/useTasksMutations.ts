import { supabase } from '../../../config/supabase';
import { TransactionType, UserRole } from '../../ledger/types';
import { requirementSeedsForPaymentType } from '../utils/financialTaskRequirements';

// This feature's write actions (financial task CRUD, completion toggling,
// requirement-checklist toggling), split out of the ledger feature's
// useLedgerMutations. Takes activeOrganizationId/userRole as params rather
// than reading them from context directly, since those are themselves
// derived in the ledger feature from its own data loading.
export function useTasksMutations(
  activeOrganizationId: string | null,
  userRole: UserRole | null,
) {
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
    addFinancialTask,
    updateFinancialTask,
    deleteFinancialTask,
    toggleFinancialTaskComplete,
    toggleFinancialTaskRequirement,
  };
}
