import { useNavigate } from 'react-router-dom';

import { useLedger } from '../features/ledger/hooks/useLedger';
import { Organization } from '../features/ledger/types';
import { TopNav } from '../layouts/TopNav';

export const OrganizationsPage = () => {
  const { organizations, setActiveOrganizationId } = useLedger();
  const navigate = useNavigate();

  const handleSelectOrg = (org: Organization) => {
    setActiveOrganizationId(org.id);
    if (org.isBudgetLinesSet) {
      navigate('/dashboard');
    } else {
      navigate('/budget-setup');
    }
  };

  return (
    <div className="wl-register-root wl-topnav-offset">
      <TopNav />
      <div className="wl-org-select-wrapper">
        <div className="wl-onboarding-header">
          <p className="wl-onboarding-tagline">
            Track and manage your club&apos;s finances
          </p>
          <p className="wl-register-subtitle">Select an organization to get started</p>
        </div>
        <div className="wl-org-grid">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              className="wl-org-card"
              onClick={() => handleSelectOrg(org)}
            >
              <span className="wl-org-card-name">{org.name}</span>
            </button>
          ))}
          {organizations.length === 0 && (
            <p className="wl-register-subtitle">
              No organizations found for your account.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
