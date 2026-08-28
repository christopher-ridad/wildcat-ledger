import { useNavigate } from 'react-router-dom';

import { useAuth } from '../features/authentication/hooks/useAuth';
import { useLedger } from '../features/ledger/hooks/useLedger';
import { TimelineBoard } from '../features/tasks/components/TimelineBoard';
import { currentAcademicYearLabel } from '../features/tasks/utils/groupTasksByQuarter';
import { todayDateString } from '../features/tasks/utils/today';

export const TimelinePage = () => {
  const { activeOrganization, peopleNames } = useLedger();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const displayName = (email: string) => peopleNames[email] ?? email;
  const approversSubtitle = activeOrganization
    ? `SOFO Approvers: ${activeOrganization.sofoApprovers.map(displayName).join(', ') || '—'}`
    : '';

  return (
    <div className="wl-app">
      <div className="wl-header-optionB">
        <div className="wl-header-optionB-left">
          <h1 className="wl-header-title">{activeOrganization?.name}</h1>
          {activeOrganization && (
            <p className="wl-header-approvers" title={approversSubtitle}>
              {approversSubtitle}
            </p>
          )}
        </div>
        <div className="wl-header-optionB-right">
          <button
            type="button"
            className="wl-header-audit-btn"
            onClick={() => navigate('/audit-log')}
          >
            Audit History
          </button>
          <button
            type="button"
            className="wl-header-audit-btn"
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </button>
          <button type="button" className="wl-header-signout-btn" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="wl-main wl-main--wide" style={{ marginTop: 76, paddingTop: 24 }}>
        <div className="wl-tasks-page">
          <div className="wl-timeline-header">
            <h2 className="wl-timeline-header-title">Financial Tasks</h2>
            <span className="wl-timeline-header-year">
              {currentAcademicYearLabel(todayDateString())}
            </span>
          </div>
          <TimelineBoard />
        </div>
      </div>
    </div>
  );
};
