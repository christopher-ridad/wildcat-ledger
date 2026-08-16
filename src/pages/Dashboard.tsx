import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DebitCardSettingsModal } from '../features/ledger/components/Dashboard/DebitCardSettingsModal';
import { ReconciliationModal } from '../features/ledger/components/Dashboard/ReconciliationModal';
import { TransactionList } from '../features/ledger/components/Dashboard/TransactionList';
import { TransactionModal } from '../features/ledger/components/Dashboard/TransactionModal';
import { useLedger } from '../features/ledger/hooks/useLedger';
import { BudgetLine } from '../features/ledger/types';
import { formatCurrency } from '../features/ledger/utils/calculations';

export const Dashboard = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [debitCardSettingsOpen, setDebitCardSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const {
    budgetLineSummaries,
    selectedBudgetLine,
    setSelectedBudgetLine,
    activeOrganization,
    userRole,
    peopleNames,
    loading,
  } = useLedger();
  const canEdit = userRole === 'sofoApprover';
  const displayName = (email: string) => peopleNames[email] ?? email;
  const approversSubtitle = activeOrganization
    ? [
        `SOFO Approvers: ${activeOrganization.sofoApprovers.map(displayName).join(', ') || '—'}`,
        activeOrganization.officers.length > 0
          ? `Officers: ${activeOrganization.officers.map(displayName).join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  useEffect(() => {
    if (!loading && activeOrganization === null) {
      navigate('/organizations', { replace: true });
    }
  }, [loading, activeOrganization, navigate]);

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
        </div>
      </div>

      <div className="wl-dashboard-optionB">
        {/* Sidebar */}
        <aside className="wl-sidebar-optionB">
          <div className="wl-sidebar-header-optionB">
            <button
              type="button"
              className="wl-btn-back"
              onClick={() => navigate('/organizations')}
            >
              ← Back
            </button>
          </div>
          <div className="wl-sidebar-section-optionB">
            <h3 className="wl-sidebar-title-optionB">Filter</h3>
            <button
              type="button"
              className={`wl-sidebar-filter-btn ${!selectedBudgetLine ? 'wl-sidebar-filter-btn--active' : ''}`}
              onClick={() => setSelectedBudgetLine(null)}
            >
              All Transactions
            </button>
            {budgetLineSummaries.map((summary) => (
              <button
                key={summary.line}
                type="button"
                className={`wl-sidebar-filter-btn ${selectedBudgetLine === summary.line ? 'wl-sidebar-filter-btn--active' : ''}`}
                onClick={() => setSelectedBudgetLine(summary.line as BudgetLine)}
              >
                <span>{summary.line}</span>
                <span className="wl-sidebar-amount">
                  {formatCurrency(summary.balance)}
                </span>
              </button>
            ))}
          </div>

          <div className="wl-sidebar-footer-optionB">
            {canEdit && (
              <button
                type="button"
                className="wl-sidebar-reconcile-btn"
                onClick={() => setReconcileOpen(true)}
              >
                Reconcile Debit Card
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                className="wl-sidebar-add-btn"
                onClick={() => setModalOpen(true)}
              >
                + Add Transaction
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                className="wl-sidebar-settings-link"
                onClick={() => setDebitCardSettingsOpen(true)}
              >
                ⚙ SOFO / CO Settings
              </button>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="wl-main-optionB">
          {/* Budget Cards Overview */}
          <section className="wl-optionB-section">
            <h2 className="wl-section-title">Budget Lines Overview</h2>
            <div className="wl-budget-grid-optionB">
              {budgetLineSummaries.map((summary) => {
                const balancePositive = summary.balance >= 0;
                return (
                  <div key={summary.line} className="wl-budget-card-optionB">
                    <div className="wl-budget-card-optionB-header">
                      <span className="wl-budget-card-optionB-line">{summary.line}</span>
                      <span
                        className={`wl-budget-card-optionB-balance ${balancePositive ? 'wl-amount-positive' : 'wl-amount-negative'}`}
                      >
                        {formatCurrency(summary.balance)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Transactions Section */}
          <section className="wl-optionB-section">
            <h2 className="wl-section-title">Transactions</h2>
            <TransactionList />
          </section>
        </main>
      </div>

      <TransactionModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      <ReconciliationModal
        isOpen={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
      />
      <DebitCardSettingsModal
        isOpen={debitCardSettingsOpen}
        onClose={() => setDebitCardSettingsOpen(false)}
      />
    </div>
  );
};
