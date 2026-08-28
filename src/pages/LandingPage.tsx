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

const PREVIEW_DOCUMENTS = [
  { label: 'Receipt', attached: true },
  { label: 'W-9', attached: true },
  { label: 'Contract', attached: true },
  { label: 'Special Pay Form', attached: false },
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
          Track everything your student org spends, and the paperwork that goes with it.
        </h1>
        <p className="wl-landing-subtext">
          A shared ledger for your org&rsquo;s transactions, receipts, and SOFO or
          Cashier&rsquo;s Office paperwork, so nothing gets lost along the way.
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
          Every receipt, W-9, and contract lives on the transaction it belongs to.
        </h2>
        <p className="wl-landing-proof-body">
          Attach documents once and find them again months later, instead of digging
          through email when SOFO or the Cashier&rsquo;s Office asks for proof.
        </p>
        <div className="wl-landing-doc-chips">
          {PREVIEW_DOCUMENTS.map((doc) => (
            <span
              key={doc.label}
              className={`wl-landing-doc-chip ${doc.attached ? 'wl-landing-doc-chip--done' : ''}`}
            >
              {doc.attached ? '✓ ' : ''}
              {doc.label}
            </span>
          ))}
        </div>
      </div>

      <div className="wl-landing-proof-side">
        <div className="wl-landing-proof-item">
          <h3>Organized by budget line</h3>
          <p>
            See exactly what&rsquo;s left in ASG, Operating, Gifts, and your debit card
            line, always up to date.
          </p>
        </div>
        <div className="wl-landing-proof-item">
          <h3>A second approver on changes</h3>
          <p>
            Edits to an amount or budget line get a quick second look from another
            approver before they stick.
          </p>
        </div>
        <div className="wl-landing-proof-item">
          <h3>Deadlines, not just dollars</h3>
          <p>
            Log the SOFO paperwork and contract renewals your org owes each quarter,
            assign who&rsquo;s responsible, and let the document checklist build itself.
          </p>
        </div>
      </div>
    </section>

    <div className="wl-landing-cta-band">
      <div className="wl-landing-cta-band-inner">
        <h2 className="wl-landing-cta-band-heading">
          Less guesswork for your treasurer, more visibility for your whole board.
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
