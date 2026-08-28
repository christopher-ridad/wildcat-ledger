import { beforeEach, describe, expect, test, vi } from 'vitest';

import { supabase } from '../../../config/supabase';
import { useTasksMutations } from './useTasksMutations';

vi.mock('../../../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockFrom = vi.mocked(supabase.from);

// Sets up the supabase.from(table).update(patch).eq(col, val) chain used by
// toggleFinancialTaskComplete/toggleFinancialTaskRequirement.
const mockUpdateEq = (result: { error: unknown } = { error: null }) => {
  const eq = vi.fn().mockResolvedValue(result);
  const update = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ update } as never);
  return { update, eq };
};

// Same idea as mockUpdateEq, for the plain .delete().eq(col, val) chain
// financial_tasks' delete mutation uses.
const mockDeleteEq = (result: { error: unknown } = { error: null }) => {
  const eq = vi.fn().mockResolvedValue(result);
  const del = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ delete: del } as never);
  return { delete: del, eq };
};

// financial_task_requirements' select().eq() / insert() / delete().in()
// chains, used by syncFinancialTaskRequirements to read a task's existing
// requirement rows and diff them against the desired set.
const mockRequirementsTable = (existing: { id: string; key: string }[] = []) => {
  const eq = vi.fn().mockResolvedValue({ data: existing, error: null });
  const select = vi.fn(() => ({ eq }));
  const insert = vi.fn().mockResolvedValue({ error: null });
  const inFn = vi.fn().mockResolvedValue({ error: null });
  const del = vi.fn(() => ({ in: inFn }));
  return { select, insert, delete: del, in: inFn };
};

// Routes supabase.from('financial_tasks') to the .insert(...).select('id').
// single() chain addFinancialTask uses, and supabase.from
// ('financial_task_requirements') to the requirements table mock above, so
// the syncFinancialTaskRequirements call addFinancialTask makes afterward
// resolves correctly too.
const mockAddFinancialTask = (
  insertResult: { data: { id: string } | null; error: unknown } = {
    data: { id: 'task-1' },
    error: null,
  },
  existingRequirements: { id: string; key: string }[] = [],
) => {
  const single = vi.fn().mockResolvedValue(insertResult);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const requirements = mockRequirementsTable(existingRequirements);
  mockFrom.mockImplementation(
    (table: string) => (table === 'financial_tasks' ? { insert } : requirements) as never,
  );
  return { insert, requirements };
};

