// Converts between the app's camelCase types (src/types/index.ts) and the
// snake_case columns used by the Postgres schema in supabase/migrations.

import { AuditEntry, Organization, PendingChange, Transaction } from '../types';

export const rowToTransaction = (row: Record<string, unknown>): Transaction => ({
  id: row.id as string,
  title: row.title as string,
  date: (row.date as string) ?? undefined,
  amount: Number(row.amount),
  direction: row.direction as Transaction['direction'],
  type: row.type as Transaction['type'],
  funding: (row.funding as Transaction['funding']) ?? undefined,
  budgetLine: row.budget_line as Transaction['budgetLine'],
  notes: (row.notes as string) ?? '',
  zelleInfo: (row.zelle_info as string) ?? undefined,
  reimbursedMemberName: (row.reimbursed_member_name as string) ?? undefined,
  paymentStatus: (row.payment_status as Transaction['paymentStatus']) ?? undefined,
  isIndividualVendor: (row.is_individual_vendor as boolean) ?? undefined,
  isNorthwesternEmployee: (row.is_northwestern_employee as boolean) ?? undefined,
  receiptFileUrl: (row.receipt_file_url as string) ?? undefined,
  contractFileUrl: (row.contract_file_url as string) ?? undefined,
  w9FileUrl: (row.w9_file_url as string) ?? undefined,
  contractedServicesFileUrl: (row.contracted_services_file_url as string) ?? undefined,
  conflictOfInterestFileUrl: (row.conflict_of_interest_file_url as string) ?? undefined,
  specialPayFormUrl: (row.special_pay_form_url as string) ?? undefined,
  reconciledAt: (row.reconciled_at as number | null) ?? undefined,
  noReceiptAcknowledged: (row.no_receipt_acknowledged as boolean) ?? undefined,
  exemptionFormUrl: (row.exemption_form_url as string) ?? undefined,
});

export const rowToOrganization = (
  row: Record<string, unknown>,
  transactions: Transaction[],
): Organization => ({
  id: row.id as string,
  name: row.name as string,
  admins: (row.admins as string[]) ?? [],
  treasurer: (row.treasurer as string[]) ?? [],
  president: (row.president as string[]) ?? [],
  officers: (row.officers as string[]) ?? [],
  budgetAllocations: row.budget_allocations as Organization['budgetAllocations'],
  isBudgetLinesSet: (row.is_budget_lines_set as boolean) ?? false,
  lastReconciliationDate: (row.last_reconciliation_date as number | null) ?? null,
  transactions,
  debitCardSettings: {
    accountNumber: (row.debit_card_account_number as string) ?? undefined,
    lastFourDigits: (row.debit_card_last_four as string) ?? undefined,
    inventoryControlNumber: (row.debit_card_icn as string) ?? undefined,
    loadBalance:
      row.debit_card_load_balance != null
        ? Number(row.debit_card_load_balance)
        : undefined,
  },
});

export const rowToAuditEntry = (row: Record<string, unknown>): AuditEntry => ({
  id: row.id as string,
  action: row.action as AuditEntry['action'],
  performedBy: row.performed_by as string,
  timestamp: row.timestamp as number,
  transactionId: row.transaction_id as string,
  transactionTitle: row.transaction_title as string,
  before: row.before as AuditEntry['before'],
  after: row.after as AuditEntry['after'],
  reconciliationSummary:
    row.reconciliation_summary as AuditEntry['reconciliationSummary'],
});

export const rowToPendingChange = (row: Record<string, unknown>): PendingChange => ({
  id: row.id as string,
  type: row.type as PendingChange['type'],
  transactionId: row.transaction_id as string,
  transactionTitle: row.transaction_title as string,
  requestedBy: row.requested_by as string,
  requestedByRole: row.requested_by_role as PendingChange['requestedByRole'],
  requestedAt: row.requested_at as number,
  before: row.before as PendingChange['before'],
  after: row.after as PendingChange['after'],
});
