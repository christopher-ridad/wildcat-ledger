import { pluralize } from '../../../../../utils/pluralize';
import { AuditAction, AuditEntry } from '../../../types';
import { formatTimestamp } from '../../../utils/calculations';
import { diffChangedKeys } from '../../../utils/diff';
import { DiffView } from '../../DiffView';
import styles from './AuditEntryCard.module.css';

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
  payment_status_change: {
    label: 'Payment Status Updated',
    icon: '$',
    className: 'wl-audit-badge--edit',
    entryClass: 'wl-audit-entry--edit',
  },
  tax_reimbursed: {
    label: 'Tax Reimbursed to SOFO',
    icon: '✓',
    className: 'wl-audit-badge--approve',
    entryClass: 'wl-audit-entry--approve',
  },
  reload_request: {
    label: 'Reload Requested',
    icon: '?',
    className: 'wl-audit-badge--request',
    entryClass: 'wl-audit-entry--request',
  },
};

// audit_log.action is a plain text column with no CHECK constraint (and
// AuditEntry['action'] is only a type-level promise, not a runtime
// guarantee) -- a row written by since-removed/renamed code, or anything
// else ACTION_LABELS doesn't happen to cover yet, would otherwise crash the
// whole page rather than just rendering that one entry oddly.
const FALLBACK_ACTION_DISPLAY: ActionDisplay = {
  label: 'Updated',
  icon: '•',
  className: 'wl-audit-badge--edit',
  entryClass: 'wl-audit-entry--edit',
};

const actionLabel = (action: AuditAction, after: AuditEntry['after']): ActionDisplay => {
  const display = ACTION_LABELS[action] ?? FALLBACK_ACTION_DISPLAY;
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
  <DiffView
    changedKeys={changedKeys}
    before={before}
    after={after}
    classNames={{
      container: styles['wl-audit-diff'],
      before: {
        column: `${styles['wl-audit-snapshot']} ${styles['wl-audit-snapshot--before']}`,
        label: styles['wl-audit-snapshot-label'],
        rows: styles['wl-audit-snapshot-rows'],
        row: styles['wl-audit-snapshot-row'],
        field: styles['wl-audit-diff-field'],
        value: `${styles['wl-audit-snapshot-value']} ${styles['wl-audit-snapshot-value--before']}`,
      },
      after: {
        column: `${styles['wl-audit-snapshot']} ${styles['wl-audit-snapshot--after']}`,
        label: styles['wl-audit-snapshot-label'],
        rows: styles['wl-audit-snapshot-rows'],
        row: styles['wl-audit-snapshot-row'],
        field: styles['wl-audit-diff-field'],
        value: `${styles['wl-audit-snapshot-value']} ${styles['wl-audit-snapshot-value--after']}`,
      },
    }}
  />
);

export const AuditEntryCard = ({
  entry,
  peopleNames,
}: {
  entry: AuditEntry;
  peopleNames: Record<string, string>;
}) => {
  const { label, icon, className, entryClass } = actionLabel(entry.action, entry.after);
  const changedKeys =
    entry.action === 'edit' ||
    entry.action === 'request_edit' ||
    entry.action === 'approve' ||
    entry.action === 'payment_status_change' ||
    entry.action === 'tax_reimbursed'
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
          <span className={styles['wl-audit-meta-user']}>
            {peopleNames[entry.performedBy] ?? entry.performedBy}
          </span>
          <span className={styles['wl-audit-meta-sep']}>·</span>
          <span className={styles['wl-audit-meta-time']}>
            {formatTimestamp(entry.timestamp, { includeTime: true })}
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
                {entry.reconciliationSummary.exemptionCount}{' '}
                {pluralize(entry.reconciliationSummary.exemptionCount, 'exemption')}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
