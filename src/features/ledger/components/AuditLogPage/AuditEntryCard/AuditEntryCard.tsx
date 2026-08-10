import { AuditAction, AuditEntry } from '../../../types';
import { diffChangedKeys } from '../../../utils/diff';
import styles from './AuditEntryCard.module.css';

const formatTimestamp = (ts: number) =>
  new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

interface ActionDisplay {
  label: string;
  icon: string;
  className: string;
  entryClass: string;
}

// Record<AuditAction, ...> means TypeScript catches it if a new AuditAction
// variant is ever added without a corresponding label here.
const ACTION_LABELS: Record<AuditAction, ActionDisplay> = {
  create: {
    label: 'Created',
    icon: '+',
    className: 'wl-audit-badge--create',
    entryClass: 'wl-audit-entry--create',
  },
  edit: {
    label: 'Edited',
    icon: '~',
    className: 'wl-audit-badge--edit',
    entryClass: 'wl-audit-entry--edit',
  },
  delete: {
    label: 'Deleted',
    icon: '×',
    className: 'wl-audit-badge--delete',
    entryClass: 'wl-audit-entry--delete',
  },
  request_edit: {
    label: 'Edit Requested',
    icon: '?',
    className: 'wl-audit-badge--request',
    entryClass: 'wl-audit-entry--request',
  },
  request_delete: {
    label: 'Delete Requested',
    icon: '?',
    className: 'wl-audit-badge--request',
    entryClass: 'wl-audit-entry--request',
  },
  // 'approve' label depends on `after` (null means it was an approved delete),
  // so it's handled separately in actionLabel() below rather than here.
  approve: {
    label: 'Approved',
    icon: '✓',
    className: 'wl-audit-badge--approve',
    entryClass: 'wl-audit-entry--approve',
  },
  reject: {
    label: 'Rejected',
    icon: '✕',
    className: 'wl-audit-badge--reject',
    entryClass: 'wl-audit-entry--reject',
  },
  cancel: {
    label: 'Cancelled',
    icon: '↩',
    className: 'wl-audit-badge--cancel',
    entryClass: 'wl-audit-entry--cancel',
  },
  reconcile: {
    label: 'Reconciled',
    icon: '✓',
    className: 'wl-audit-badge--approve',
    entryClass: 'wl-audit-entry--approve',
  },
  reload_request: {
    label: 'Reload Requested',
    icon: '↻',
    className: 'wl-audit-badge--create',
    entryClass: 'wl-audit-entry--create',
  },
  payment_status_change: {
    label: 'Payment Status Updated',
    icon: '$',
    className: 'wl-audit-badge--edit',
    entryClass: 'wl-audit-entry--edit',
  },
};

const actionLabel = (action: AuditAction, after: AuditEntry['after']): ActionDisplay => {
  const display = ACTION_LABELS[action];
  if (action === 'approve') {
    return { ...display, label: after === null ? 'Approved Delete' : 'Approved Edit' };
  }
  return display;
};

const EditDiff = ({
  changedKeys,
  before,
  after,
}: {
  changedKeys: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) => (
  <div className={styles['wl-audit-diff']}>
    <div
      className={`${styles['wl-audit-snapshot']} ${styles['wl-audit-snapshot--before']}`}
    >
      <span className={styles['wl-audit-snapshot-label']}>Before</span>
      <div className={styles['wl-audit-snapshot-rows']}>
        {changedKeys.map((key) => (
          <div key={key} className={styles['wl-audit-snapshot-row']}>
            <span className={styles['wl-audit-diff-field']}>{key}</span>
            <span
              className={`${styles['wl-audit-snapshot-value']} ${styles['wl-audit-snapshot-value--before']}`}
            >
              {String(before[key] ?? '—')}
            </span>
          </div>
        ))}
      </div>
    </div>
    <div
      className={`${styles['wl-audit-snapshot']} ${styles['wl-audit-snapshot--after']}`}
    >
      <span className={styles['wl-audit-snapshot-label']}>After</span>
      <div className={styles['wl-audit-snapshot-rows']}>
        {changedKeys.map((key) => (
          <div key={key} className={styles['wl-audit-snapshot-row']}>
            <span className={styles['wl-audit-diff-field']}>{key}</span>
            <span
              className={`${styles['wl-audit-snapshot-value']} ${styles['wl-audit-snapshot-value--after']}`}
            >
              {String(after[key] ?? '—')}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const AuditEntryCard = ({ entry }: { entry: AuditEntry }) => {
  const { label, icon, className, entryClass } = actionLabel(entry.action, entry.after);
  const changedKeys =
    entry.action === 'edit' ||
    entry.action === 'request_edit' ||
    entry.action === 'approve' ||
    entry.action === 'payment_status_change'
      ? diffChangedKeys(entry.before, entry.after)
      : [];

  return (
    <div className={`${styles['wl-audit-entry']} ${styles[entryClass]}`}>
      <div className={styles['wl-audit-entry-header']}>
        <span className={`${styles['wl-audit-badge']} ${styles[className]}`}>
          <span className={styles['wl-audit-badge-icon']}>{icon}</span>
          {label}
        </span>
        <span className={styles['wl-audit-title']}>{entry.transactionTitle}</span>
        <div className={styles['wl-audit-meta']}>
          <span className={styles['wl-audit-meta-user']}>{entry.performedBy}</span>
          <span className={styles['wl-audit-meta-sep']}>·</span>
          <span className={styles['wl-audit-meta-time']}>
            {formatTimestamp(entry.timestamp)}
          </span>
        </div>
      </div>
      {changedKeys.length > 0 && (
        <EditDiff
          changedKeys={changedKeys}
          before={entry.before as Record<string, unknown>}
          after={entry.after as Record<string, unknown>}
        />
      )}
      {entry.action === 'reconcile' && entry.reconciliationSummary && (
        <div className={styles['wl-audit-recon-summary']}>
          <span>{entry.reconciliationSummary.transactionCount} transactions</span>
          <span className={styles['wl-audit-recon-sep']}>·</span>
          <span>${entry.reconciliationSummary.totalAmount.toFixed(2)} total</span>
          {entry.reconciliationSummary.exemptionCount > 0 && (
            <>
              <span className={styles['wl-audit-recon-sep']}>·</span>
              <span>
                {entry.reconciliationSummary.exemptionCount} exemption
                {entry.reconciliationSummary.exemptionCount !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      )}
      {entry.action === 'reload_request' && entry.reloadAmount != null && (
        <div className={styles['wl-audit-recon-summary']}>
          <span>Amount requested: ${entry.reloadAmount.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
};