// Same idea as mockAddFinancialTask, for updateFinancialTask's
// .update(patch).eq(col, val) chain.
const mockUpdateFinancialTask = (
  updateResult: { error: unknown } = { error: null },
  existingRequirements: { id: string; key: string }[] = [],
) => {
  const eq = vi.fn().mockResolvedValue(updateResult);
  const update = vi.fn(() => ({ eq }));
  const requirements = mockRequirementsTable(existingRequirements);
  mockFrom.mockImplementation(
    (table: string) => (table === 'financial_tasks' ? { update } : requirements) as never,
  );
  return { update, eq, requirements };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addFinancialTask', () => {
  test('inserts a task scoped to the active org when the caller is a sofoApprover', async () => {
    const { insert } = mockAddFinancialTask();
    const { addFinancialTask } = useTasksMutations('org-1', 'sofoApprover');
    await addFinancialTask({
      title: 'Submit Contract',
      dueDate: '2026-09-15',
      assigneeEmails: ['officer@u.northwestern.edu'],
    });
    expect(mockFrom).toHaveBeenCalledWith('financial_tasks');
    expect(insert).toHaveBeenCalledWith({
      org_id: 'org-1',
      title: 'Submit Contract',
      description: null,
      due_date: '2026-09-15',
      assignee_emails: ['officer@u.northwestern.edu'],
      payment_type: null,
      is_individual_vendor: false,
    });
  });

  test('generates requirement rows for the task’s payment type', async () => {
    const { requirements } = mockAddFinancialTask({
      data: { id: 'task-1' },
      error: null,
    });
    const { addFinancialTask } = useTasksMutations('org-1', 'sofoApprover');
    await addFinancialTask({
      title: 'Submit Contract',
      dueDate: '2026-09-15',
      paymentType: 'Payment Request',
    });
    expect(mockFrom).toHaveBeenCalledWith('financial_task_requirements');
    expect(requirements.insert).toHaveBeenCalledWith([
      { task_id: 'task-1', org_id: 'org-1', key: 'contract', label: 'RSO Agreement' },
      { task_id: 'task-1', org_id: 'org-1', key: 'w9', label: 'W-9' },
    ]);
  });

  test('does nothing for a non-approver role (officer)', async () => {
    const { insert } = mockAddFinancialTask();
    const { addFinancialTask } = useTasksMutations('org-1', 'officer');
    await addFinancialTask({ title: 'Submit Contract', dueDate: '2026-09-15' });
    expect(insert).not.toHaveBeenCalled();
  });

  test('does nothing when there is no active organization', async () => {
    const { insert } = mockAddFinancialTask();
    const { addFinancialTask } = useTasksMutations(null, 'sofoApprover');
    await addFinancialTask({ title: 'Submit Contract', dueDate: '2026-09-15' });
    expect(insert).not.toHaveBeenCalled();
  });

  test('throws when the insert fails', async () => {
    mockAddFinancialTask({ data: null, error: { message: 'boom' } });
    const { addFinancialTask } = useTasksMutations('org-1', 'sofoApprover');
    await expect(
      addFinancialTask({ title: 'Submit Contract', dueDate: '2026-09-15' }),
    ).rejects.toEqual({ message: 'boom' });
  });
});

describe('updateFinancialTask', () => {
  test('patches the task when the caller is a sofoApprover', async () => {
    const { update, eq } = mockUpdateFinancialTask();
    const { updateFinancialTask } = useTasksMutations('org-1', 'sofoApprover');
    await updateFinancialTask('task-1', {
      title: 'Updated Title',
      dueDate: '2026-10-01',
    });
    expect(mockFrom).toHaveBeenCalledWith('financial_tasks');
    expect(update).toHaveBeenCalledWith({
      title: 'Updated Title',
      description: null,
      due_date: '2026-10-01',
      assignee_emails: [],
      payment_type: null,
      is_individual_vendor: false,
    });
    expect(eq).toHaveBeenCalledWith('id', 'task-1');
  });

  test('does nothing for a non-approver role', async () => {
    const { update } = mockUpdateEq();
    const { updateFinancialTask } = useTasksMutations('org-1', 'officer');
    await updateFinancialTask('task-1', { title: 'x', dueDate: '2026-10-01' });
    expect(update).not.toHaveBeenCalled();
  });

  test('changing payment type deletes stale requirements, inserts new ones, and leaves overlapping ones untouched', async () => {
    const { requirements } = mockUpdateFinancialTask({ error: null }, [
      { id: 'req-contract', key: 'contract' },
      { id: 'req-w9', key: 'w9' },
      { id: 'req-special', key: 'specialPayForm' },
    ]);
    const { updateFinancialTask } = useTasksMutations('org-1', 'sofoApprover');
    await updateFinancialTask('task-1', {
      title: 'Submit Contract',
      dueDate: '2026-09-15',
      paymentType: 'Payment Request',
    });
    expect(requirements.insert).not.toHaveBeenCalled();
    expect(requirements.delete).toHaveBeenCalled();
    expect(requirements.in).toHaveBeenCalledWith('id', ['req-special']);
  });

  test('leaving the payment type unchanged performs zero requirement writes', async () => {
    const { requirements } = mockUpdateFinancialTask({ error: null }, [
      { id: 'req-receipt', key: 'receipt' },
    ]);
    const { updateFinancialTask } = useTasksMutations('org-1', 'sofoApprover');
    await updateFinancialTask('task-1', {
      title: 'Reload debit card',
      dueDate: '2026-09-15',
      paymentType: 'Debit Card',
    });
    expect(requirements.insert).not.toHaveBeenCalled();
    expect(requirements.delete).not.toHaveBeenCalled();
  });

  test('clearing the payment type deletes all of its requirement rows', async () => {
    const { requirements } = mockUpdateFinancialTask({ error: null }, [
      { id: 'req-contract', key: 'contract' },
      { id: 'req-w9', key: 'w9' },
    ]);
    const { updateFinancialTask } = useTasksMutations('org-1', 'sofoApprover');
    await updateFinancialTask('task-1', {
      title: 'Submit Contract',
      dueDate: '2026-09-15',
    });
    expect(requirements.insert).not.toHaveBeenCalled();
    expect(requirements.in).toHaveBeenCalledWith('id', ['req-contract', 'req-w9']);
  });
});

