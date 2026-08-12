import { User } from '@supabase/supabase-js';
import React from 'react';
import { vi } from 'vitest';

import { AuthContext } from '../features/authentication/stores/AuthContext';
import { LedgerContext } from '../features/ledger/stores/LedgerContext';
import {
  AuditEntry,
  LedgerContextValue,
  Organization,
  PendingChange,
  Transaction,
} from '../features/ledger/types';

export const buildMockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'treasurer@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...overrides,
  }) as User;

export interface MockAuthContextOptions {
  user?: User | null;
  loading?: boolean;
  sendLoginLink?: (email: string) => Promise<void>;
}

export const buildMockAuthContext = (overrides: MockAuthContextOptions = {}) => ({
  user: overrides.user === undefined ? buildMockUser() : overrides.user,
  loading: overrides.loading ?? false,
  sendLoginLink: overrides.sendLoginLink ?? vi.fn().mockResolvedValue(undefined),
});

export const MockAuthProvider = ({
  value,
  children,
}: {
  value?: MockAuthContextOptions;
  children: React.ReactNode;
}) => (
  <AuthContext.Provider value={buildMockAuthContext(value)}>
    {children}
  </AuthContext.Provider>
);

export const buildMockLedgerContext = (
  overrides: Partial<LedgerContextValue> = {},
): LedgerContextValue => ({
  auditLog: [],
  pendingChanges: [],
  organizations: [],
  loading: false,
  activeOrganizationId: null,
  setActiveOrganizationId: vi.fn(),
  activeOrganization: null,
  userRole: null,
  generateTransactionId: vi.fn(() => 'generated-id'),
  addTransaction: vi.fn().mockResolvedValue(undefined),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  updatePaymentStatus: vi.fn().mockResolvedValue(undefined),
  approvePendingChange: vi.fn().mockResolvedValue(undefined),
  rejectPendingChange: vi.fn().mockResolvedValue(undefined),
  cancelPendingChange: vi.fn().mockResolvedValue(undefined),
  updateBudgetAllocations: vi.fn().mockResolvedValue(undefined),
  initializeBudgetAllocations: vi.fn().mockResolvedValue(undefined),
  updateDebitCardSettings: vi.fn().mockResolvedValue(undefined),
  reconcileTransactions: vi.fn().mockResolvedValue(undefined),
  uploadExemptionForm: vi.fn().mockResolvedValue(undefined),
  selectedBudgetLine: null,
  setSelectedBudgetLine: vi.fn(),
  filteredTransactions: [],
  // Large default balances so outflow-submitting tests don't accidentally
  // trip the overdraft-warning flow; override explicitly to test that flow.
  budgetLineSummaries: [
    { line: 'ASG', balance: 100000, inflow: 0, outflow: 0 },
    { line: 'Operating', balance: 100000, inflow: 0, outflow: 0 },
    { line: 'Gifts', balance: 100000, inflow: 0, outflow: 0 },
    { line: 'Debit Card', balance: 100000, inflow: 0, outflow: 0 },
  ],
  ...overrides,
});

export const buildMockTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: 'txn-1',
  title: 'Pizza for meeting',
  date: '2026-01-15',
  amount: 42.5,
  direction: 'Outflow',
  type: 'Debit card purchase',
  funding: 'ASG',
  budgetLine: 'Debit Card',
  notes: '',
  receiptFileUrl: undefined,
  reconciledAt: null,
  ...overrides,
});

export const buildMockOrganization = (
  overrides: Partial<Organization> = {},
): Organization => ({
  id: 'org-1',
  name: 'Wildcat Club',
  admins: [],
  treasurer: [],
  president: [],
  officers: [],
  budgetAllocations: { ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 0 },
  isBudgetLinesSet: true,
  transactions: [],
  debitCardSettings: {},
  ...overrides,
});

export const buildMockPendingChange = (
  overrides: Partial<PendingChange> = {},
): PendingChange => ({
  id: 'pending-1',
  type: 'edit',
  transactionId: 'txn-1',
  transactionTitle: 'Pizza for meeting',
  requestedBy: 'treasurer@example.com',
  requestedByRole: 'treasurer',
  requestedAt: Date.now(),
  before: buildMockTransaction(),
  after: buildMockTransaction({ amount: 50 }),
  ...overrides,
});

export const buildMockAuditEntry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  id: 'audit-1',
  action: 'create',
  performedBy: 'treasurer@example.com',
  timestamp: Date.now(),
  transactionId: 'txn-1',
  transactionTitle: 'Pizza for meeting',
  before: null,
  after: buildMockTransaction(),
  ...overrides,
});

export const MockLedgerProvider = ({
  value,
  children,
}: {
  value?: Partial<LedgerContextValue>;
  children: React.ReactNode;
}) => (
  <LedgerContext.Provider value={buildMockLedgerContext(value)}>
    {children}
  </LedgerContext.Provider>
);
