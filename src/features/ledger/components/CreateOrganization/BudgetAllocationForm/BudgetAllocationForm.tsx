import { BudgetAllocations } from '../../../types';
import { formatCurrency } from '../../../utils/calculations';
import styles from './BudgetAllocationForm.module.css';

const EDITABLE_LINES = ['ASG', 'Operating', 'Gifts'] as const;

interface BudgetAllocationFormProps {
  allocations: BudgetAllocations;
  isScanned: boolean;
  onLineChange: (line: (typeof EDITABLE_LINES)[number], raw: string) => void;
}

export const BudgetAllocationForm = ({
  allocations,
  isScanned,
  onLineChange,
}: BudgetAllocationFormProps) => (
  <div className={styles['wl-budget-allocation-form']} style={{ marginTop: 20 }}>
    <p className={styles['wl-budget-scan-label']}>
      {isScanned ? '✅ Review and confirm extracted amounts:' : 'Enter amounts manually:'}
    </p>
    {EDITABLE_LINES.map((line) => (
      <div key={line} className={styles['wl-budget-allocation-row']}>
        <label
          className={styles['wl-budget-allocation-label']}
          htmlFor={`budget-${line}`}
        >
          {line}
        </label>
        <div className={styles['wl-budget-allocation-input-wrap']}>
          <span className={styles['wl-budget-allocation-prefix']}>$</span>
          <input
            id={`budget-${line}`}
            type="text"
            inputMode="decimal"
            className={`wl-form-input ${styles['wl-budget-allocation-input']}`}
            value={
              allocations[line] === 0
                ? ''
                : isScanned
                  ? allocations[line].toFixed(2)
                  : String(allocations[line])
            }
            placeholder="0.00"
            disabled={isScanned}
            onChange={(e) => onLineChange(line, e.target.value)}
          />
        </div>
        <span className={styles['wl-budget-allocation-preview']}>
          {formatCurrency(allocations[line])}
        </span>
      </div>
    ))}

    {/* Debit Card always $0 */}
    <div
      className={`${styles['wl-budget-allocation-row']} ${styles['wl-budget-allocation-fixed']}`}
    >
      <label className={styles['wl-budget-allocation-label']} htmlFor="budget-debit">
        Debit Card
      </label>
      <div className={styles['wl-budget-allocation-input-wrap']}>
        <span className={styles['wl-budget-allocation-prefix']}>$</span>
        <input
          id="budget-debit"
          type="text"
          className={`wl-form-input ${styles['wl-budget-allocation-input']}`}
          value="0.00"
          disabled
        />
      </div>
      <span
        className={`${styles['wl-budget-allocation-preview']} ${styles['wl-budget-allocation-fixed-label']}`}
      >
        Always $0.00
      </span>
    </div>
  </div>
);
