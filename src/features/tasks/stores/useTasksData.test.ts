import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { supabase } from '../../../config/supabase';
import { useTasksData } from './useTasksData';

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

const mockSuccessfulLoad = (
  overrides: Partial<Record<string, { data: unknown; error?: unknown }>> = {},
) => {
  const results: Record<string, { data: unknown; error?: unknown }> = {
    financial_tasks: { data: [] },
    financial_task_requirements: { data: [] },
    ...overrides,
  };
  mockFrom.mockImplementation(
    (table: string) => createQueryBuilder(results[table]) as never,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mockChannel.mockImplementation(() => createChannelBuilder() as never);
});

describe('useTasksData', () => {
  test('with no active organization, resolves to empty state without querying supabase', () => {
    const { result } = renderHook(() => useTasksData(null));

    expect(result.current.financialTasks).toEqual([]);
    expect(result.current.financialTaskRequirements).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
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
            assignee_emails: [],
            completed_at: null,
            created_by: 'treasurer@example.com',
            created_at: '2026-08-01T00:00:00.000Z',
            payment_type: null,
            is_individual_vendor: false,
          },
        ],
      },
    });
    const { result } = renderHook(() => useTasksData('org-1'));

    await waitFor(() =>
      expect(result.current.financialTasks).toEqual([
        expect.objectContaining({ id: 'task-1', title: 'Submit Contract' }),
      ]),
    );
  });

  test('loads financialTaskRequirements for the active organization', async () => {
    mockSuccessfulLoad({
      financial_task_requirements: {
        data: [
          {
            id: 'req-1',
            task_id: 'task-1',
            org_id: 'org-1',
            key: 'contract',
            label: 'RSO Agreement',
            completed_at: null,
            created_at: '2026-08-01T00:00:00.000Z',
          },
        ],
      },
    });
    const { result } = renderHook(() => useTasksData('org-1'));

    await waitFor(() =>
      expect(result.current.financialTaskRequirements).toEqual([
        expect.objectContaining({ id: 'req-1', label: 'RSO Agreement' }),
      ]),
    );
  });

  test('subscribes to Realtime changes on both tables for the active organization', async () => {
    mockSuccessfulLoad();
    renderHook(() => useTasksData('org-1'));

    await waitFor(() =>
      expect(mockChannel).toHaveBeenCalledWith('org-org-1-tasks-changes'),
    );
    const channelInstance = mockChannel.mock.results.at(-1)?.value;
    expect(channelInstance.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'financial_tasks', filter: 'org_id=eq.org-1' }),
      expect.any(Function),
    );
    expect(channelInstance.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        table: 'financial_task_requirements',
        filter: 'org_id=eq.org-1',
      }),
      expect.any(Function),
    );
  });

  test('removes the channel on unmount', async () => {
    mockSuccessfulLoad();
    const { unmount } = renderHook(() => useTasksData('org-1'));
    await waitFor(() => expect(mockChannel).toHaveBeenCalled());

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  test('resets to empty state when the active organization is cleared', () => {
    mockSuccessfulLoad();
    const { result, rerender } = renderHook(({ orgId }) => useTasksData(orgId), {
      initialProps: { orgId: 'org-1' as string | null },
    });

    rerender({ orgId: null });
    expect(result.current.financialTasks).toEqual([]);
    expect(result.current.financialTaskRequirements).toEqual([]);
  });

  // Regression test: a stale response from a previous org's fetch resolving
  // after the user has already switched orgs must not overwrite the newer
  // org's data -- financialTasks isn't keyed by org_id, so nothing else
  // guards against this.
  test('a slow org-1 response resolving after switching to org-2 does not clobber org-2 data', async () => {
    let resolveOrg1: (value: { data: unknown }) => void;
    const org1Pending = new Promise<{ data: unknown }>((resolve) => {
      resolveOrg1 = resolve;
    });

    let call = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'financial_tasks') {
        call += 1;
        if (call === 1) {
          // org-1's query never resolves until we trigger it below.
          const builder = {
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            order: vi.fn(() => builder),
            then: (resolve: (value: { data: unknown }) => void) =>
              org1Pending.then(resolve),
          };
          return builder as never;
        }
        return createQueryBuilder({
          data: [
            {
              id: 'task-org2',
              org_id: 'org-2',
              title: 'Org 2 task',
              description: null,
              due_date: '2026-09-20',
              assignee_emails: [],
              completed_at: null,
              created_by: 'treasurer@example.com',
              created_at: '2026-08-01T00:00:00.000Z',
              payment_type: null,
              is_individual_vendor: false,
            },
          ],
        }) as never;
      }
      return createQueryBuilder({ data: [] }) as never;
    });

    const { result, rerender } = renderHook(({ orgId }) => useTasksData(orgId), {
      initialProps: { orgId: 'org-1' as string | null },
    });

    rerender({ orgId: 'org-2' });
    await waitFor(() =>
      expect(result.current.financialTasks).toEqual([
        expect.objectContaining({ id: 'task-org2' }),
      ]),
    );

    // org-1's stale response finally resolves, after the switch. Flush it
    // fully (including the .map()/setState microtasks inside the hook)
    // before asserting, wrapped in act() since this update happens outside
    // any test-triggered event.
    await act(async () => {
      resolveOrg1!({
        data: [
          {
            id: 'task-org1',
            org_id: 'org-1',
            title: 'Org 1 task',
            description: null,
            due_date: '2026-09-10',
            assignee_emails: [],
            completed_at: null,
            created_by: 'treasurer@example.com',
            created_at: '2026-08-01T00:00:00.000Z',
            payment_type: null,
            is_individual_vendor: false,
          },
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.financialTasks).toEqual([
      expect.objectContaining({ id: 'task-org2' }),
    ]);
  });
});
