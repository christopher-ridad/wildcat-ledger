import { useNavigate } from 'react-router-dom';

import { TimelineBoard } from '../features/ledger/components/TimelinePage/TimelineBoard';
import { useLedger } from '../features/ledger/hooks/useLedger';
import { currentAcademicYearLabel } from '../features/ledger/utils/groupTasksByQuarter';
import { todayDateString } from '../features/ledger/utils/today';
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
        <div className="wl-timeline-header">
          {activeOrganization && (
            <p className="wl-timeline-header-org">{activeOrganization.name}</p>
          )}
          <h1 className="wl-timeline-header-title">Financial Timeline</h1>
          <p className="wl-timeline-header-year">
            {currentAcademicYearLabel(todayDateString())}
          </p>
        </div>
        <TimelineBoard />
      </div>
    </div>
  );
};
