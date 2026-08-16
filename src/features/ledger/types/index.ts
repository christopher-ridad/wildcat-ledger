export type BudgetLine = 'ASG' | 'Operating' | 'Gifts' | 'Debit Card';

export type Funding = 'ASG' | 'Operating' | 'Gifts';

// Renamed from the original 'Reimbursement' / 'Debit card purchase' /
// 'Direct payment' -- the stored value IS the display string everywhere
// (no separate label map), so existing rows need a data migration (see
// migration 0013) alongside this rename.
export type TransactionType =
  | 'Non-Officer Reimbursement'
  | 'Debit Card'
  | 'Payment Request'
  | 'Payment to NU Employee'
  | 'Deposit';

export type TransactionDirection = 'Inflow' | 'Outflow';

// Payment Request / Non-Officer Reimbursement / Payment to NU Employee, plus
// Deposits onto the Debit Card line (reloads) — tracks real-world
// fulfillment, distinct from PendingChange (which governs edits/deletes to
// the record itself). Debit Card purchases use reconciledAt instead; other
// Deposits don't need a status.
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
  // Non-Officer Reimbursement
  zelleInfo?: string;
  reimbursedMemberName?: string;
  // Payment Request / Non-Officer Reimbursement / Payment to NU Employee
  paymentStatus?: PaymentStatus;
  // Payment Request
  isIndividualVendor?: boolean;
  // Legacy field from before Payment to NU Employee was split out into its
  // own type -- new transactions no longer set this, the type itself
  // conveys it. Kept for historical Payment Request rows that used the
  // Northwestern-employee checkbox.
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
  // Explicitly acknowledged as not yet available when the transaction was
  // created/edited (see documentRequirements.ts) -- lets the transaction
  // save without the file, but keeps it out of getMissingDocuments() until
  // the file actually shows up. Payment Request / Payment to NU Employee.
  contractAcknowledgedMissing?: boolean;
  w9AcknowledgedMissing?: boolean;
  // Payment Request, individual vendor only
  contractedServicesAcknowledgedMissing?: boolean;
  conflictOfInterestAcknowledgedMissing?: boolean;
  // Payment to NU Employee
  specialPayFormAcknowledgedMissing?: boolean;
  // Single-use tokens keyed by document type (receipt/contract/w9/...),
  // minted when a document is requested via email; cleared once that
  // document is uploaded through the link. Lets the Files modal show
  // "requested, waiting on upload" instead of a stale Request button.
  uploadTokens?: Record<string, string>;
  // Debit Card purchase — orgs are tax-exempt when the exemption form is
  // presented at purchase, so tax should never legitimately show up. When
  // it does (no exemption form submitted, tax on the receipt), the full
  // amount still posts to the balance, but the transaction is flagged as
  // owing a reimbursement to SOFO until self-attested via taxReimbursed
  // (the actual payment happens on SOFO's own external form).
  taxExemptFormSubmitted?: boolean;
  taxAmount?: number;
  taxReimbursed?: boolean;
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
  | 'payment_status_change'
  | 'tax_reimbursed';

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
  requestedAt: number;
  before: Omit<Transaction, 'id'>;
  after: Omit<Transaction, 'id'> | null;
}

export type UserRole = 'sofoApprover' | 'officer';

// Needed to pre-fill the official SOFO debit card reconciliation form.
// loadBalance is the card's fixed limit, distinct from the live running
// balance in budgetAllocations['Debit Card'].
export interface DebitCardSettings {
  projectId?: string;
  accountNumber?: string;
  lastFourDigits?: string;
  inventoryControlNumber?: string;
  loadBalance?: number;
}

export interface Organization {
  id: string;
  name: string;
  sofoApprovers: string[];
  officers: string[];
  budgetAllocations: BudgetAllocations;
  isBudgetLinesSet: boolean;
  transactions: Transaction[];
  // Reconciliation — epoch ms of the last completed reconciliation,
  // or the first transaction timestamp if never reconciled
  lastReconciliationDate?: number | null;
  debitCardSettings: DebitCardSettings;
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
  updateDebitCardSettings: (settings: DebitCardSettings) => Promise<void>;
  reconcileTransactions: (transactionIds: string[]) => Promise<void>;
  uploadExemptionForm: (transactionId: string, file: File) => Promise<void>;
  markTaxReimbursed: (transactionId: string) => Promise<void>;
  // Mints an upload token for the given document type on an existing
  // transaction and returns it, so the caller can build the emailed
  // upload link (mirrors the token minted at creation time in addTransaction).
  requestTransactionDocument: (transactionId: string, docType: string) => Promise<string>;
  selectedBudgetLine: BudgetLine | null;
  setSelectedBudgetLine: (line: BudgetLine | null) => void;
  filteredTransactions: Transaction[];
  budgetLineSummaries: BudgetLineSummaryData[];
}
