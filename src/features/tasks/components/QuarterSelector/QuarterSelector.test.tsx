import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { QuarterGroup } from '../../utils/groupTasksByQuarter';
import { QuarterSelector } from './QuarterSelector';

const quarters: QuarterGroup[] = [
  { key: '2026-0', label: 'Fall Quarter 2026', months: [] },
  { key: '2026-1', label: 'Winter Quarter 2027', months: [] },
  { key: '2026-2', label: 'Spring Quarter 2027', months: [] },
];

describe('QuarterSelector', () => {
  test('renders one tab per quarter with short season names', () => {
    render(
      <QuarterSelector quarters={quarters} selectedKey="2026-0" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole('tab', { name: 'Fall Quarter' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Winter Quarter' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Spring Quarter' })).toBeInTheDocument();
  });

  test('marks the selected tab via aria-selected', () => {
    render(
      <QuarterSelector quarters={quarters} selectedKey="2026-1" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole('tab', { name: 'Fall Quarter' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tab', { name: 'Winter Quarter' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Spring Quarter' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  test('clicking a tab calls onSelect with that quarter key', () => {
    const onSelect = vi.fn();
    render(
      <QuarterSelector quarters={quarters} selectedKey="2026-0" onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Spring Quarter' }));
    expect(onSelect).toHaveBeenCalledWith('2026-2');
  });
});
