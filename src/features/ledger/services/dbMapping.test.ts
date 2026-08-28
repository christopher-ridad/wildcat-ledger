import { describe, expect, test } from 'vitest';

import { Database } from '../../../config/database.types';
import {
  rowToAuditEntry,
  rowToFinancialTask,
  rowToFinancialTaskRequirement,
  rowToOrganization,
  rowToPendingChange,
  rowToTransaction,
} from './dbMapping';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type OrganizationRow = Database['public']['Tables']['organizations']['Row'];
type AuditLogRow = Database['public']['Tables']['audit_log']['Row'];
type PendingChangeRow = Database['public']['Tables']['pending_changes']['Row'];
type FinancialTaskRow = Database['public']['Tables']['financial_tasks']['Row'];
type FinancialTaskRequirementRow =
  Database['public']['Tables']['financial_task_requirements']['Row'];

const minimalTransactionRow: TransactionRow = {
  id: 'txn-1',
  org_id: 'org-1',
  title: 'Pizza',
  date: null,
  amount: 12.5,
  direction: 'Outflow',
  type: 'Debit Card',
  funding: null,
  budget_line: 'Debit Card',
  notes: '',
  zelle_info: null,
  reimbursed_member_name: null,
  payment_status: null,
  is_individual_vendor: null,
  is_northwestern_employee: null,
  receipt_file_url: null,
  contract_file_url: null,
  w9_file_url: null,
  contracted_services_file_url: null,
  conflict_of_interest_file_url: null,
  special_pay_form_url: null,
  exemption_form_url: null,
  reconciled_at: null,
  no_receipt_acknowledged: null,
  tax_exempt_form_submitted: null,
  tax_amount: null,
  tax_reimbursed: null,
  contract_acknowledged_missing: null,
  w9_acknowledged_missing: null,
  contracted_services_acknowledged_missing: null,
  conflict_of_interest_acknowledged_missing: null,
  special_pay_form_acknowledged_missing: null,
  upload_tokens: {},
};

