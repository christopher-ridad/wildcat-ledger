import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask } from '../../../../../test/mocks';
import { TaskMarker } from './TaskMarker';

const renderMarker = (overrides: Partial<ComponentProps<typeof TaskMarker>> = {}) =>
  render(
    <TaskMarker
      task={buildMockFinancialTask({ title: 'Submit Contract' })}
      x={120}
      index={0}
      isActive={false}
      onToggleActive={vi.fn()}
      peopleNames={{}}
      canEdit
      pending={false}
      onToggleComplete={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );

describe('TaskMarker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('inactive: renders the dot and label, but no popover content', () => {
    renderMarker();
    expect(screen.getByRole('button', { name: 'Submit Contract' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('clicking the dot calls onToggleActive', () => {
    const onToggleActive = vi.fn();
    renderMarker({ onToggleActive });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Contract' }));
    expect(onToggleActive).toHaveBeenCalled();
  });

  test('active: portals the full TaskCard content to the document', () => {
    renderMarker({ isActive: true });
    expect(screen.getByRole('dialog', { name: 'Submit Contract' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  test('even index -> above direction on the popover; odd index -> below', () => {
    const { rerender } = render(
      <TaskMarker
        task={buildMockFinancialTask({ title: 'Even Task' })}
        x={0}
        index={0}
        isActive
        onToggleActive={vi.fn()}
        peopleNames={{}}
        canEdit
        pending={false}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog').className).toMatch(/above/);

    rerender(
      <TaskMarker
        task={buildMockFinancialTask({ title: 'Odd Task' })}
        x={0}
        index={1}
        isActive
        onToggleActive={vi.fn()}
        peopleNames={{}}
        canEdit
        pending={false}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog').className).toMatch(/below/);
  });

  test('dot urgency class matches getTaskUrgency for a fixed today', () => {
    renderMarker({ task: buildMockFinancialTask({ dueDate: '2026-09-11' }) });
    expect(screen.getByRole('button', { name: /./ }).className).toMatch(/dueSoon/);
  });

  test('canEdit/pending/error are passed through to the active popover', () => {
    renderMarker({ isActive: true, canEdit: false, pending: true, error: 'Failed.' });
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText('Failed.')).toBeInTheDocument();
  });

  test('data-task-popover-active is present on the marker only when active', () => {
    const { rerender } = renderMarker({ isActive: false });
    expect(
      screen.getByRole('button', { name: 'Submit Contract' }).parentElement,
    ).not.toHaveAttribute('data-task-popover-active');

    rerender(
      <TaskMarker
        task={buildMockFinancialTask({ title: 'Submit Contract' })}
        x={120}
        index={0}
        isActive
        onToggleActive={vi.fn()}
        peopleNames={{}}
        canEdit
        pending={false}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Submit Contract' }).parentElement,
    ).toHaveAttribute('data-task-popover-active', 'true');
  });
});
