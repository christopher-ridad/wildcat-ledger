import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { supabase } from '../../../config/supabase';
import { useOrganizationsData } from './useOrganizationsData';

vi.mock('../../../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

const mockFrom = vi.mocked(supabase.from);
const mockChannel = vi.mocked(supabase.channel);
const mockRemoveChannel = vi.mocked(supabase.removeChannel);

// Mimics supabase-js's PostgrestFilterBuilder: select/eq/order all return
// the same chainable, thenable object, so `await query.eq(...)` and
// `await query.eq(...).order(...)` both resolve to `result` regardless of
// how many methods were chained first.
function createQueryBuilder(result: { data: unknown; error?: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    then: (
      resolve: (value: { data: unknown; error?: unknown }) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function createChannelBuilder() {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };
  return channel;
}

// Wires up `from` for one full successful load: an org with one
// transaction, plus one directory entry. Individual tests override specific
// table results via `overrides`.
const mockSuccessfulLoad = (
  overrides: Partial<Record<string, { data: unknown; error?: unknown }>> = {},
) => {
  const results: Record<string, { data: unknown; error?: unknown }> = {
    people: { data: [{ email: 'treasurer@example.com', name: 'Jane Treasurer' }] },
    organizations: {
      data: [
        {
          id: 'org-1',
          name: 'Wildcat Club',
          sofo_approvers: ['treasurer@example.com'],
          officers: [],
          budget_allocations: { ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 0 },
          is_budget_lines_set: true,
          last_reconciliation_date: null,
          debit_card_project_id: null,
          debit_card_account_number: null,
          debit_card_last_four: null,
          debit_card_icn: null,
          debit_card_load_balance: null,
        },
      ],
      error: null,
    },
    transactions: { data: [] },
    audit_log: { data: [] },
    pending_changes: { data: [] },
    financial_tasks: { data: [] },
    ...overrides,
  };
  mockFrom.mockImplementation(
    (table: string) => createQueryBuilder(results[table]) as never,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockChannel.mockImplementation(() => createChannelBuilder() as never);
});

describe('useOrganizationsData', () => {
  test('with no userEmail, resolves to empty state without querying supabase', () => {
    const { result } = renderHook(() => useOrganizationsData(null));

    expect(result.current.organizations).toEqual([]);
    expect(result.current.peopleNames).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('loads organizations (with their transactions) and the people directory', async () => {
    mockSuccessfulLoad();
    const { result } = renderHook(() => useOrganizationsData('treasurer@example.com'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.organizations).toEqual([
      expect.objectContaining({ id: 'org-1', name: 'Wildcat Club', transactions: [] }),
    ]);
    expect(result.current.peopleNames).toEqual({
      'treasurer@example.com': 'Jane Treasurer',
    });
  });

  test('subscribes to Realtime changes on organizations', async () => {
    mockSuccessfulLoad();
    renderHook(() => useOrganizationsData('treasurer@example.com'));

    await waitFor(() =>
      expect(mockChannel).toHaveBeenCalledWith('organizations-changes'),
    );
  });

  test('logs and stops loading when the organizations query errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSuccessfulLoad({
      organizations: { data: null, error: { message: 'network error' } },
    });
    const { result } = renderHook(() => useOrganizationsData('treasurer@example.com'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.organizations).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load organizations:',
      expect.objectContaining({ message: 'network error' }),
    );
  });

  test('removes the organizations channel on unmount', async () => {
    mockSuccessfulLoad();
    const { unmount } = renderHook(() => useOrganizationsData('treasurer@example.com'));
    await waitFor(() => expect(mockChannel).toHaveBeenCalled());

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  test('setActiveOrganizationId persists to localStorage and loads that org’s data', async () => {
    mockSuccessfulLoad({
      transactions: {
        data: [
          {
            id: 'txn-1',
            org_id: 'org-1',
            title: 'Pizza',
            date: null,
            amount: 12.5,
            direction: 'Outflow',
            type: 'Debit Card',
            funding: null,
            budget_line: 'Debit Card',
            notes: '',
            zelle_info: null,
            reimbursed_member_name: null,
            payment_status: null,
            is_individual_vendor: null,
            is_northwestern_employee: null,
            receipt_file_url: null,
            contract_file_url: null,
            w9_file_url: null,
            contracted_services_file_url: null,
            conflict_of_interest_file_url: null,
            special_pay_form_url: null,
            exemption_form_url: null,
            reconciled_at: null,
            no_receipt_acknowledged: null,
            tax_exempt_form_submitted: null,
            tax_amount: null,
            tax_reimbursed: null,
            contract_acknowledged_missing: null,
            w9_acknowledged_missing: null,
            contracted_services_acknowledged_missing: null,
            conflict_of_interest_acknowledged_missing: null,
            special_pay_form_acknowledged_missing: null,
            upload_tokens: {},
          },
        ],
      },
    });
    const { result } = renderHook(() => useOrganizationsData('treasurer@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    result.current.setActiveOrganizationId('org-1');

    await waitFor(() => expect(result.current.activeOrganizationId).toBe('org-1'));
    expect(localStorage.getItem('activeOrganizationId')).toBe('org-1');
    await waitFor(() => expect(mockChannel).toHaveBeenCalledWith('org-org-1-changes'));
    await waitFor(() =>
      expect(result.current.organizations[0].transactions).toEqual([
        expect.objectContaining({ id: 'txn-1', title: 'Pizza' }),
      ]),
    );
  });

  test('loads financialTasks for the active organization', async () => {
    mockSuccessfulLoad({
      financial_tasks: {
        data: [
          {
            id: 'task-1',
            org_id: 'org-1',
            title: 'Submit Contract',
            description: null,
            due_date: '2026-09-15',
            assignee_email: null,
            completed_at: null,
            created_by: 'treasurer@example.com',
            created_at: '2026-08-01T00:00:00.000Z',
          },
        ],
      },
    });
    const { result } = renderHook(() => useOrganizationsData('treasurer@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    result.current.setActiveOrganizationId('org-1');

    await waitFor(() =>
      expect(result.current.financialTasks).toEqual([
        expect.objectContaining({ id: 'task-1', title: 'Submit Contract' }),
      ]),
    );
  });

  test('subscribes to Realtime changes on financial_tasks for the active organization', async () => {
    mockSuccessfulLoad();
    const { result } = renderHook(() => useOrganizationsData('treasurer@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    result.current.setActiveOrganizationId('org-1');

    await waitFor(() => expect(mockChannel).toHaveBeenCalledWith('org-org-1-changes'));
    const channelInstance = mockChannel.mock.results.at(-1)?.value;
    expect(channelInstance.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'financial_tasks', filter: 'org_id=eq.org-1' }),
      expect.any(Function),
    );
  });

  test('restores activeOrganizationId from localStorage on mount', () => {
    localStorage.setItem('activeOrganizationId', 'org-from-storage');
    mockSuccessfulLoad();
    const { result } = renderHook(() => useOrganizationsData('treasurer@example.com'));

    expect(result.current.activeOrganizationId).toBe('org-from-storage');
  });
});
