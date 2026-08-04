import {
  BudgetAllocations,
  BudgetLine,
  BudgetLineSummaryData,
  Transaction,
} from '../types';

export const BUDGET_LINES: BudgetLine[] = ['ASG', 'Operating', 'Gifts', 'Debit Card'];

export const calculateBudgetLineSummaries = (
  transactions: Transaction[],
  allocations: BudgetAllocations,
): BudgetLineSummaryData[] =>
  BUDGET_LINES.map((line) => {
    const lineTransactions = transactions.filter((t) => t.budgetLine === line);
    const inflow = lineTransactions
      .filter((t) => t.direction === 'Inflow')
      .reduce((sum, t) => sum + t.amount, 0);
    const outflow = lineTransactions
      .filter((t) => t.direction === 'Outflow')
      .reduce((sum, t) => sum + t.amount, 0);
    return { line, balance: allocations[line], inflow, outflow };
  });

const byDateDescending = (a: Transaction, b: Transaction): number =>
  (b.date ?? '').localeCompare(a.date ?? '');

export const applyFilters = (
  transactions: Transaction[],
  selectedBudgetLine: BudgetLine | null,
): Transaction[] => {
  const filtered =
    selectedBudgetLine === null
      ? transactions
      : transactions.filter((t) => t.budgetLine === selectedBudgetLine);
  return [...filtered].sort(byDateDescending);
};

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
