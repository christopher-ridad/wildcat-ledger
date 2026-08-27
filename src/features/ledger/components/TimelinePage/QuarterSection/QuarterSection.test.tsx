import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask } from '../../../../../test/mocks';
import { QuarterGroup } from '../../../utils/groupTasksByQuarter';
import { QuarterSection } from './QuarterSection';

const baseQuarter: QuarterGroup = {
  key: '2026-Q3',
  label: 'Q3 2026',
  months: [
    {
      key: '2026-09',
      label: 'September',
      entries: [
        {
          task: buildMockFinancialTask({
            id: 't1',
            title: 'Submit Contract',
            dueDate: '2026-09-05',
          }),
        },
      ],
    },
    {
      key: '2026-08',
      label: 'August',
      entries: [
        {
          task: buildMockFinancialTask({
            id: 't2',
            title: 'File SOFO Form',
            dueDate: '2026-08-15',
          }),
        },
      ],
    },
  ],
};

const renderSection = (overrides: Partial<ComponentProps<typeof QuarterSection>> = {}) =>
  render(
    <QuarterSection
      quarter={baseQuarter}
      taskSides={
        new Map([
          ['t1', 'left'],
          ['t2', 'right'],
        ])
      }
      peopleNames={{}}
      canEdit
      activeTaskId={null}
      onToggleActive={vi.fn()}
      isTaskPending={() => false}
      taskError={() => ''}
      onToggleComplete={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );

describe('QuarterSection', () => {
  test('renders the quarter label', () => {
    renderSection();
    expect(screen.getByRole('heading', { name: 'Q3 2026' })).toBeInTheDocument();
  });

  test('renders one MonthLandmark per month, in the order given', () => {
    renderSection();
    expect(screen.getByText('September')).toBeInTheDocument();
    expect(screen.getByText('August')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Contract' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'File SOFO Form' })).toBeInTheDocument();
  });
});
