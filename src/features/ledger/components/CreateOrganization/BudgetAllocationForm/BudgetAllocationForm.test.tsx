import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { BudgetAllocations } from '../../../types';
import { BudgetAllocationForm } from './BudgetAllocationForm';

const allocations: BudgetAllocations = {
  ASG: 100,
  Operating: 0,
  Gifts: 250.5,
  'Debit Card': 0,
};

describe('BudgetAllocationForm', () => {
  test('shows the scanned-review label and disables inputs when isScanned', () => {
    render(
      <BudgetAllocationForm allocations={allocations} isScanned onLineChange={vi.fn()} />,
    );
    expect(screen.getByText(/Review and confirm extracted amounts/)).toBeInTheDocument();
    expect(screen.getByLabelText('ASG')).toBeDisabled();
    expect(screen.getByLabelText('ASG')).toHaveValue('100.00');
  });

  test('shows the manual-entry label and enables inputs when not scanned', () => {
    render(
      <BudgetAllocationForm
        allocations={allocations}
        isScanned={false}
        onLineChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Enter amounts manually:')).toBeInTheDocument();
    expect(screen.getByLabelText('ASG')).not.toBeDisabled();
    expect(screen.getByLabelText('ASG')).toHaveValue('100');
  });

  test('renders an empty value for a zero allocation instead of "0"', () => {
    render(
      <BudgetAllocationForm
        allocations={allocations}
        isScanned={false}
        onLineChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Operating')).toHaveValue('');
  });

  test('calls onLineChange with the line and raw typed value', () => {
    const onLineChange = vi.fn();
    render(
      <BudgetAllocationForm
        allocations={allocations}
        isScanned={false}
        onLineChange={onLineChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Gifts'), { target: { value: '75.25' } });
    expect(onLineChange).toHaveBeenCalledWith('Gifts', '75.25');
  });

  test('always renders the Debit Card row as fixed and disabled at $0.00', () => {
    render(
      <BudgetAllocationForm
        allocations={allocations}
        isScanned={false}
        onLineChange={vi.fn()}
      />,
    );
    const debitInput = screen.getByLabelText('Debit Card');
    expect(debitInput).toBeDisabled();
    expect(debitInput).toHaveValue('0.00');
    expect(screen.getByText('Always $0.00')).toBeInTheDocument();
  });

  test('shows a formatted currency preview for each line', () => {
    render(
      <BudgetAllocationForm
        allocations={allocations}
        isScanned={false}
        onLineChange={vi.fn()}
      />,
    );
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('$250.50')).toBeInTheDocument();
  });
});
