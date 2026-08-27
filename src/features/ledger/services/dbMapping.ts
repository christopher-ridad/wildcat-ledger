// Converts between the app's camelCase types (src/types/index.ts) and the
// snake_case columns used by the Postgres schema in supabase/migrations.
// Row parameter types come from the generated schema (see
// `npm run gen:types` / src/config/database.types.ts) so a column rename or
// removal is a compile error here instead of a silent runtime mismatch.
// Columns still get cast to the app's narrower literal-union types (e.g.
// Transaction['type']) since Postgres text columns carry no such literal
// info into the generated types.

import { Database } from '../../../config/database.types';
import {
  AuditEntry,
  FinancialTask,
  FinancialTaskRequirement,
  Organization,
  PendingChange,
  Transaction,
  TransactionType,
} from '../types';
import { DocumentTypeKey } from '../utils/documentRequirements';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type OrganizationRow = Database['public']['Tables']['organizations']['Row'];
type AuditLogRow = Database['public']['Tables']['audit_log']['Row'];
type PendingChangeRow = Database['public']['Tables']['pending_changes']['Row'];
type FinancialTaskRow = Database['public']['Tables']['financial_tasks']['Row'];
type FinancialTaskRequirementRow =
  Database['public']['Tables']['financial_task_requirements']['Row'];

export const rowToTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  title: row.title,
  date: row.date ?? undefined,
  // Defensive: Postgres numeric columns can arrive over the wire as strings
  // despite the generated type saying `number`.
  amount: Number(row.amount),
  direction: row.direction as Transaction['direction'],
  type: row.type as Transaction['type'],
  funding: (row.funding as Transaction['funding']) ?? undefined,
  budgetLine: row.budget_line as Transaction['budgetLine'],
  notes: row.notes,
  zelleInfo: row.zelle_info ?? undefined,
  reimbursedMemberName: row.reimbursed_member_name ?? undefined,
  paymentStatus: (row.payment_status as Transaction['paymentStatus']) ?? undefined,
  isIndividualVendor: row.is_individual_vendor ?? undefined,
  isNorthwesternEmployee: row.is_northwestern_employee ?? undefined,
  receiptFileUrl: row.receipt_file_url ?? undefined,
  contractFileUrl: row.contract_file_url ?? undefined,
  w9FileUrl: row.w9_file_url ?? undefined,
  contractedServicesFileUrl: row.contracted_services_file_url ?? undefined,
  conflictOfInterestFileUrl: row.conflict_of_interest_file_url ?? undefined,
  specialPayFormUrl: row.special_pay_form_url ?? undefined,
  reconciledAt: row.reconciled_at ?? undefined,
  noReceiptAcknowledged: row.no_receipt_acknowledged ?? undefined,
  exemptionFormUrl: row.exemption_form_url ?? undefined,
  taxExemptFormSubmitted: row.tax_exempt_form_submitted ?? undefined,
  taxAmount: row.tax_amount != null ? Number(row.tax_amount) : undefined,
  taxReimbursed: row.tax_reimbursed ?? undefined,
  contractAcknowledgedMissing: row.contract_acknowledged_missing ?? undefined,
  w9AcknowledgedMissing: row.w9_acknowledged_missing ?? undefined,
  contractedServicesAcknowledgedMissing:
    row.contracted_services_acknowledged_missing ?? undefined,
  conflictOfInterestAcknowledgedMissing:
    row.conflict_of_interest_acknowledged_missing ?? undefined,
  specialPayFormAcknowledgedMissing:
    row.special_pay_form_acknowledged_missing ?? undefined,
  uploadTokens: row.upload_tokens as Transaction['uploadTokens'],
});

export const rowToOrganization = (
  row: OrganizationRow,
  transactions: Transaction[],
): Organization => ({
  id: row.id,
  name: row.name,
  sofoApprovers: row.sofo_approvers,
  officers: row.officers,
  budgetAllocations: row.budget_allocations as Organization['budgetAllocations'],
  isBudgetLinesSet: row.is_budget_lines_set,
  lastReconciliationDate: row.last_reconciliation_date,
  transactions,
  debitCardSettings: {
    projectId: row.debit_card_project_id ?? undefined,
    accountNumber: row.debit_card_account_number ?? undefined,
    lastFourDigits: row.debit_card_last_four ?? undefined,
    inventoryControlNumber: row.debit_card_icn ?? undefined,
    loadBalance:
      row.debit_card_load_balance != null
        ? Number(row.debit_card_load_balance)
        : undefined,
  },
});

export const rowToAuditEntry = (row: AuditLogRow): AuditEntry => ({
  id: row.id,
  action: row.action as AuditEntry['action'],
  performedBy: row.performed_by,
  timestamp: row.timestamp,
  transactionId: row.transaction_id,
  transactionTitle: row.transaction_title,
  before: row.before as AuditEntry['before'],
  after: row.after as AuditEntry['after'],
  reconciliationSummary:
    row.reconciliation_summary as AuditEntry['reconciliationSummary'],
});

export const rowToPendingChange = (row: PendingChangeRow): PendingChange => ({
  id: row.id,
  type: row.type as PendingChange['type'],
  transactionId: row.transaction_id,
  transactionTitle: row.transaction_title,
  requestedBy: row.requested_by,
  requestedAt: row.requested_at,
  before: row.before as PendingChange['before'],
  after: row.after as PendingChange['after'],
});

export const rowToFinancialTask = (row: FinancialTaskRow): FinancialTask => ({
  id: row.id,
  title: row.title,
  description: row.description ?? undefined,
  dueDate: row.due_date,
  assigneeEmail: row.assignee_email ?? undefined,
  completedAt: row.completed_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  paymentType: (row.payment_type ?? undefined) as TransactionType | undefined,
  isIndividualVendor: row.is_individual_vendor,
});

export const rowToFinancialTaskRequirement = (
  row: FinancialTaskRequirementRow,
): FinancialTaskRequirement => ({
  id: row.id,
  taskId: row.task_id,
  key: row.key as DocumentTypeKey,
  label: row.label,
  completedAt: row.completed_at,
  createdAt: row.created_at,
});
