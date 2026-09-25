import { TransactionType } from '../../ledger/types';
import type { DocumentTypeKey } from '../../ledger/utils/documentRequirements';

// Ad-hoc financial deadlines an org's SOFO approvers track for themselves
// (e.g. "Submit Contract for X"), shown as a timeline. Not financial-record
// data -- no audit trail, no approval workflow, just a shared to-do list.
export interface FinancialTask {
  id: string;
  title: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  assigneeEmails: string[];
  // undefined/null = not yet done.
  completedAt?: string | null;
  createdBy: string;
  createdAt: string;
  // Reuses the same TransactionType vocabulary as transactions.type --
  // selecting one auto-generates this task's requirement checklist (see
  // utils/financialTaskRequirements.ts). Optional: not every to-do is a
  // payment.
  paymentType?: TransactionType;
  // Both only meaningful when paymentType === 'Payment Request', same as on
  // Transaction.
  isIndividualVendor?: boolean;
  isExistingVendor?: boolean;
}

// One auto-generated document-requirement checklist item on a
// payment-type-having FinancialTask (see
// utils/financialTaskRequirements.ts's requirementSeedsForTask, which
// derives these from the same getRequiredDocuments() transactions already
// use). label is a snapshot taken at generation time, not a live lookup --
// see migration 0031.
export interface FinancialTaskRequirement {
  id: string;
  taskId: string;
  key: DocumentTypeKey;
  label: string;
  // undefined/null = not yet done.
  completedAt?: string | null;
  createdAt: string;
}

// What a SOFO Approver fills in when creating or editing a financial task.
export type FinancialTaskInput = Pick<
  FinancialTask,
  | 'title'
  | 'description'
  | 'dueDate'
  | 'paymentType'
  | 'isIndividualVendor'
  | 'isExistingVendor'
> & { assigneeEmails?: string[] };

export interface TasksContextValue {
  financialTasks: FinancialTask[];
  addFinancialTask: (task: FinancialTaskInput) => Promise<void>;
  updateFinancialTask: (id: string, task: FinancialTaskInput) => Promise<void>;
  deleteFinancialTask: (id: string) => Promise<void>;
  toggleFinancialTaskComplete: (id: string, completed: boolean) => Promise<void>;
  financialTaskRequirements: FinancialTaskRequirement[];
  toggleFinancialTaskRequirement: (id: string, completed: boolean) => Promise<void>;
}
