import styles from './AddTransactionForm.module.css';

interface DocumentCheckFlag {
  key: string;
  message: string;
}

interface DocumentCheckStatusProps {
  status: 'idle' | 'checking' | 'done' | 'error';
  expanded: boolean;
  errorMessage: string;
  flags: DocumentCheckFlag[];
  acknowledged: boolean;
  onAcknowledge: (checked: boolean) => void;
}

// The hint/error/looks-complete/flag-list block shared by W9CompletenessCheck
// and RSOAgreementCompletenessCheck -- identical between the two once you're
// past the canvas rendering, which differs (one page vs two). Wrapped in a
// live region so a screen reader user actually hears the check's outcome
// instead of just the visual spinner disappearing.
export const DocumentCheckStatus = ({
  status,
  expanded,
  errorMessage,
  flags,
  acknowledged,
  onAcknowledge,
}: DocumentCheckStatusProps) => (
  <div role="status" aria-live="polite">
    {status !== 'checking' && (
      <p className={styles['wl-form-hint']}>
        {expanded
          ? 'Click the preview to shrink it back down.'
          : 'Click the preview to see it full size.'}
      </p>
    )}
    {status === 'error' && <p className={styles['wl-form-hint']}>{errorMessage}</p>}
    {status === 'done' && flags.length === 0 && (
      <p className={styles['wl-form-hint']}>✓ Looks complete.</p>
    )}
    {status === 'done' && flags.length > 0 && (
      <div className={styles['wl-form-no-receipt']}>
        {flags.map((flag) => (
          <p key={flag.key} className={styles['wl-form-no-receipt-notice']}>
            ⚠ {flag.message}
          </p>
        ))}
        <label
          className={`${styles['wl-form-checkbox']} ${styles['wl-doc-check-acknowledge']}`}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledge(e.target.checked)}
          />
          <span>I&apos;ve reviewed this and it&apos;s correct as-is</span>
        </label>
      </div>
    )}
  </div>
);
