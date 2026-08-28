import { QuarterGroup } from '../../utils/groupTasksByQuarter';
import styles from './QuarterSelector.module.css';

interface QuarterSelectorProps {
  quarters: QuarterGroup[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

// quarter.key's order segment (Fall=0, Winter=1, Spring=2) -- "Fall
// Quarter"/etc, not the full "Fall Quarter 2026" label, since the academic
// year is already shown once in the page header above this (matches the
// user's own example tab text exactly).
const SHORT_LABEL = ['Fall Quarter', 'Winter Quarter', 'Spring Quarter'];

export const QuarterSelector = ({
  quarters,
  selectedKey,
  onSelect,
}: QuarterSelectorProps) => (
  <div className={styles['wl-quarter-selector']} role="tablist" aria-label="Quarter">
    {quarters.map((quarter) => {
      const order = Number(quarter.key.split('-')[1]);
      const isSelected = quarter.key === selectedKey;
      return (
        <button
          key={quarter.key}
          type="button"
          role="tab"
          aria-selected={isSelected}
          className={[
            styles['wl-quarter-selector-tab'],
            isSelected ? styles['wl-quarter-selector-tab--selected'] : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onSelect(quarter.key)}
        >
          {SHORT_LABEL[order]}
        </button>
      );
    })}
  </div>
);
