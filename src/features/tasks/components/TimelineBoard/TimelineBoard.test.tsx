import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask, buildMockOrganization } from '../../../../test/mocks';
import { useLedger } from '../../../ledger/hooks/useLedger';
import { useTasks } from '../../hooks/useTasks';
import { TimelineBoard } from './TimelineBoard';

vi.mock('../../../ledger/hooks/useLedger');
vi.mock('../../hooks/useTasks');
vi.mock('../TaskFormModal', () => ({
  TaskFormModal: ({
    isOpen,
    task,
    onSave,
    onClose,
  }: {
    isOpen: boolean;
    task?: { title: string };
    onSave: (task: { title: string; dueDate: string }) => void;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="task-form-modal">
        {task ? `Editing ${task.title}` : 'Adding new'}
        <button onClick={() => onSave({ title: 'Saved Task', dueDate: '2026-09-01' })}>
          Save from mock
        </button>
        <button onClick={onClose}>Close from mock</button>
      </div>
    ) : null,
}));
vi.mock('../QuarterBoard', () => ({
  QuarterBoard: ({
    tasks,
    onEdit,
    headerActions,
  }: {
    tasks: { id: string; title: string }[];
    onEdit: (task: { id: string; title: string }) => void;
    headerActions?: ReactNode;
  }) => (
    <div data-testid="quarter-board">
      {headerActions}
      {tasks.map((task) => (
        <button key={task.id} onClick={() => onEdit(task)}>
          Edit {task.title}
        </button>
      ))}
    </div>
  ),
}));

const mockUseLedger = vi.mocked(useLedger);
const mockUseTasks = vi.mocked(useTasks);

const baseLedger = {
  activeOrganization: buildMockOrganization({
    officers: ['officer@u.northwestern.edu'],
    sofoApprovers: ['approver@u.northwestern.edu'],
  }),
  peopleNames: {},
  canEdit: true,
};

const baseTasks = {
  financialTasks: [] as ReturnType<typeof buildMockFinancialTask>[],
  financialTaskRequirements: [],
  addFinancialTask: vi.fn().mockResolvedValue(undefined),
  updateFinancialTask: vi.fn().mockResolvedValue(undefined),
  deleteFinancialTask: vi.fn().mockResolvedValue(undefined),
  toggleFinancialTaskComplete: vi.fn().mockResolvedValue(undefined),
  toggleFinancialTaskRequirement: vi.fn().mockResolvedValue(undefined),
};

describe('TimelineBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLedger.mockReturnValue(baseLedger as never);
    mockUseTasks.mockReturnValue(baseTasks as never);
  });

  test('shows "+ Add Task" only when canEdit', () => {
    const { rerender } = render(<TimelineBoard />);
    expect(screen.getByText('+ Add Task')).toBeInTheDocument();

    mockUseLedger.mockReturnValue({ ...baseLedger, canEdit: false } as never);
    rerender(<TimelineBoard />);
    expect(screen.queryByText('+ Add Task')).not.toBeInTheDocument();
  });

  test('clicking "+ Add Task" opens the form in add mode', () => {
    render(<TimelineBoard />);
    expect(screen.queryByTestId('task-form-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('+ Add Task'));
    expect(screen.getByTestId('task-form-modal')).toHaveTextContent('Adding new');
  });

  test('triggering edit from the track opens the form in edit mode with that task', () => {
    mockUseTasks.mockReturnValue({
      ...baseTasks,
      financialTasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-05',
        }),
      ],
    } as never);
    render(<TimelineBoard />);

    fireEvent.click(screen.getByText('Edit Submit Contract'));
    expect(screen.getByTestId('task-form-modal')).toHaveTextContent(
      'Editing Submit Contract',
    );
  });

  test('saving from the form calls addFinancialTask when adding', async () => {
    const addFinancialTask = vi.fn().mockResolvedValue(undefined);
    mockUseTasks.mockReturnValue({ ...baseTasks, addFinancialTask } as never);
    render(<TimelineBoard />);

    fireEvent.click(screen.getByText('+ Add Task'));
    fireEvent.click(screen.getByText('Save from mock'));

    await waitFor(() =>
      expect(addFinancialTask).toHaveBeenCalledWith({
        title: 'Saved Task',
        dueDate: '2026-09-01',
      }),
    );
  });

  test('saving from the form calls updateFinancialTask when editing', async () => {
    const updateFinancialTask = vi.fn().mockResolvedValue(undefined);
    mockUseTasks.mockReturnValue({
      ...baseTasks,
      updateFinancialTask,
      financialTasks: [
        buildMockFinancialTask({
          id: 't1',
          title: 'Submit Contract',
          dueDate: '2026-09-05',
        }),
      ],
    } as never);
    render(<TimelineBoard />);

    fireEvent.click(screen.getByText('Edit Submit Contract'));
    fireEvent.click(screen.getByText('Save from mock'));

    await waitFor(() =>
      expect(updateFinancialTask).toHaveBeenCalledWith('t1', {
        title: 'Saved Task',
        dueDate: '2026-09-01',
      }),
    );
  });
});