describe('rowToTransaction', () => {
  test('maps a minimal row, turning every null field into undefined', () => {
    const t = rowToTransaction(minimalTransactionRow);
    expect(t).toEqual({
      id: 'txn-1',
      title: 'Pizza',
      date: undefined,
      amount: 12.5,
      direction: 'Outflow',
      type: 'Debit Card',
      funding: undefined,
      budgetLine: 'Debit Card',
      notes: '',
      zelleInfo: undefined,
      reimbursedMemberName: undefined,
      paymentStatus: undefined,
      isIndividualVendor: undefined,
      isNorthwesternEmployee: undefined,
      receiptFileUrl: undefined,
      contractFileUrl: undefined,
      w9FileUrl: undefined,
      contractedServicesFileUrl: undefined,
      conflictOfInterestFileUrl: undefined,
      specialPayFormUrl: undefined,
      reconciledAt: undefined,
      noReceiptAcknowledged: undefined,
      exemptionFormUrl: undefined,
      taxExemptFormSubmitted: undefined,
      taxAmount: undefined,
      taxReimbursed: undefined,
      contractAcknowledgedMissing: undefined,
      w9AcknowledgedMissing: undefined,
      contractedServicesAcknowledgedMissing: undefined,
      conflictOfInterestAcknowledgedMissing: undefined,
      specialPayFormAcknowledgedMissing: undefined,
      uploadTokens: {},
    });
  });

  test('maps a fully-populated row, converting snake_case to camelCase', () => {
    const row: TransactionRow = {
      ...minimalTransactionRow,
      date: '2026-01-15',
      funding: 'ASG',
      zelle_info: 'jane@example.com',
      reimbursed_member_name: 'Jane Doe',
      payment_status: 'Approved',
      is_individual_vendor: true,
      is_northwestern_employee: false,
      receipt_file_url: 'clubs/org-1/receipt.pdf',
      contract_file_url: 'clubs/org-1/contract.pdf',
      w9_file_url: 'clubs/org-1/w9.pdf',
      contracted_services_file_url: 'clubs/org-1/csf.pdf',
      conflict_of_interest_file_url: 'clubs/org-1/coi.pdf',
      special_pay_form_url: 'clubs/org-1/spf.pdf',
      exemption_form_url: 'clubs/org-1/exemption.pdf',
      reconciled_at: 1700000000000,
      no_receipt_acknowledged: true,
      tax_exempt_form_submitted: true,
      tax_amount: 3.25,
      tax_reimbursed: true,
      contract_acknowledged_missing: true,
      w9_acknowledged_missing: true,
      contracted_services_acknowledged_missing: true,
      conflict_of_interest_acknowledged_missing: true,
      special_pay_form_acknowledged_missing: true,
      upload_tokens: { w9: { token: 'tok-1', mintedAt: 1700000000000 } },
    };

    const t = rowToTransaction(row);
    expect(t.date).toBe('2026-01-15');
    expect(t.funding).toBe('ASG');
    expect(t.zelleInfo).toBe('jane@example.com');
    expect(t.reimbursedMemberName).toBe('Jane Doe');
    expect(t.paymentStatus).toBe('Approved');
    expect(t.isIndividualVendor).toBe(true);
    expect(t.isNorthwesternEmployee).toBe(false);
    expect(t.receiptFileUrl).toBe('clubs/org-1/receipt.pdf');
    expect(t.contractFileUrl).toBe('clubs/org-1/contract.pdf');
    expect(t.w9FileUrl).toBe('clubs/org-1/w9.pdf');
    expect(t.contractedServicesFileUrl).toBe('clubs/org-1/csf.pdf');
    expect(t.conflictOfInterestFileUrl).toBe('clubs/org-1/coi.pdf');
    expect(t.specialPayFormUrl).toBe('clubs/org-1/spf.pdf');
    expect(t.exemptionFormUrl).toBe('clubs/org-1/exemption.pdf');
    expect(t.reconciledAt).toBe(1700000000000);
    expect(t.noReceiptAcknowledged).toBe(true);
    expect(t.taxExemptFormSubmitted).toBe(true);
    expect(t.taxAmount).toBe(3.25);
    expect(t.taxReimbursed).toBe(true);
    expect(t.contractAcknowledgedMissing).toBe(true);
    expect(t.w9AcknowledgedMissing).toBe(true);
    expect(t.contractedServicesAcknowledgedMissing).toBe(true);
    expect(t.conflictOfInterestAcknowledgedMissing).toBe(true);
    expect(t.specialPayFormAcknowledgedMissing).toBe(true);
    expect(t.uploadTokens).toEqual({ w9: { token: 'tok-1', mintedAt: 1700000000000 } });
  });

  test('coerces amount and taxAmount to numbers when Postgres sends them as strings', () => {
    // Defensive case called out in dbMapping.ts's own comment: numeric
    // columns can arrive over the wire as strings despite the generated
    // type saying `number`.
    const row = {
      ...minimalTransactionRow,
      amount: '12.50' as unknown as number,
      tax_amount: '3.25' as unknown as number,
    };
    const t = rowToTransaction(row);
    expect(t.amount).toBe(12.5);
    expect(t.taxAmount).toBe(3.25);
  });

  test('leaves taxAmount undefined when the column is null', () => {
    const t = rowToTransaction(minimalTransactionRow);
    expect(t.taxAmount).toBeUndefined();
  });
});

const minimalOrganizationRow: OrganizationRow = {
  id: 'org-1',
  name: 'Wildcat Club',
  sofo_approvers: [],
  officers: [],
  budget_allocations: { ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 0 },
  is_budget_lines_set: false,
  last_reconciliation_date: null,
  debit_card_project_id: null,
  debit_card_account_number: null,
  debit_card_last_four: null,
  debit_card_icn: null,
  debit_card_load_balance: null,
};

