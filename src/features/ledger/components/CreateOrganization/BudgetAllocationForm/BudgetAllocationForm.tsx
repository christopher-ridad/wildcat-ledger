import { useState } from 'react';

import { BudgetAllocations, BudgetLine } from '../../../types';
import { formatCurrency } from '../../../utils/calculations';
import styles from './BudgetAllocationForm.module.css';

// The lines printed on the budget allocation sheet, so the ones a scan fills in.
const SHEET_LINES = ['ASG', 'Operating', 'Gifts'] as const;

// Up to two decimal places, allowing a trailing "." mid-typing.
const AMOUNT_INPUT = /^\d*\.?\d{0,2}$/;

interface BudgetAllocationFormProps {
  allocations: BudgetAllocations;
  isScanned: boolean;
  onLineChange: (line: BudgetLine, amount: number) => void;
}

export const BudgetAllocationForm = ({
  allocations,
  isScanned,
  onLineChange,
}: BudgetAllocationFormProps) => {
  // What's typed, kept as text: showing the parsed number instead would
  // drop a trailing "." and make decimals impossible to type.
  const [drafts, setDrafts] = useState<Partial<Record<BudgetLine, string>>>({});

  const handleChange = (line: BudgetLine, raw: string) => {
    if (!AMOUNT_INPUT.test(raw)) return;
    setDrafts((prev) => ({ ...prev, [line]: raw }));
    onLineChange(line, parseFloat(raw) || 0);
  };

  const displayValue = (line: BudgetLine, locked: boolean) => {
    if (locked) return allocations[line].toFixed(2);
    return drafts[line] ?? (allocations[line] === 0 ? '' : String(allocations[line]));
  };

  const amountRow = (line: BudgetLine, label: string, locked: boolean) => (
    <div className={styles['wl-budget-allocation-row']}>
      <label className={styles['wl-budget-allocation-label']} htmlFor={`budget-${line}`}>
        {label}
      </label>
      <div className={styles['wl-budget-allocation-input-wrap']}>
        <span className={styles['wl-budget-allocation-prefix']}>$</span>
        <input
          id={`budget-${line}`}
          type="text"
          inputMode="decimal"
          className={`wl-form-input ${styles['wl-budget-allocation-input']}`}
          value={displayValue(line, locked)}
          placeholder="0.00"
          disabled={locked}
          onChange={(e) => handleChange(line, e.target.value)}
        />
      </div>
      <span className={styles['wl-budget-allocation-preview']}>
        {formatCurrency(allocations[line])}
      </span>
    </div>
  );

  return (
    <div className={styles['wl-budget-allocation-form']} style={{ marginTop: 20 }}>
      <p className={styles['wl-budget-scan-label']}>
        {isScanned
          ? '✅ Review and confirm extracted amounts:'
          : 'Enter amounts manually:'}
      </p>
      {SHEET_LINES.map((line) => (
        <div key={line}>{amountRow(line, line, isScanned)}</div>
      ))}

      <div className={styles['wl-budget-debit-section']}>
        {amountRow('Debit Card', 'Debit card balance right now', false)}
        <p className={styles['wl-budget-debit-hint']}>
          Not on the budget sheet. Check the card&apos;s current balance with the
          Cashier&apos;s Office. Leave it blank if your org doesn&apos;t have a card.
        </p>
      </div>
    </div>
  );
};
