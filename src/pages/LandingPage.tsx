import { Link } from 'react-router-dom';

import logo from '../assets/favicon/wildcats-logo.png';

// Realistic, labeled-fictional preview data -- not live data, just enough
// to make the dashboard preview panel read as a real screenshot rather
// than an empty template. Mirrors the actual budget lines every org has.
const PREVIEW_BUDGET_LINES = [
  { line: 'ASG', balance: '$3,420.00' },
  { line: 'Operating', balance: '$1,180.50' },
  { line: 'Gifts', balance: '$640.00' },
  { line: 'Debit Card', balance: '$2,050.00' },
];

const PREVIEW_TRANSACTIONS = [
  { title: 'Norris room reservation', amount: '-$85.00', tag: 'approved' as const },
  {
    title: 'E-board t-shirt reimbursement',
    amount: '-$212.40',
    tag: 'reconciled' as const,
  },
  { title: 'Spring formal deposit', amount: '-$500.00', tag: 'approved' as const },
];

const WORKFLOW_STEPS = [
  {
    verb: 'Log it',
    detail: 'Enter the purchase, pick the type, and attach the receipt or contract.',
  },
  {
    verb: 'Get it approved',
    detail: 'A second SOFO approver reviews the change before it touches the balance.',
  },
  {
    verb: 'Reconcile it',
    detail: 'Match debit card purchases to statements without leaving the ledger.',
  },
];

export const LandingPage = () => (
  <div className="wl-landing">
    <nav className="wl-landing-nav">
      <span className="wl-landing-logo">
        <img src={logo} alt="" />
        WildcatLedger
      </span>
      <Link to="/login" className="wl-btn-primary wl-landing-nav-signin">
        Sign in with Northwestern
      </Link>
    </nav>

    <section className="wl-landing-hero">
      <div>
        <h1 className="wl-landing-headline">
          Built for the way <span>SOFO</span> actually reviews your books.
        </h1>
        <p className="wl-landing-subtext">
          Track every transaction by budget line, route edits through a second approver,
          and keep SOFO&rsquo;s paperwork in one place.
        </p>
        <div className="wl-landing-hero-actions">
          <Link to="/login" className="wl-btn-primary wl-landing-cta">
            Sign in with Northwestern
          </Link>
          <span className="wl-landing-hero-note">Northwestern student orgs only</span>
        </div>
      </div>

      <div className="wl-landing-preview-frame">
        <p className="wl-landing-preview-titlebar">Budget Lines Overview</p>
        <div className="wl-landing-preview-grid">
          {PREVIEW_BUDGET_LINES.map((item) => (
            <div key={item.line} className="wl-budget-card-optionB">
              <div className="wl-budget-card-optionB-header">
                <span className="wl-budget-card-optionB-line">{item.line}</span>
              </div>
              <span className="wl-budget-card-optionB-balance wl-amount-positive">
                {item.balance}
              </span>
            </div>
          ))}
        </div>
        <div className="wl-landing-preview-txns">
          {PREVIEW_TRANSACTIONS.map((txn) => (
            <div key={txn.title} className="wl-landing-preview-txn">
              <span className="wl-landing-preview-txn-title">{txn.title}</span>
              <span className="wl-landing-preview-txn-meta">
                <span className="wl-landing-preview-amount wl-amount-negative">
                  {txn.amount}
                </span>
                <span
                  className={`wl-landing-preview-tag wl-landing-preview-tag--${txn.tag}`}
                >
                  {txn.tag === 'approved' ? 'Approved' : 'Reconciled'}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="wl-landing-proof">
      <div className="wl-landing-proof-main">
        <h2 className="wl-landing-proof-heading">
          Every edit gets a second set of eyes.
        </h2>
        <p className="wl-landing-proof-body">
          Change an amount, a type, or a budget line and it needs approval from another
          SOFO approver before it&rsquo;s final. Nothing changes in the ledger until
          someone else signs off, and nobody can approve their own request.
        </p>
        <div className="wl-landing-proof-flow">
          <span className="wl-landing-proof-pill wl-landing-proof-pill--pending">
            Edit Requested
          </span>
          <span className="wl-landing-proof-arrow" aria-hidden="true">
            →
          </span>
          <span className="wl-landing-proof-pill wl-landing-proof-pill--approved">
            Approved
          </span>
        </div>
      </div>

      <div className="wl-landing-proof-side">
        <div className="wl-landing-proof-item">
          <h3>Every document, on the transaction</h3>
          <p>
            Receipts, W-9s, contracts, and Special Pay Forms live on the transaction they
            belong to, not scattered across email.
          </p>
        </div>
        <div className="wl-landing-proof-item">
          <h3>A history, not just a balance</h3>
          <p>
            Every create, edit, approval, and reconciliation is logged with who did it and
            when.
          </p>
        </div>
      </div>
    </section>

    <section className="wl-landing-workflow">
      <h2 className="wl-landing-workflow-heading">
        From purchase to reconciled, in the same place.
      </h2>
      <div className="wl-landing-workflow-steps">
        {WORKFLOW_STEPS.map((step) => (
          <div key={step.verb} className="wl-landing-workflow-step">
            <h3 className="wl-landing-workflow-verb">{step.verb}</h3>
            <p className="wl-landing-workflow-detail">{step.detail}</p>
          </div>
        ))}
      </div>
    </section>

    <div className="wl-landing-cta-band">
      <div className="wl-landing-cta-band-inner">
        <h2 className="wl-landing-cta-band-heading">
          Get your org&rsquo;s books somewhere your successor can actually find them.
        </h2>
        <Link to="/login" className="wl-btn-primary wl-landing-cta">
          Sign in with Northwestern
        </Link>
      </div>
    </div>

    <footer className="wl-landing-footer">
      <span>WildcatLedger, for Northwestern student organizations.</span>
      <Link to="/privacy">Privacy Policy</Link>
    </footer>
  </div>
);
