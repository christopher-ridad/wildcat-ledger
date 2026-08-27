import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockFinancialTask } from '../../../../../test/mocks';
import { QuarterGroup } from '../../../utils/groupTasksByQuarter';
import { QuarterChapter } from './QuarterChapter';

const baseQuarter: QuarterGroup = {
  key: '2026-0', // Fall
  label: 'Fall Quarter 2026',
  months: [
    {
      key: '2026-09',
      label: 'September',
      entries: [{ task: buildMockFinancialTask({ id: 't1', title: 'Submit Contract' }) }],
    },
  ],
};

const renderChapter = (overrides: Partial<ComponentProps<typeof QuarterChapter>> = {}) =>
  render(
    <QuarterChapter
      quarter={baseQuarter}
      peopleNames={{}}
      canEdit
      isTaskPending={() => false}
      taskError={() => ''}
      onToggleComplete={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );

describe('QuarterChapter', () => {
  test('renders the quarter label as the heading', () => {
    renderChapter();
    expect(
      screen.getByRole('heading', { name: 'Fall Quarter 2026' }),
    ).toBeInTheDocument();
  });

  test('renders one MonthSection per month, in order', () => {
    renderChapter({
      quarter: {
        ...baseQuarter,
        months: [
          { key: '2026-09', label: 'September', entries: [] },
          { key: '2026-10', label: 'October', entries: [] },
        ],
      },
    });
    expect(screen.getByText('September')).toBeInTheDocument();
    expect(screen.getByText('October')).toBeInTheDocument();
  });

  test('renders the section number and month range for Fall (order 0)', () => {
    renderChapter({ quarter: { ...baseQuarter, key: '2026-0' } });
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('September – December')).toBeInTheDocument();
  });

  test('renders the section number and month range for Winter (order 1)', () => {
    renderChapter({
      quarter: { ...baseQuarter, key: '2027-1', label: 'Winter Quarter 2027' },
    });
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('January – March')).toBeInTheDocument();
  });

  test('renders the section number and month range for Spring (order 2)', () => {
    renderChapter({
      quarter: { ...baseQuarter, key: '2027-2', label: 'Spring Quarter 2027' },
    });
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByText('April – June')).toBeInTheDocument();
  });

  test('section numbering resets per academic year rather than counting continuously', () => {
    // Fall of a much later academic year (order 0) still reads '01', not a
    // continuing global count -- QuarterChapter derives the number purely
    // from its own quarter.key, with no state shared across instances.
    renderChapter({
      quarter: { ...baseQuarter, key: '2028-0', label: 'Fall Quarter 2028' },
    });
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  test('an empty (zero-month) chapter still renders its opener', () => {
    renderChapter({ quarter: { ...baseQuarter, months: [] } });
    expect(
      screen.getByRole('heading', { name: 'Fall Quarter 2026' }),
    ).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
  });
});
