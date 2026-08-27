import { beforeEach, describe, expect, test, vi } from 'vitest';

import { supabase } from '../../../config/supabase';
import { documentPath, uploadDocument } from '../services/storage';
import { useLedgerMutations } from './useLedgerMutations';

vi.mock('../../../config/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock('../services/storage', () => ({
  documentPath: vi.fn(),
  uploadDocument: vi.fn(),
}));

const mockRpc = vi.mocked(supabase.rpc);
const mockFrom = vi.mocked(supabase.from);
const mockDocumentPath = vi.mocked(documentPath);
const mockUploadDocument = vi.mocked(uploadDocument);

// Sets up the supabase.from(table).update(patch).eq(col, val) chain used by
// updateActiveOrganization/uploadExemptionForm, and returns the `update`/`eq`
// spies so callers can assert on what was actually sent.
const mockUpdateEq = (result: { error: unknown } = { error: null }) => {
  const eq = vi.fn().mockResolvedValue(result);
  const update = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ update } as never);
  return { update, eq };
};

// Same idea as mockUpdateEq, for the plain .insert(payload) and
// .delete().eq(col, val) chains financial_tasks' mutations use.
const mockInsert = (result: { error: unknown } = { error: null }) => {
  const insert = vi.fn().mockResolvedValue(result);
  mockFrom.mockReturnValue({ insert } as never);
  return { insert };
};

const mockDeleteEq = (result: { error: unknown } = { error: null }) => {
  const eq = vi.fn().mockResolvedValue(result);
  const del = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ delete: del } as never);
  return { delete: del, eq };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateTransactionId', () => {
  test('returns a generated id when there is an active organization', () => {
    const { generateTransactionId } = useLedgerMutations('org-1', 'sofoApprover');
    expect(generateTransactionId()).toEqual(expect.any(String));
    expect(generateTransactionId().length).toBeGreaterThan(0);
  });

  test('throws when there is no active organization', () => {
    const { generateTransactionId } = useLedgerMutations(null, null);
    expect(() => generateTransactionId()).toThrow('No active organization');
  });
});

