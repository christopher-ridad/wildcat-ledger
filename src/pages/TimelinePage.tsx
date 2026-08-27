import { useNavigate } from 'react-router-dom';

import { TimelineBoard } from '../features/ledger/components/TimelinePage/TimelineBoard';
import { useLedger } from '../features/ledger/hooks/useLedger';
import { TopNav } from '../layouts/TopNav';

export const TimelinePage = () => {
  const { activeOrganization } = useLedger();
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
          <h2 className="wl-audit-heading">Timeline</h2>
          {activeOrganization && (
            <span className="wl-audit-org-badge">{activeOrganization.name}</span>
          )}
        </div>
        <TimelineBoard />
      </div>
    </div>
  );
};
