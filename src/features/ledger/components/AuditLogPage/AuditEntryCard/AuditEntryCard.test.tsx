import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { buildMockAuditEntry, buildMockTransaction } from '../../../../../test/mocks';
import { AuditAction } from '../../../types';
import { AuditEntryCard } from './AuditEntryCard';

describe('AuditEntryCard', () => {
  test.each<[AuditAction, string]>([
    ['create', 'Created'],
    ['delete', 'Deleted'],
    ['request_edit', 'Edit Requested'],
    ['request_delete', 'Delete Requested'],
    ['reject', 'Rejected'],
    ['cancel', 'Cancelled'],
    ['reconcile', 'Reconciled'],
    ['payment_status_change', 'Payment Status Updated'],
  ])('renders the %s badge as "%s"', (action, label) => {
    render(<AuditEntryCard entry={buildMockAuditEntry({ action })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  test('labels an approve action with a non-null after as "Approved Edit"', () => {
    render(
      <AuditEntryCard
        entry={buildMockAuditEntry({ action: 'approve', after: buildMockTransaction() })}
      />,
    );
    expect(screen.getByText('Approved Edit')).toBeInTheDocument();
  });

  test('labels an approve action with a null after as "Approved Delete"', () => {
    render(
      <AuditEntryCard entry={buildMockAuditEntry({ action: 'approve', after: null })} />,
    );
    expect(screen.getByText('Approved Delete')).toBeInTheDocument();
  });

  test('shows the transaction title and performer', () => {
    render(
      <AuditEntryCard
        entry={buildMockAuditEntry({
          transactionTitle: 'Office Supplies',
          performedBy: 'president@example.com',
        })}
      />,
    );
    expect(screen.getByText('Office Supplies')).toBeInTheDocument();
    expect(screen.getByText('president@example.com')).toBeInTheDocument();
  });

  test('renders a before/after diff for edits with changed fields', () => {
    const before = buildMockTransaction({ amount: 10, title: 'Original' });
    const after = buildMockTransaction({ amount: 20, title: 'Original' });
    render(
      <AuditEntryCard entry={buildMockAuditEntry({ action: 'edit', before, after })} />,
    );
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  test('renders a before/after diff for a payment status change', () => {
    const before = buildMockTransaction({ paymentStatus: 'Pending' });
    const after = buildMockTransaction({ paymentStatus: 'Approved' });
    render(
      <AuditEntryCard
        entry={buildMockAuditEntry({ action: 'payment_status_change', before, after })}
      />,
    );
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  test('does not render a diff for edits with no changed fields', () => {
    const same = buildMockTransaction();
    render(
      <AuditEntryCard
        entry={buildMockAuditEntry({ action: 'edit', before: same, after: same })}
      />,
    );
    expect(screen.queryByText('Before')).not.toBeInTheDocument();
  });

  test('does not render a diff for a create action even if before/after differ', () => {
    render(
      <AuditEntryCard
        entry={buildMockAuditEntry({
          action: 'create',
          before: buildMockTransaction({ amount: 1 }),
          after: buildMockTransaction({ amount: 2 }),
        })}
      />,
    );
    expect(screen.queryByText('Before')).not.toBeInTheDocument();
  });

  test('shows a reconciliation summary with pluralized exemption count', () => {
    render(
      <AuditEntryCard
        entry={buildMockAuditEntry({
          action: 'reconcile',
          reconciliationSummary: {
            transactionCount: 3,
            totalAmount: 45.5,
            exemptionCount: 2,
            transactionIds: ['a', 'b', 'c'],
          },
        })}
      />,
    );
    expect(screen.getByText('3 transactions')).toBeInTheDocument();
    expect(screen.getByText('$45.50 total')).toBeInTheDocument();
    expect(screen.getByText('2 exemptions')).toBeInTheDocument();
  });

  test('uses singular "exemption" when the count is 1', () => {
    render(
      <AuditEntryCard
        entry={buildMockAuditEntry({
          action: 'reconcile',
          reconciliationSummary: {
            transactionCount: 1,
            totalAmount: 10,
            exemptionCount: 1,
            transactionIds: ['a'],
          },
        })}
      />,
    );
    expect(screen.getByText('1 exemption')).toBeInTheDocument();
  });

  test('omits the exemption clause when the count is 0', () => {
    render(
      <AuditEntryCard
        entry={buildMockAuditEntry({
          action: 'reconcile',
          reconciliationSummary: {
            transactionCount: 1,
            totalAmount: 10,
            exemptionCount: 0,
            transactionIds: ['a'],
          },
        })}
      />,
    );
    expect(screen.queryByText(/exemption/)).not.toBeInTheDocument();
  });
});
