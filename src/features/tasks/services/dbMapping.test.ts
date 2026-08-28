import { describe, expect, test } from 'vitest';

import { Database } from '../../../config/database.types';
import { rowToFinancialTask, rowToFinancialTaskRequirement } from './dbMapping';

type FinancialTaskRow = Database['public']['Tables']['financial_tasks']['Row'];
type FinancialTaskRequirementRow =
  Database['public']['Tables']['financial_task_requirements']['Row'];

describe('rowToFinancialTask', () => {
  const minimalFinancialTaskRow: FinancialTaskRow = {
    id: 'task-1',
    org_id: 'org-1',
    title: 'Submit Contract',
    description: null,
    due_date: '2026-09-15',
    assignee_emails: [],
    completed_at: null,
    created_by: 'treasurer@example.com',
    created_at: '2026-08-01T00:00:00.000Z',
    payment_type: null,
    is_individual_vendor: false,
  };

  test('maps a minimal (no description/assignees, incomplete, no payment type) row', () => {
    const task = rowToFinancialTask(minimalFinancialTaskRow);
    expect(task).toEqual({
      id: 'task-1',
      title: 'Submit Contract',
      description: undefined,
      dueDate: '2026-09-15',
      assigneeEmails: [],
      completedAt: null,
      createdBy: 'treasurer@example.com',
      createdAt: '2026-08-01T00:00:00.000Z',
      paymentType: undefined,
      isIndividualVendor: false,
    });
  });

  test('passes through description, assignees, and a completed_at timestamp', () => {
    const row: FinancialTaskRow = {
      ...minimalFinancialTaskRow,
      description: 'Send the signed copy to SOFO',
      assignee_emails: ['officer@u.northwestern.edu', 'president@u.northwestern.edu'],
      completed_at: '2026-09-10T12:00:00.000Z',
    };
    const task = rowToFinancialTask(row);
    expect(task.description).toBe('Send the signed copy to SOFO');
    expect(task.assigneeEmails).toEqual([
      'officer@u.northwestern.edu',
      'president@u.northwestern.edu',
    ]);
    expect(task.completedAt).toBe('2026-09-10T12:00:00.000Z');
  });

  test('passes through payment type and isIndividualVendor', () => {
    const row: FinancialTaskRow = {
      ...minimalFinancialTaskRow,
      payment_type: 'Payment Request',
      is_individual_vendor: true,
    };
    const task = rowToFinancialTask(row);
    expect(task.paymentType).toBe('Payment Request');
    expect(task.isIndividualVendor).toBe(true);
  });
});

describe('rowToFinancialTaskRequirement', () => {
  const minimalRequirementRow: FinancialTaskRequirementRow = {
    id: 'req-1',
    task_id: 'task-1',
    org_id: 'org-1',
    key: 'contract',
    label: 'RSO Agreement',
    completed_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
  };

  test('maps a minimal (incomplete) row', () => {
    const requirement = rowToFinancialTaskRequirement(minimalRequirementRow);
    expect(requirement).toEqual({
      id: 'req-1',
      taskId: 'task-1',
      key: 'contract',
      label: 'RSO Agreement',
      completedAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    });
  });

  test('passes through a completed_at timestamp', () => {
    const requirement = rowToFinancialTaskRequirement({
      ...minimalRequirementRow,
      completed_at: '2026-09-10T12:00:00.000Z',
    });
    expect(requirement.completedAt).toBe('2026-09-10T12:00:00.000Z');
  });
});
