import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  POLICY_EXEMPTION_FORM_URL,
  SOFO_SALES_TAX_REIMBURSEMENT_URL,
} from '../features/ledger/utils/constants';

interface FaqItem {
  question: string;
  answer: ReactNode;
}

interface FaqSection {
  slug: string;
  heading: string;
  items: FaqItem[];
}

// Written from docs/BUSINESS_RULES.md and documentRequirements.ts -- if a
// rule changes there, it should change here too.
const SECTIONS: FaqSection[] = [
  {
    slug: 'getting-started',
    heading: 'Getting started',
    items: [
      {
        question: 'Who can use WildcatLedger?',
        answer:
          'Any Northwestern student organization. Sign in with your @u.northwestern.edu Google account. There’s no separate password to keep track of.',
      },
      {
        question: 'What’s the difference between a SOFO Approver and an Officer?',
        answer:
          'SOFO Approvers are your org’s treasurer and president, since they’re the ones who actually process paperwork with SOFO. They can add, edit, or delete transactions, approve pending changes, reconcile the debit card, and change SOFO settings. Officers can see everything but can’t make any of those changes themselves.',
      },
      {
        question: 'Is there a general “member” access level, separate from Officer?',
        answer:
          'No. Only the people listed as an Officer or a SOFO Approver for your org can sign in and see its data at all, there’s no broader membership tier underneath that. Any Officer, approver or not, can view every transaction and budget line, and can attach a completed Policy Exemption Form to a Debit Card purchase themselves without needing a SOFO Approver to do it. That’s the one thing an Officer can change directly. Everything else needs a SOFO Approver.',
      },
    ],
  },
  {
    slug: 'transaction-types',
    heading: 'Transaction types',
    items: [
      {
        question: 'How do I actually submit a transaction?',
        answer: (
          <>
            <p>
              Depending on the transaction, that&rsquo;s SOFO or the Cashier&rsquo;s
              Office. You have a few options:
            </p>
            <ul>
              <li>
                The{' '}
                <a
                  href="https://forms.office.com/Pages/ResponsePage.aspx?id=YdN2fXeCCEekd2ToNmzRvPTAeBa6n3hLtPXRTAWTmwxUQUZHMU45WUpIV1BEV0xNWFZSRjdOUllMVyQlQCN0PWcu"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  SOFO Microsoft Form
                </a>{' '}
                online (you&rsquo;ll need to be signed in with your Northwestern email to
                access it)
              </li>
              <li>In person at the SOFO or Cashier&rsquo;s Office</li>
              <li>
                By email, at{' '}
                <a href="mailto:SOFOTransactions@northwestern.edu">
                  SOFOTransactions@northwestern.edu
                </a>{' '}
                for SOFO, or{' '}
                <a href="mailto:Norris-Cashier@northwestern.edu">
                  Norris-Cashier@northwestern.edu
                </a>{' '}
                for the Cashier&rsquo;s Office
              </li>
            </ul>
            <p>
              This doesn&rsquo;t apply to Debit Card purchases. There&rsquo;s nothing to
              submit ahead of time there, you just make the purchase and log it here
              afterward.
            </p>
          </>
        ),
      },
      {
        question: 'Which budget line does a transaction draw from?',
        answer: (
          <>
            <p>
              Every transaction type asks you to pick which line is funding it: ASG,
              Operating, or Gifts. A debit-card reload counts here too, since it still has
              to be funded from one of those lines.
            </p>
            <ul>
              <li>
                <strong>Operating:</strong> your org&rsquo;s baseline revenue, money it
                earns or collects directly (dues, ticket sales, fundraising, merch).
                Unrestricted, belongs entirely to your org, and rolls over year to year.
              </li>
              <li>
                <strong>ASG:</strong> student activity fee money allocated by Associated
                Student Government (your base ASG Spring Funding, supplemental grants,
                Senate appeals). Tightly restricted and audited, and doesn&rsquo;t roll
                over. Whatever&rsquo;s left at the end of the fiscal year gets swept back
                to ASG.
              </li>
              <li>
                <strong>Gifts:</strong> donated money, whether through university
                crowdfunding, alumni donations, or corporate sponsorships. Rolls over, but
                can only be spent however the original donor specified.
              </li>
            </ul>
            <p>
              Because ASG funds don&rsquo;t roll over and are meant to be spent down, they
              can&rsquo;t back a Deposit, including a debit-card reload. A Deposit can
              only come from Operating or Gifts.
            </p>
          </>
        ),
      },
      {
        question: 'Payment Request',
        answer: (
          <>
            <p>
              Attach the RSO Agreement (the contract between your org and the vendor) and
              a W-9. If you&rsquo;re paying an individual person rather than a company,
              you&rsquo;ll also need a Contracted Services Form and a Conflict of Interest
              Form.
            </p>
            <p>
              Filling out the RSO Agreement happens in stages. Your org fills out Section
              1 and Section 4 first (event details, compensation, and a handful of yes/no
              confirmations). Then the vendor, listed as &ldquo;Supplier,&rdquo; signs
              Section 3. Once that&rsquo;s signed, it goes to an Authorized Northwestern
              Staff Representative to sign.
            </p>
            <p>
              <strong>In WildcatLedger:</strong> uploading the RSO Agreement runs an
              automatic check that looks for all of that before flagging the document as
              complete.
            </p>
            <p>Blank templates:</p>
            <ul>
              <li>
                <a
                  href="/forms/rso-agreement.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  RSO Agreement
                </a>
              </li>
              <li>
                <a href="/forms/w9.pdf" target="_blank" rel="noopener noreferrer">
                  W-9
                </a>
              </li>
              <li>
                <a
                  href="/forms/contracted-services.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contracted Services Form
                </a>
              </li>
              <li>
                <a
                  href="/forms/conflict-of-interest.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Conflict of Interest Form
                </a>
              </li>
            </ul>
            <p>
              You&rsquo;ll also need to pick a payment method, whichever&rsquo;s more
              convenient for your org. They include:
            </p>
            <ul>
              <li>
                Check sent via mail to the vendor, at the address on their paperwork
              </li>
              <li>Student org rep picks up the check from Norris</li>
              <li>Foreign payment, for any vendor with a non-U.S. address</li>
            </ul>
          </>
        ),
      },
      {
        question: 'Non-Officer Reimbursement',
        answer: (
          <>
            <p>
              Attach a receipt. If you don&rsquo;t have one, a bank statement showing the
              charge works too. Just upload it in the receipt slot when you attach it.
            </p>
            <p>
              You&rsquo;ll also need to pick a payment method, whichever&rsquo;s more
              convenient for your org. They include:
            </p>
            <ul>
              <li>Student org rep picks up the check from Norris</li>
              <li>
                Check sent via mail (you&rsquo;ll need to email SOFO to request this)
              </li>
              <li>
                NUQuickPay via Zelle: attach the email you sent to{' '}
                <a href="mailto:SOFOTransactions@northwestern.edu">
                  SOFOTransactions@northwestern.edu
                </a>{' '}
                requesting the Zelle payment, and include the email address linked to your
                Zelle account
              </li>
            </ul>
          </>
        ),
      },
      {
        question: 'Debit Card',
        answer: (
          <>
            <p>
              Attach a receipt. If the receipt is missing, a{' '}
              <a
                href={POLICY_EXEMPTION_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Policy Exemption Form
              </a>{' '}
              takes its place instead.
            </p>
            <p>
              Once your org is ready to reconcile, you&rsquo;ll need to fill out the{' '}
              <a
                href="https://www.northwestern.edu/norris/documents/debitcardreconciliationver-dec2015.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Debit Card Reconciliation Form
              </a>{' '}
              and submit every receipt for the purchases you&rsquo;re reconciling up to
              that point.
            </p>
            <p>
              <strong>In WildcatLedger:</strong> it tracks every receipt as you go and
              flags anything missing, so you know exactly what&rsquo;s ready by the time
              you reconcile (eventually, it&rsquo;ll help fill out the form itself too). A
              purchase can only be reconciled here once it&rsquo;s &ldquo;covered&rdquo;
              (a receipt or Policy Exemption Form attached), doesn&rsquo;t owe SOFO a tax
              reimbursement, and doesn&rsquo;t have a pending edit or delete request still
              awaiting approval. Reconciling doesn&rsquo;t lock it in place, a correction
              afterward goes through the same second-approver rule as any other
              transaction edit.
            </p>
            <p>
              You can reload the card with more money at the same time. Each org has a set
              debit card limit, decided when your org first applied for the card. It can
              change, but only by talking to the Cashier&rsquo;s Office. A reload can be
              any amount up to that limit.
            </p>
            <p>
              <strong>In WildcatLedger:</strong> a reload is recorded as a Deposit on the
              Debit Card budget line, shown as &ldquo;Reloaded&rdquo; once it reaches
              Paid. It skips the Approved step since approving a reload is reloading it.
            </p>
            <p>
              If there&rsquo;s sales tax on a receipt, your org should be tax-exempt at
              checkout whenever the exemption form is shown, so this shouldn&rsquo;t
              normally happen. If it does, the full amount (tax included) still counts
              against your budget right away.
            </p>
            <p>
              <strong>In WildcatLedger:</strong> that transaction gets flagged as owing
              SOFO a reimbursement, and clearing that flag is self-attested. The actual
              repayment happens on{' '}
              <a
                href={SOFO_SALES_TAX_REIMBURSEMENT_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                SOFO&rsquo;s own site
              </a>
              , which this app doesn&rsquo;t connect to directly.
            </p>
          </>
        ),
      },
      {
        question: 'Payment to NU Employee',
        answer: (
          <>
            <p>
              Attach the RSO Agreement, filled out the same way as for a Payment Request
              above, plus a W-9 and a{' '}
              <a
                href="/forms/special-pay-request-form.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Special Pay Form
              </a>
              .
            </p>
            <p>
              Since they&rsquo;re an NU employee, they&rsquo;ll be paid directly by
              Northwestern, so there&rsquo;s no payment method to pick here.
            </p>
          </>
        ),
      },
      {
        question: 'What about other SOFO transaction types?',
        answer: (
          <>
            <p>
              WildcatLedger currently only supports the four types above. SOFO also
              handles a few others that aren&rsquo;t in the app yet:
            </p>
            <ul>
              <li>
                <strong>Corporate Card purchases:</strong> attach a contract, invoice, and
                payment link as needed
              </li>
              <li>
                <strong>iBuyNU:</strong> attach a screenshot of the Amazon cart
              </li>
              <li>
                <strong>Transfer to another group or department:</strong> include the
                other group&rsquo;s name and Project ID in the expense description
              </li>
              <li>
                <strong>Request to correct a prior transaction</strong>
              </li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    slug: 'documents-requests',
    heading: 'Documents & requests',
    items: [
      {
        question: 'What if I don’t have a document yet?',
        answer:
          'Check "I don’t have this yet" on the form and save the transaction anyway. It gets flagged as missing that document, and it just can’t move to Approved or Paid until the file actually shows up.',
      },
      {
        question: 'Can I request a document from someone else without leaving the app?',
        answer:
          'Yes. For a Receipt, W-9, or Special Pay Form, the request emails the other party directly and they fill it out and send it back. For an RSO Agreement or Contracted Services Form, your org fills in its own half first, then sends it to the vendor to sign. A Conflict of Interest Form is filled out and uploaded entirely by your org, since there’s nobody outside it to send it to.',
      },
      {
        question: 'What does the automatic check on a W-9 or RSO Agreement upload do?',
        answer:
          'When you upload one, WildcatLedger scans it and outlines anything that looks blank (a missing signature, an unchecked box, an unfilled section) right on the preview, so you can catch it before submitting instead of after SOFO sends it back. It’s advisory, not a hard block. If a flag doesn’t actually apply, you can acknowledge it and submit anyway. Nothing from the document itself is ever stored by this check. It only ever reports back what looks incomplete.',
      },
    ],
  },
  {
    slug: 'approvals-edits',
    heading: 'Approvals & edits',
    items: [
      {
        question: 'Why does editing a transaction sometimes need a second approver?',
        answer:
          'Only when the edit changes the amount, type, or budget line, since those are the things that actually affect your org’s money. Everything else (title, date, notes, vendor info, attached documents) takes effect immediately and still shows up in the audit log.',
      },
      {
        question: 'Why can’t I approve my own change?',
        answer:
          'So a second, independent person always looks at anything that moves money before it sticks. That accountability is the whole point, no one person can move or erase your org’s money unilaterally. The same rule applies to deletions.',
      },
      {
        question: 'What do Pending, Approved, and Paid mean?',
        answer: (
          <>
            <p>
              &ldquo;Pending&rdquo; means you&rsquo;ve already submitted the SOFO
              Microsoft Form and are logging it here. The ledger doesn&rsquo;t have a
              separate &ldquo;still gathering paperwork&rdquo; state.
            </p>
            <p>
              &ldquo;Approved&rdquo; means SOFO has signed off. SOFO goes through multiple
              internal approval stages on their end for each transaction, so this
              collapses all of that into one status: everyone there has signed off.
            </p>
            <p>
              &ldquo;Paid&rdquo; means the money has actually gone out. From here,
              it&rsquo;s on your org to confirm the vendor actually received it, since
              there&rsquo;s no automatic confirmation built into this that they did.
            </p>
            <p>
              A transaction can&rsquo;t move to Approved while it&rsquo;s still missing a
              required document, so in practice it never even gets the chance to reach
              Paid in that state either.
            </p>
          </>
        ),
      },
      {
        question: 'When does a transaction actually affect my budget balance?',
        answer:
          'For Payment Requests, Reimbursements, NU-Employee payments, and debit-card reloads, not until it reaches Paid, since the money hasn’t actually moved before then. A Debit Card purchase or a regular Deposit hits the balance right away, since that money already moved the moment it happened.',
      },
      {
        question: 'How long does processing actually take?',
        answer: (
          <>
            <p>
              Usually 2 to 3 weeks for SOFO or the Cashier&rsquo;s Office to fully process
              a transaction, sometimes longer mid-quarter since both offices are handling
              paperwork from hundreds of Northwestern organizations at once. Submitting
              everything correctly the first time is the biggest lever you have over that
              timeline. Checking in with them periodically isn&rsquo;t official policy,
              just a personal recommendation, but it&rsquo;s a good way to make sure
              nothing falls through the cracks.
            </p>
            <p>
              <strong>In WildcatLedger:</strong> this timeline is entirely on SOFO&rsquo;s
              and the Cashier&rsquo;s Office&rsquo;s side. The app doesn&rsquo;t track or
              affect it.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: 'financial-tasks',
    heading: 'Financial Tasks',
    items: [
      {
        question: 'What’s the Tasks page for?',
        answer:
          'Tracking your org’s financial deadlines and paperwork by quarter, separate from the transaction ledger itself. Attach a payment type to a task and it builds a document checklist for it automatically, using the same requirements listed above.',
      },
    ],
  },
  {
    slug: 'other',
    heading: 'Other',
    items: [
      {
        question: 'Who can see my organization’s data?',
        answer: (
          <>
            Only the officers and SOFO Approvers listed on your org. Every
            organization&rsquo;s data is walled off from every other organization&rsquo;s,
            and nothing is ever shared outside your org&rsquo;s own list. See the{' '}
            <Link to="/privacy">Privacy Policy</Link> for the full picture.
          </>
        ),
      },
      {
        question: 'Something’s wrong, or this doesn’t cover my question.',
        answer: (
          <>
            Email{' '}
            <a href="mailto:christopherridad@gmail.com">christopherridad@gmail.com</a> any
            time.
          </>
        ),
      },
    ],
  },
];

// Only one section sits in this vertical band at a time while scrolling, so
// whichever entry fires isIntersecting is the current section -- no need to
// compare boundingClientRect positions across entries.
const ACTIVE_SECTION_OBSERVER_OPTIONS: IntersectionObserverInit = {
  rootMargin: '-15% 0px -70% 0px',
};

export const FAQPage = () => {
  const navigate = useNavigate();
  const [activeSlug, setActiveSlug] = useState<string>(SECTIONS[0].slug);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSlug(entry.target.id);
        }
      });
    }, ACTIVE_SECTION_OBSERVER_OPTIONS);

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.slug);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="wl-register-root">
      <div className="wl-faq-shell">
        <aside className="wl-faq-sidebar">
          <nav aria-label="Table of contents">
            <p className="wl-faq-sidebar-label">On this page</p>
            <ul>
              {SECTIONS.map((section) => (
                <li key={section.slug}>
                  <a
                    href={`#${section.slug}`}
                    aria-current={section.slug === activeSlug ? 'true' : undefined}
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="wl-register-card wl-faq-card">
          <button type="button" className="wl-btn-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1 className="wl-register-title">Frequently Asked Questions</h1>
          <p className="wl-register-subtitle">
            How WildcatLedger actually works, in plain terms.
          </p>

          {SECTIONS.map((section) => (
            <div key={section.slug} id={section.slug} className="wl-faq-section">
              <h2>{section.heading}</h2>
              {section.items.map((item) => (
                <details key={item.question} className="wl-faq-item">
                  <summary className="wl-faq-question">{item.question}</summary>
                  <div className="wl-faq-answer">{item.answer}</div>
                </details>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
