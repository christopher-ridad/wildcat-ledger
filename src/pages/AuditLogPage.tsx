import { useNavigate } from 'react-router-dom';

import { AuditEntryCard } from '../features/ledger/components/AuditLogPage/AuditEntryCard';
import { useLedger } from '../features/ledger/hooks/useLedger';
import { TopNav } from '../layouts/TopNav';

export const AuditLogPage = () => {
  const { auditLog, activeOrganization } = useLedger();
  const navigate = useNavigate();

  return (
    <div className="wl-app">
      <TopNav />
      <div className="wl-main" style={{ marginTop: 64, paddingTop: 24 }}>
        <button
          type="button"
          className="wl-btn-back"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard
        </button>
        <div className="wl-audit-heading-row">
          <h2 className="wl-audit-heading">Audit Log</h2>
          {activeOrganization && (
            <span className="wl-audit-org-badge">{activeOrganization.name}</span>
          )}
          {auditLog.length > 0 && (
            <span className="wl-audit-count">
              {auditLog.length} {auditLog.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>
        {auditLog.length === 0 ? (
          <div className="wl-audit-empty">
            <div className="wl-audit-empty-icon">☑</div>
            <p className="wl-audit-empty-title">No activity yet</p>
            <p className="wl-audit-empty-sub">
              Changes to transactions will appear here.
            </p>
          </div>
        ) : (
          <div className="wl-audit-list">
            {auditLog.map((entry) => (
              <AuditEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
