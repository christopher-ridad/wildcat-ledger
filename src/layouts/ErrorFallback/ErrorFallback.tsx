import styles from './ErrorFallback.module.css';

interface ErrorFallbackProps {
  eventId: string;
  resetError: () => void;
}

// Rendered by Sentry's ErrorBoundary (see main.tsx) in place of a crashed
// subtree, so one bad render -- a malformed record from the database, a
// third-party script, anything -- shows a recoverable screen instead of a
// silent blank page. "Try Again" re-renders the same tree without a full
// reload, which is enough when the crash was a one-off; "Reload Page" is
// the fallback for when the underlying state itself is bad.
export const ErrorFallback = ({ eventId, resetError }: ErrorFallbackProps) => (
  <div className={styles['wl-error-fallback']}>
    <div className={styles['wl-error-fallback-card']}>
      <h1 className={styles['wl-error-fallback-title']}>Something went wrong</h1>
      <p className={styles['wl-error-fallback-body']}>
        WildcatLedger ran into an unexpected error. Your data is safe -- this is just a
        display problem.
      </p>
      <div className={styles['wl-error-fallback-actions']}>
        <button type="button" className="wl-btn-primary" onClick={resetError}>
          Try Again
        </button>
        <button
          type="button"
          className="wl-btn-cancel"
          onClick={() => window.location.reload()}
        >
          Reload Page
        </button>
      </div>
      {eventId && (
        <p className={styles['wl-error-fallback-reference']}>
          Error reference: {eventId}
        </p>
      )}
    </div>
  </div>
);
