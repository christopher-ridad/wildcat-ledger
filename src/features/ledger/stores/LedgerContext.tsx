import React, { createContext, useMemo } from 'react';

import { useAuth } from '../../authentication/hooks/useAuth';
import { LedgerContextValue, Organization, UserRole } from '../types';
import { applyFilters, calculateBudgetLineSummaries } from '../utils/calculations';
import { EMPTY_ALLOCATIONS } from '../utils/constants';
import { useLedgerMutations } from './useLedgerMutations';
import { useOrganizationsData } from './useOrganizationsData';

export const LedgerContext = createContext<LedgerContextValue | undefined>(undefined);

export const LedgerProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const userEmail = user?.email ?? null;

  const {
    organizations,
    peopleNames,
    loading,
    auditLog,
    pendingChanges,
    activeOrganizationId,
    setActiveOrganizationId,
    selectedBudgetLine,
    setSelectedBudgetLine,
  } = useOrganizationsData(userEmail);

  const activeOrganization =
    organizations.find((o: Organization) => o.id === activeOrganizationId) ?? null;

  const userRole = ((): UserRole | null => {
    if (!userEmail || !activeOrganization) return null;
    if (activeOrganization.sofoApprovers?.includes(userEmail)) return 'sofoApprover';
    if (activeOrganization.officers?.includes(userEmail)) return 'officer';
    return null;
  })();
  const canEdit = userRole === 'sofoApprover';

  const transactions = activeOrganization?.transactions ?? [];
  const budgetAllocations = activeOrganization?.budgetAllocations ?? EMPTY_ALLOCATIONS;

  const filteredTransactions = useMemo(
    () => applyFilters(transactions, selectedBudgetLine),
    [transactions, selectedBudgetLine],
  );

  const budgetLineSummaries = useMemo(
    () => calculateBudgetLineSummaries(transactions, budgetAllocations),
    [transactions, budgetAllocations],
  );

  // Shared by the multiple places (transaction list, reconciliation modal)
  // that otherwise each re-scanned pendingChanges to find the one for a
  // given transaction.
  const pendingChangesByTransactionId = useMemo(
    () => new Map(pendingChanges.map((p) => [p.transactionId, p])),
    [pendingChanges],
  );
  const pendingChangeForTransaction = (transactionId: string) =>
    pendingChangesByTransactionId.get(transactionId);

  const mutations = useLedgerMutations(activeOrganizationId, userRole);

  const value: LedgerContextValue = {
    auditLog,
    pendingChanges,
    pendingChangeForTransaction,
    organizations,
    loading,
    activeOrganizationId,
    setActiveOrganizationId,
    activeOrganization,
    userRole,
    canEdit,
    peopleNames,
    ...mutations,
    selectedBudgetLine,
    setSelectedBudgetLine,
    filteredTransactions,
    budgetLineSummaries,
  };

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
};
