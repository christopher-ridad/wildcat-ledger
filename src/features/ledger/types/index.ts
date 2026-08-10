export type BudgetLine = 'ASG' | 'Operating' | 'Gifts' | 'Debit Card';

export type Funding = 'ASG' | 'Operating' | 'Gifts';

export type TransactionType =
  'Reimbursement' | 'Debit card purchase' | 'Direct payment' | 'Deposit';

export type TransactionDirection = 'Inflow' | 'Outflow';

// Direct Payment / Reimbursement only — tracks real-world fulfillment,
// distinct from PendingChange (which governs edits/deletes to the record
// itself). Debit Card purchases use reconciledAt instead; Deposits don't
// need a status.
export type PaymentStatus = 'Pending' | 'Approved' | 'Paid';

export interface Transaction {
  id: string;
  title: string;
  date?: string; // stored as YYYY-MM-DD
  amount: number;
  direction: TransactionDirection;
  type: TransactionType;
  funding?: Funding;
  budgetLine: BudgetLine;
  notes: string;
  // Reimbursement
  zelleInfo?: string;
  reimbursedMemberName?: string;
  // Direct payment / Reimbursement
  paymentStatus?: PaymentStatus;
  // Direct payment
  isIndividualVendor?: boolean;
  // Special Pay Form required when the payee is a Northwestern employee
  isNorthwesternEmployee?: boolean;
  // Storage object paths (Supabase Storage, 'documents' bucket)
  receiptFileUrl?: string;
  contractFileUrl?: string;
  w9FileUrl?: string;
  contractedServicesFileUrl?: string;
  conflictOfInterestFileUrl?: string;
  specialPayFormUrl?: string;
  // Reconciliation — Debit Card transactions only
  // null = not yet reconciled; number = epoch ms when reconciled
  reconciledAt?: number | null;
  // Set when the user explicitly acknowledges they have no receipt at submission time
  noReceiptAcknowledged?: boolean;
  // Uploaded when the transaction has no receipt (satisfies receipt requirement for reconciliation)
  exemptionFormUrl?: string;
}

export type AuditAction =
  | 'create'
  | 'edit'
  | 'delete'
  | 'request_edit'
  | 'request_delete'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'reconcile'
  | 'reload_request'
  | 'payment_status_change';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  performedBy: string;
  timestamp: number;
  transactionId: string;
  transactionTitle: string;
  before: Omit<Transaction, 'id'> | null;
  after: Omit<Transaction, 'id'> | null;
  reconciliationSummary?: {
    transactionCount: number;
    totalAmount: number;
    exemptionCount: number;
    transactionIds: string[];
  };
  reloadAmount?: number;
}

export interface ReloadRequest {
  id: string;
  amount: number;
  requestedBy: string;
  requestedAt: number;
  reconciledTotal: number;
  transactionCount: number;
}

export interface BudgetLineSummaryData {
  line: BudgetLine;
  balance: number;
  inflow: number;
  outflow: number;
}

export type BudgetAllocations = Record<BudgetLine, number>;

export interface PendingChange {
  id: string;
  type: 'edit' | 'delete';
  transactionId: string;
  transactionTitle: string;
  requestedBy: string;
  requestedByRole: 'treasurer' | 'president';
  requestedAt: number;
  before: Omit<Transaction, 'id'>;
  after: Omit<Transaction, 'id'> | null;
}

export type UserRole = 'treasurer' | 'president' | 'officer';

export interface Organization {
  id: string;
  name: string;
  admins: string[];
  treasurer?: string[];
  president?: string[];
  officers?: string[];
  budgetAllocations: BudgetAllocations;
  isBudgetLinesSet: boolean;
  transactions: Transaction[];
  // Reconciliation — epoch ms of the last completed reconciliation,
  // or the first transaction timestamp if never reconciled
  lastReconciliationDate?: number | null;
}

export interface LedgerContextValue {
  auditLog: AuditEntry[];
  pendingChanges: PendingChange[];
  organizations: Organization[];
  // True until the initial organizations fetch for the current user resolves.
  // Distinguishes "still loading" from "genuinely no active org" so pages
  // don't redirect away before data has a chance to arrive.
  loading: boolean;
  activeOrganizationId: string | null;
  setActiveOrganizationId: (id: string) => void;
  activeOrganization: Organization | null;
  userRole: UserRole | null;
  generateTransactionId: () => string;
  addTransaction: (
    transaction: Omit<Transaction, 'id'>,
    id?: string,
    uploadTokens?: Record<string, string>,
  ) => Promise<void>;
  updateTransaction: (id: string, transaction: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updatePaymentStatus: (transactionId: string, status: PaymentStatus) => Promise<void>;
  approvePendingChange: (pendingId: string) => Promise<void>;
  rejectPendingChange: (pendingId: string) => Promise<void>;
  cancelPendingChange: (pendingId: string) => Promise<void>;
  updateBudgetAllocations: (allocations: BudgetAllocations) => Promise<void>;
  initializeBudgetAllocations: (allocations: BudgetAllocations) => Promise<void>;
  reconcileTransactions: (transactionIds: string[]) => Promise<void>;
  uploadExemptionForm: (transactionId: string, file: File) => Promise<void>;
  reloadRequests: ReloadRequest[];
  requestReload: (
    amount: number,
    reconciledTotal: number,
    transactionCount: number,
  ) => Promise<void>;
  selectedBudgetLine: BudgetLine | null;
  setSelectedBudgetLine: (line: BudgetLine | null) => void;
  filteredTransactions: Transaction[];
  budgetLineSummaries: BudgetLineSummaryData[];
}
