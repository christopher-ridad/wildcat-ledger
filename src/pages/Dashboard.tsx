import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ReconciliationModal } from '../components/ReconciliationModal';
import { TransactionList } from '../components/TransactionList';
import { TransactionModal } from '../components/TransactionModal';
import { useLedger } from '../hooks/useLedger';
import { BudgetLine } from '../types';
import { formatCurrency } from '../utilities/calculations';

export const Dashboard = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const navigate = useNavigate();
  const {
    budgetLineSummaries,
    selectedBudgetLine,
    setSelectedBudgetLine,
    activeOrganization,
    userRole,
  } = useLedger();
  const canEdit = userRole === 'treasurer' || userRole === 'president';

  useEffect(() => {
    if (activeOrganization === null) {
      navigate('/organizations', { replace: true });
    }
  }, [activeOrganization, navigate]);

  return (
    <div className="wl-app">
      <div className="wl-header-optionB">
        <div className="wl-header-optionB-left">
          <h1 className="wl-header-title">{activeOrganization?.name}</h1>
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
    </div>
  );
};
