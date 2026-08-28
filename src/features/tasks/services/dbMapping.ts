// Converts between this feature's camelCase types (../types) and the
// snake_case columns used by the Postgres schema in supabase/migrations.
// Row parameter types come from the generated schema (see
// `npm run gen:types` / src/config/database.types.ts) so a column rename or
// removal is a compile error here instead of a silent runtime mismatch.

import { Database } from '../../../config/database.types';
import { TransactionType } from '../../ledger/types';
import { DocumentTypeKey } from '../../ledger/utils/documentRequirements';
import { FinancialTask, FinancialTaskRequirement } from '../types';

type FinancialTaskRow = Database['public']['Tables']['financial_tasks']['Row'];
type FinancialTaskRequirementRow =
  Database['public']['Tables']['financial_task_requirements']['Row'];

export const rowToFinancialTask = (row: FinancialTaskRow): FinancialTask => ({
  id: row.id,
  title: row.title,
  description: row.description ?? undefined,
  dueDate: row.due_date,
  assigneeEmails: row.assignee_emails,
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
