import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask } from '../../../../../test/mocks';
import { MonthGroup } from '../../../utils/groupTasksByQuarter';
import { MonthSection } from './MonthSection';

const baseMonth: MonthGroup = {
  key: '2026-09',
  label: 'September',
  tasks: [],
};

const renderSection = (overrides: Partial<ComponentProps<typeof MonthSection>> = {}) =>
  render(
    <MonthSection
      month={baseMonth}
      requirementsByTaskId={new Map()}
      peopleNames={{}}
      canEdit
      isTaskPending={() => false}
      taskError={() => ''}
      isRequirementPending={() => false}
      onToggleComplete={vi.fn()}
      onToggleRequirement={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );

describe('MonthSection', () => {
  test('renders the month label', () => {
    renderSection();
    expect(screen.getByText('September')).toBeInTheDocument();
  });

  test('renders one task row per task, in order', () => {
    renderSection({
      month: {
        ...baseMonth,
        tasks: [
          buildMockFinancialTask({ id: 't1', title: 'Submit Contract' }),
          buildMockFinancialTask({ id: 't2', title: 'File SOFO Form' }),
        ],
      },
    });
    const rows = screen.getAllByRole('button', { expanded: false });
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Submit Contract'),
      expect.stringContaining('File SOFO Form'),
    ]);
  });

  test("clicking a task row's checkbox calls onToggleComplete with that task", () => {
    const onToggleComplete = vi.fn();
    renderSection({
      month: {
        ...baseMonth,
        tasks: [
          buildMockFinancialTask({ id: 't1', title: 'Submit Contract' }),
          buildMockFinancialTask({ id: 't2', title: 'File SOFO Form' }),
        ],
      },
      onToggleComplete,
    });
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(onToggleComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't2' }),
      true,
    );
  });
});