describe('rowToOrganization', () => {
  test('maps a minimal row, turning null debit-card fields into undefined', () => {
    const org = rowToOrganization(minimalOrganizationRow, []);
    expect(org).toEqual({
      id: 'org-1',
      name: 'Wildcat Club',
      sofoApprovers: [],
      officers: [],
      budgetAllocations: { ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 0 },
      isBudgetLinesSet: false,
      lastReconciliationDate: null,
      transactions: [],
      debitCardSettings: {
        projectId: undefined,
        accountNumber: undefined,
        lastFourDigits: undefined,
        inventoryControlNumber: undefined,
        loadBalance: undefined,
      },
    });
  });

  test('maps a fully-populated row and passes through the given transactions', () => {
    const row: OrganizationRow = {
      ...minimalOrganizationRow,
      sofo_approvers: ['treasurer@example.com'],
      officers: ['officer@example.com'],
      is_budget_lines_set: true,
      last_reconciliation_date: 1700000000000,
      debit_card_project_id: '70000001',
      debit_card_account_number: '2000-001',
      debit_card_last_four: '1234',
      debit_card_icn: '12345678-1234567',
      debit_card_load_balance: '500.50' as unknown as number,
    };
    const transactions = [
      { id: 'txn-1' } as unknown as ReturnType<typeof rowToTransaction>,
    ];

    const org = rowToOrganization(row, transactions);
    expect(org.sofoApprovers).toEqual(['treasurer@example.com']);
    expect(org.officers).toEqual(['officer@example.com']);
    expect(org.isBudgetLinesSet).toBe(true);
    expect(org.lastReconciliationDate).toBe(1700000000000);
    expect(org.transactions).toBe(transactions);
    expect(org.debitCardSettings).toEqual({
      projectId: '70000001',
      accountNumber: '2000-001',
      lastFourDigits: '1234',
      inventoryControlNumber: '12345678-1234567',
      loadBalance: 500.5,
    });
  });
});

describe('rowToAuditEntry', () => {
  const minimalAuditLogRow: AuditLogRow = {
    id: 'audit-1',
    org_id: 'org-1',
    action: 'create',
    performed_by: 'treasurer@example.com',
    timestamp: 1700000000000,
    transaction_id: 'txn-1',
    transaction_title: 'Pizza',
    before: null,
    after: null,
    reconciliation_summary: null,
    reload_amount: null,
  };

  test('maps a minimal row', () => {
    const entry = rowToAuditEntry(minimalAuditLogRow);
    expect(entry).toEqual({
      id: 'audit-1',
      action: 'create',
      performedBy: 'treasurer@example.com',
      timestamp: 1700000000000,
      transactionId: 'txn-1',
      transactionTitle: 'Pizza',
      before: null,
      after: null,
      reconciliationSummary: null,
    });
  });

  test('maps before/after/reconciliationSummary JSON payloads', () => {
    const row: AuditLogRow = {
      ...minimalAuditLogRow,
      action: 'reconcile',
      before: { amount: 10 },
      after: { amount: 20 },
      reconciliation_summary: {
        transactionCount: 2,
        totalAmount: 30,
        exemptionCount: 1,
        transactionIds: ['txn-1', 'txn-2'],
      },
    };
    const entry = rowToAuditEntry(row);
    expect(entry.before).toEqual({ amount: 10 });
    expect(entry.after).toEqual({ amount: 20 });
    expect(entry.reconciliationSummary).toEqual({
      transactionCount: 2,
      totalAmount: 30,
      exemptionCount: 1,
      transactionIds: ['txn-1', 'txn-2'],
    });
  });
});

describe('rowToPendingChange', () => {
  const minimalPendingChangeRow: PendingChangeRow = {
    id: 'pending-1',
    org_id: 'org-1',
    type: 'delete',
    transaction_id: 'txn-1',
    transaction_title: 'Pizza',
    requested_by: 'treasurer@example.com',
    requested_at: 1700000000000,
    before: { amount: 10 },
    after: null,
  };

  test('maps a minimal (delete-type) row', () => {
    const pending = rowToPendingChange(minimalPendingChangeRow);
    expect(pending).toEqual({
      id: 'pending-1',
      type: 'delete',
      transactionId: 'txn-1',
      transactionTitle: 'Pizza',
      requestedBy: 'treasurer@example.com',
      requestedAt: 1700000000000,
      before: { amount: 10 },
      after: null,
    });
  });

  test('maps an edit-type row with an after payload', () => {
    const row: PendingChangeRow = {
      ...minimalPendingChangeRow,
      type: 'edit',
      after: { amount: 20 },
    };
    const pending = rowToPendingChange(row);
    expect(pending.type).toBe('edit');
    expect(pending.after).toEqual({ amount: 20 });
  });
});

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