describe('deleteFinancialTask', () => {
  test('deletes the task when the caller is a sofoApprover', async () => {
    const { delete: del, eq } = mockDeleteEq();
    const { deleteFinancialTask } = useTasksMutations('org-1', 'sofoApprover');
    await deleteFinancialTask('task-1');
    expect(mockFrom).toHaveBeenCalledWith('financial_tasks');
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'task-1');
  });

  test('does nothing for a non-approver role', async () => {
    const { delete: del } = mockDeleteEq();
    const { deleteFinancialTask } = useTasksMutations('org-1', 'officer');
    await deleteFinancialTask('task-1');
    expect(del).not.toHaveBeenCalled();
  });
});

describe('toggleFinancialTaskComplete', () => {
  test('sets completed_at to an ISO timestamp when marking complete', async () => {
    const { update, eq } = mockUpdateEq();
    const { toggleFinancialTaskComplete } = useTasksMutations('org-1', 'officer');
    await toggleFinancialTaskComplete('task-1', true);
    expect(update).toHaveBeenCalledWith({ completed_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith('id', 'task-1');
  });

  test('clears completed_at when marking incomplete, proceeding for any role', async () => {
    const { update } = mockUpdateEq();
    const { toggleFinancialTaskComplete } = useTasksMutations('org-1', 'sofoApprover');
    await toggleFinancialTaskComplete('task-1', false);
    expect(update).toHaveBeenCalledWith({ completed_at: null });
  });

  test('throws when the update fails', async () => {
    mockUpdateEq({ error: { message: 'boom' } });
    const { toggleFinancialTaskComplete } = useTasksMutations('org-1', 'officer');
    await expect(toggleFinancialTaskComplete('task-1', true)).rejects.toEqual({
      message: 'boom',
    });
  });
});

describe('toggleFinancialTaskRequirement', () => {
  test('sets completed_at to an ISO timestamp when marking complete', async () => {
    const { update, eq } = mockUpdateEq();
    const { toggleFinancialTaskRequirement } = useTasksMutations('org-1', 'officer');
    await toggleFinancialTaskRequirement('req-1', true);
    expect(mockFrom).toHaveBeenCalledWith('financial_task_requirements');
    expect(update).toHaveBeenCalledWith({ completed_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith('id', 'req-1');
  });

  test('clears completed_at when marking incomplete, proceeding for any role', async () => {
    const { update } = mockUpdateEq();
    const { toggleFinancialTaskRequirement } = useTasksMutations('org-1', 'sofoApprover');
    await toggleFinancialTaskRequirement('req-1', false);
    expect(update).toHaveBeenCalledWith({ completed_at: null });
  });

  test('throws when the update fails', async () => {
    mockUpdateEq({ error: { message: 'boom' } });
    const { toggleFinancialTaskRequirement } = useTasksMutations('org-1', 'officer');
    await expect(toggleFinancialTaskRequirement('req-1', true)).rejects.toEqual({
      message: 'boom',
    });
  });
});
