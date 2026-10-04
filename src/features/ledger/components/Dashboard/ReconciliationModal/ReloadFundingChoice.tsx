import { BudgetAllocations, Funding } from '../../../types';
import { formatCurrency } from '../../../utils/calculations';
import { FUNDING_LINES } from '../../../utils/constants';
import styles from './ReconciliationModal.module.css';

interface ReloadFundingChoiceProps {
  amount: number;
  balances: BudgetAllocations;
  value: Funding | null;
  onChange: (line: Funding) => void;
  disabled: boolean;
}

// Which budget line pays for a reload. A line without enough to cover it
// can't be picked -- see docs/BUSINESS_RULES.md#reloads.
export const ReloadFundingChoice = ({
  amount,
  balances,
  value,
  onChange,
  disabled,
}: ReloadFundingChoiceProps) => (
  <fieldset className={styles['wl-recon-reload-choice']} disabled={disabled}>
    <legend className="wl-form-label">Pay for this reload from</legend>
    {FUNDING_LINES.map((line) => {
      const canCover = balances[line] >= amount;
      return (
        <label key={line} className={styles['wl-recon-reload-option']}>
          <input
            type="radio"
            name="reload-funding"
            checked={value === line}
            disabled={!canCover}
            onChange={() => onChange(line)}
          />
          <span>
            {line}{' '}
            <span className={styles['wl-recon-funding-balance']}>
              ({formatCurrency(balances[line])} available
              {canCover ? '' : ', not enough'})
            </span>
          </span>
        </label>
      );
    })}
  </fieldset>
);
