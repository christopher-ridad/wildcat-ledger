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

  test('calls onLineChange with the line and parsed amount', () => {
    const onLineChange = vi.fn();
    render(
      <BudgetAllocationForm
        allocations={allocations}
        isScanned={false}
        onLineChange={onLineChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Gifts'), { target: { value: '75.25' } });
    expect(onLineChange).toHaveBeenCalledWith('Gifts', 75.25);
  });

  test('keeps a trailing decimal point while typing', () => {
    render(
      <BudgetAllocationForm
        allocations={allocations}
        isScanned={false}
        onLineChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Gifts'), { target: { value: '12.' } });
    expect(screen.getByLabelText('Gifts')).toHaveValue('12.');
  });

  test('ignores input with more than two decimal places or letters', () => {
    const onLineChange = vi.fn();
    render(
      <BudgetAllocationForm
        allocations={allocations}
        isScanned={false}
        onLineChange={onLineChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Gifts'), { target: { value: '1.234' } });
    fireEvent.change(screen.getByLabelText('Gifts'), { target: { value: 'abc' } });
    expect(onLineChange).not.toHaveBeenCalled();
  });

  test('the debit card balance can be entered even after a scan', () => {
    const onLineChange = vi.fn();
    render(
      <BudgetAllocationForm
        allocations={allocations}
        isScanned
        onLineChange={onLineChange}
      />,
    );
    const debitInput = screen.getByLabelText('Debit card balance right now');
    expect(debitInput).toBeEnabled();
    expect(screen.getByText(/Not on the budget sheet/)).toBeInTheDocument();

    fireEvent.change(debitInput, { target: { value: '640.50' } });
    expect(onLineChange).toHaveBeenCalledWith('Debit Card', 640.5);
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
