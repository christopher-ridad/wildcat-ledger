import styles from './AddTransactionForm.module.css';

interface OverdraftWarningProps {
  message: string;
  submitting: boolean;
  onProceed: () => void;
  onCancel: () => void;
}

export const OverdraftWarning = ({
  message,
  submitting,
  onProceed,
  onCancel,
}: OverdraftWarningProps) => (
  <div className={styles['wl-overdraft-warning']} role="alert">
    <p>{message}</p>
    <div className="wl-overdraft-actions">
      <button
        type="button"
        className="wl-btn-warning"
        disabled={submitting}
        onClick={onProceed}
      >
        {submitting ? 'Saving…' : 'Proceed anyway'}
      </button>
      <button
        type="button"
        className="wl-btn-cancel"
        disabled={submitting}
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  </div>
);