describe('addTransaction', () => {
  test('calls create_transaction_with_audit scoped to the active org, generating an id if none given', async () => {
    mockRpc.mockResolvedValue({ error: null } as never);
    const { addTransaction } = useLedgerMutations('org-1', 'officer');
    await addTransaction({ title: 'Pizza' } as never);
    expect(mockRpc).toHaveBeenCalledWith('create_transaction_with_audit', {
      p_org_id: 'org-1',
      p_transaction_id: expect.any(String),
      p_transaction: { title: 'Pizza' },
      p_upload_tokens: {},
    });
  });

  test('uses the given id and upload tokens when provided', async () => {
    mockRpc.mockResolvedValue({ error: null } as never);
    const { addTransaction } = useLedgerMutations('org-1', 'officer');
    await addTransaction({ title: 'Pizza' } as never, 'txn-1', { receipt: 'tok' });
    expect(mockRpc).toHaveBeenCalledWith('create_transaction_with_audit', {
      p_org_id: 'org-1',
      p_transaction_id: 'txn-1',
      p_transaction: { title: 'Pizza' },
      p_upload_tokens: { receipt: 'tok' },
    });
  });

  test('does nothing when there is no active organization', async () => {
    const { addTransaction } = useLedgerMutations(null, null);
    await addTransaction({ title: 'Pizza' } as never);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('throws the Supabase error when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'boom' } } as never);
    const { addTransaction } = useLedgerMutations('org-1', 'officer');
    await expect(addTransaction({ title: 'Pizza' } as never)).rejects.toEqual({
      message: 'boom',
    });
  });
});

describe('updateTransaction', () => {
  test('requests an edit when the caller is a sofoApprover', async () => {
    mockRpc.mockResolvedValue({ error: null } as never);
    const { updateTransaction } = useLedgerMutations('org-1', 'sofoApprover');
    await updateTransaction('txn-1', { title: 'New' } as never);
    expect(mockRpc).toHaveBeenCalledWith('request_transaction_change_with_audit', {
      p_org_id: 'org-1',
      p_transaction_id: 'txn-1',
      p_type: 'edit',
      p_after: { title: 'New' },
    });
  });

  test('does nothing for a non-approver role (officer)', async () => {
    const { updateTransaction } = useLedgerMutations('org-1', 'officer');
    await updateTransaction('txn-1', { title: 'New' } as never);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('does nothing when there is no role at all', async () => {
    const { updateTransaction } = useLedgerMutations('org-1', null);
    await updateTransaction('txn-1', { title: 'New' } as never);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('deleteTransaction', () => {
  test('requests a delete when the caller is a sofoApprover', async () => {
    mockRpc.mockResolvedValue({ error: null } as never);
    const { deleteTransaction } = useLedgerMutations('org-1', 'sofoApprover');
    await deleteTransaction('txn-1');
    expect(mockRpc).toHaveBeenCalledWith('request_transaction_change_with_audit', {
      p_org_id: 'org-1',
      p_transaction_id: 'txn-1',
      p_type: 'delete',
      p_after: null,
    });
  });

  test('does nothing for a non-approver role', async () => {
    const { deleteTransaction } = useLedgerMutations('org-1', 'officer');
    await deleteTransaction('txn-1');
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('updatePaymentStatus', () => {
  test('calls update_payment_status_with_audit', async () => {
    mockRpc.mockResolvedValue({ error: null } as never);
    const { updatePaymentStatus } = useLedgerMutations('org-1', 'sofoApprover');
    await updatePaymentStatus('txn-1', 'Approved');
    expect(mockRpc).toHaveBeenCalledWith('update_payment_status_with_audit', {
      p_org_id: 'org-1',
      p_transaction_id: 'txn-1',
      p_status: 'Approved',
    });
  });
});

describe('pending change resolution', () => {
  test('approvePendingChange calls resolve_pending_change_with_audit with p_approved true', async () => {
    mockRpc.mockResolvedValue({ error: null } as never);
    const { approvePendingChange } = useLedgerMutations('org-1', 'sofoApprover');
    await approvePendingChange('pending-1');
    expect(mockRpc).toHaveBeenCalledWith('resolve_pending_change_with_audit', {
      p_org_id: 'org-1',
      p_pending_id: 'pending-1',
      p_approved: true,
    });
  });

  test('rejectPendingChange calls resolve_pending_change_with_audit with p_approved false', async () => {
    mockRpc.mockResolvedValue({ error: null } as never);
    const { rejectPendingChange } = useLedgerMutations('org-1', 'sofoApprover');
    await rejectPendingChange('pending-1');
    expect(mockRpc).toHaveBeenCalledWith('resolve_pending_change_with_audit', {
      p_org_id: 'org-1',
      p_pending_id: 'pending-1',
      p_approved: false,
    });
  });

  test('cancelPendingChange calls cancel_pending_change_with_audit', async () => {
    mockRpc.mockResolvedValue({ error: null } as never);
    const { cancelPendingChange } = useLedgerMutations('org-1', 'sofoApprover');
    await cancelPendingChange('pending-1');
    expect(mockRpc).toHaveBeenCalledWith('cancel_pending_change_with_audit', {
      p_org_id: 'org-1',
      p_pending_id: 'pending-1',
    });
  });
});

describe('organization settings updates', () => {
  test('updateBudgetAllocations patches budget_allocations only', async () => {
    const { update, eq } = mockUpdateEq();
    const { updateBudgetAllocations } = useLedgerMutations('org-1', 'sofoApprover');
    const allocations = { ASG: 100, Operating: 0, Gifts: 0, 'Debit Card': 0 };
    await updateBudgetAllocations(allocations);
    expect(mockFrom).toHaveBeenCalledWith('organizations');
    expect(update).toHaveBeenCalledWith({ budget_allocations: allocations });
    expect(eq).toHaveBeenCalledWith('id', 'org-1');
  });

  test('initializeBudgetAllocations also sets is_budget_lines_set', async () => {
    const { update } = mockUpdateEq();
    const { initializeBudgetAllocations } = useLedgerMutations('org-1', 'sofoApprover');
    const allocations = { ASG: 100, Operating: 0, Gifts: 0, 'Debit Card': 0 };
    await initializeBudgetAllocations(allocations);
    expect(update).toHaveBeenCalledWith({
      budget_allocations: allocations,
      is_budget_lines_set: true,
    });
  });

  test('updateDebitCardSettings maps camelCase settings to snake_case columns, defaulting missing fields to null', async () => {
    const { update } = mockUpdateEq();
    const { updateDebitCardSettings } = useLedgerMutations('org-1', 'sofoApprover');
    await updateDebitCardSettings({ projectId: '70000001' });
    expect(update).toHaveBeenCalledWith({
      debit_card_project_id: '70000001',
      debit_card_account_number: null,
      debit_card_last_four: null,
      debit_card_icn: null,
      debit_card_load_balance: null,
    });
  });

  test('does nothing when there is no active organization', async () => {
    const { update } = mockUpdateEq();
    const { updateBudgetAllocations } = useLedgerMutations(null, null);
    await updateBudgetAllocations({ ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 0 });
    expect(update).not.toHaveBeenCalled();
  });

  test('throws when the update fails', async () => {
    mockUpdateEq({ error: { message: 'boom' } });
    const { updateBudgetAllocations } = useLedgerMutations('org-1', 'sofoApprover');
    await expect(
      updateBudgetAllocations({ ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 0 }),
    ).rejects.toEqual({ message: 'boom' });
  });
});

describe('reconcileTransactions', () => {
  test('calls reconcile_transactions_with_audit with the given ids', async () => {
    mockRpc.mockResolvedValue({ error: null } as never);
    const { reconcileTransactions } = useLedgerMutations('org-1', 'sofoApprover');
    await reconcileTransactions(['txn-1', 'txn-2']);
    expect(mockRpc).toHaveBeenCalledWith('reconcile_transactions_with_audit', {
      p_org_id: 'org-1',
      p_transaction_ids: ['txn-1', 'txn-2'],
    });
  });
});

describe('markTaxReimbursed', () => {
  test('calls mark_tax_reimbursed_with_audit', async () => {
    mockRpc.mockResolvedValue({ error: null } as never);
    const { markTaxReimbursed } = useLedgerMutations('org-1', 'sofoApprover');
    await markTaxReimbursed('txn-1');
    expect(mockRpc).toHaveBeenCalledWith('mark_tax_reimbursed_with_audit', {
      p_org_id: 'org-1',
      p_transaction_id: 'txn-1',
    });
  });
});

describe('uploadExemptionForm', () => {
  test('uploads the file then patches exemption_form_url on the transaction', async () => {
    mockDocumentPath.mockReturnValue(
      'clubs/org-1/transactions/txn-1/exemption-form_x.pdf',
    );
    mockUploadDocument.mockResolvedValue(undefined);
    const { update, eq } = mockUpdateEq();
    const { uploadExemptionForm } = useLedgerMutations('org-1', 'sofoApprover');
    const file = new File(['x'], 'exemption.pdf', { type: 'application/pdf' });

    await uploadExemptionForm('txn-1', file);

    expect(mockDocumentPath).toHaveBeenCalledWith(
      'org-1',
      'txn-1',
      file,
      'exemption-form',
    );
    expect(mockUploadDocument).toHaveBeenCalledWith(
      'clubs/org-1/transactions/txn-1/exemption-form_x.pdf',
      file,
    );
    expect(mockFrom).toHaveBeenCalledWith('transactions');
    expect(update).toHaveBeenCalledWith({
      exemption_form_url: 'clubs/org-1/transactions/txn-1/exemption-form_x.pdf',
    });
    expect(eq).toHaveBeenCalledWith('id', 'txn-1');
  });

  test('does nothing when there is no active organization', async () => {
    const { uploadExemptionForm } = useLedgerMutations(null, null);
    const file = new File(['x'], 'exemption.pdf', { type: 'application/pdf' });
    await uploadExemptionForm('txn-1', file);
    expect(mockUploadDocument).not.toHaveBeenCalled();
  });

  test('throws when the database update fails', async () => {
    mockDocumentPath.mockReturnValue(
      'clubs/org-1/transactions/txn-1/exemption-form_x.pdf',
    );
    mockUploadDocument.mockResolvedValue(undefined);
    mockUpdateEq({ error: { message: 'boom' } });
    const { uploadExemptionForm } = useLedgerMutations('org-1', 'sofoApprover');
    const file = new File(['x'], 'exemption.pdf', { type: 'application/pdf' });
    await expect(uploadExemptionForm('txn-1', file)).rejects.toEqual({
      message: 'boom',
    });
  });
});

describe('requestTransactionDocument', () => {
  test('mints a token and returns it', async () => {
    mockRpc.mockResolvedValue({ error: null } as never);
    const { requestTransactionDocument } = useLedgerMutations('org-1', 'sofoApprover');
    const token = await requestTransactionDocument('txn-1', 'receipt');
    expect(token).toEqual(expect.any(String));
    expect(mockRpc).toHaveBeenCalledWith('add_transaction_upload_tokens', {
      p_org_id: 'org-1',
      p_transaction_id: 'txn-1',
      p_tokens: { receipt: token },
    });
  });

  test('throws when there is no active organization', async () => {
    const { requestTransactionDocument } = useLedgerMutations(null, null);
    await expect(requestTransactionDocument('txn-1', 'receipt')).rejects.toThrow(
      'No active organization',
    );
  });

  test('throws the Supabase error when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'boom' } } as never);
    const { requestTransactionDocument } = useLedgerMutations('org-1', 'sofoApprover');
    await expect(requestTransactionDocument('txn-1', 'receipt')).rejects.toEqual({
      message: 'boom',
    });
  });
});

describe('addFinancialTask', () => {
  test('inserts a task scoped to the active org when the caller is a sofoApprover', async () => {
    const { insert } = mockInsert();
    const { addFinancialTask } = useLedgerMutations('org-1', 'sofoApprover');
    await addFinancialTask({
      title: 'Submit Contract',
      dueDate: '2026-09-15',
      assigneeEmail: 'officer@u.northwestern.edu',
    });
    expect(mockFrom).toHaveBeenCalledWith('financial_tasks');
    expect(insert).toHaveBeenCalledWith({
      org_id: 'org-1',
      title: 'Submit Contract',
      description: null,
      due_date: '2026-09-15',
      assignee_email: 'officer@u.northwestern.edu',
    });
  });

  test('does nothing for a non-approver role (officer)', async () => {
    const { insert } = mockInsert();
    const { addFinancialTask } = useLedgerMutations('org-1', 'officer');
    await addFinancialTask({ title: 'Submit Contract', dueDate: '2026-09-15' });
    expect(insert).not.toHaveBeenCalled();
  });

  test('does nothing when there is no active organization', async () => {
    const { insert } = mockInsert();
    const { addFinancialTask } = useLedgerMutations(null, 'sofoApprover');
    await addFinancialTask({ title: 'Submit Contract', dueDate: '2026-09-15' });
    expect(insert).not.toHaveBeenCalled();
  });

  test('throws when the insert fails', async () => {
    mockInsert({ error: { message: 'boom' } });
    const { addFinancialTask } = useLedgerMutations('org-1', 'sofoApprover');
    await expect(
      addFinancialTask({ title: 'Submit Contract', dueDate: '2026-09-15' }),
    ).rejects.toEqual({ message: 'boom' });
  });
});

describe('updateFinancialTask', () => {
  test('patches the task when the caller is a sofoApprover', async () => {
    const { update, eq } = mockUpdateEq();
    const { updateFinancialTask } = useLedgerMutations('org-1', 'sofoApprover');
    await updateFinancialTask('task-1', {
      title: 'Updated Title',
      dueDate: '2026-10-01',
    });
    expect(mockFrom).toHaveBeenCalledWith('financial_tasks');
    expect(update).toHaveBeenCalledWith({
      title: 'Updated Title',
      description: null,
      due_date: '2026-10-01',
      assignee_email: null,
    });
    expect(eq).toHaveBeenCalledWith('id', 'task-1');
  });

  test('does nothing for a non-approver role', async () => {
    const { update } = mockUpdateEq();
    const { updateFinancialTask } = useLedgerMutations('org-1', 'officer');
    await updateFinancialTask('task-1', { title: 'x', dueDate: '2026-10-01' });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('deleteFinancialTask', () => {
  test('deletes the task when the caller is a sofoApprover', async () => {
    const { delete: del, eq } = mockDeleteEq();
    const { deleteFinancialTask } = useLedgerMutations('org-1', 'sofoApprover');
    await deleteFinancialTask('task-1');
    expect(mockFrom).toHaveBeenCalledWith('financial_tasks');
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'task-1');
  });

  test('does nothing for a non-approver role', async () => {
    const { delete: del } = mockDeleteEq();
    const { deleteFinancialTask } = useLedgerMutations('org-1', 'officer');
    await deleteFinancialTask('task-1');
    expect(del).not.toHaveBeenCalled();
  });
});

describe('toggleFinancialTaskComplete', () => {
  test('sets completed_at to an ISO timestamp when marking complete', async () => {
    const { update, eq } = mockUpdateEq();
    const { toggleFinancialTaskComplete } = useLedgerMutations('org-1', 'officer');
    await toggleFinancialTaskComplete('task-1', true);
    expect(update).toHaveBeenCalledWith({ completed_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith('id', 'task-1');
  });

  test('clears completed_at when marking incomplete, proceeding for any role', async () => {
    const { update } = mockUpdateEq();
    const { toggleFinancialTaskComplete } = useLedgerMutations('org-1', 'sofoApprover');
    await toggleFinancialTaskComplete('task-1', false);
    expect(update).toHaveBeenCalledWith({ completed_at: null });
  });

  test('throws when the update fails', async () => {
    mockUpdateEq({ error: { message: 'boom' } });
    const { toggleFinancialTaskComplete } = useLedgerMutations('org-1', 'officer');
    await expect(toggleFinancialTaskComplete('task-1', true)).rejects.toEqual({
      message: 'boom',
    });
  });
});
