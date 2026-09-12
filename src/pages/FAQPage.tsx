import type { ReactNode } from 'react';

interface FaqItem {
  question: string;
  answer: ReactNode;
}

interface FaqSection {
  heading: string;
  items: FaqItem[];
}

// Written from docs/BUSINESS_RULES.md and documentRequirements.ts -- if a
// rule changes there, it should change here too.
const SECTIONS: FaqSection[] = [
  {
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
          'SOFO Approvers (usually your treasurer and president, since they’re the ones who actually process paperwork with SOFO) can add, edit, or delete transactions, approve pending changes, reconcile the debit card, and change SOFO settings. Officers can see everything but can’t make changes beyond what any regular member can.',
      },
      {
        question: 'Can regular members do anything?',
        answer:
          'They can view every transaction and budget line, and attach a completed Policy Exemption Form to a Debit Card purchase themselves. That’s the one thing a member can change directly. Everything else needs a SOFO Approver.',
      },
    ],
  },
  {
    heading: 'Transactions & documents',
    items: [
      {
        question: 'What documents does each transaction type need?',
        answer: (
          <ul>
            <li>
              <strong>Debit Card:</strong> a receipt, or a Policy Exemption Form instead
            </li>
            <li>
              <strong>Non-Officer Reimbursement:</strong> a receipt
            </li>
            <li>
              <strong>Payment Request:</strong> RSO Agreement and W-9, plus a Contracted
              Services Form and Conflict of Interest Form if you&rsquo;re paying an
              individual person rather than a company
            </li>
            <li>
              <strong>Payment to NU Employee:</strong> RSO Agreement, W-9, and Special Pay
              Form
            </li>
            <li>
              <strong>Deposit:</strong> nothing
            </li>
          </ul>
        ),
      },
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
          'So a second, independent person always looks at anything that moves money before it sticks. The same rule applies to deletions.',
      },
      {
        question: 'What do Pending, Approved, and Paid mean?',
        answer:
          '"Pending" means you’ve already submitted the SOFO Microsoft Form and are logging it here. The ledger doesn’t have a separate "still gathering paperwork" state. "Approved" means SOFO has signed off. "Paid" means the money has actually gone out. A transaction can’t move to Approved or Paid while it’s still missing a required document.',
      },
      {
        question: 'When does a transaction actually affect my budget balance?',
        answer:
          'For Payment Requests, Reimbursements, NU-Employee payments, and debit-card reloads, not until it reaches Paid, since the money hasn’t actually moved before then. A Debit Card purchase or a regular Deposit hits the balance right away, since that money already moved the moment it happened.',
      },
    ],
  },
  {
    heading: 'Debit Card',
    items: [
      {
        question: 'How does debit card reconciliation work?',
        answer:
          'A purchase can be reconciled once it’s "covered" (a receipt or Policy Exemption Form attached), doesn’t owe SOFO a tax reimbursement, and doesn’t have a pending edit or delete request still awaiting approval. Reconciling doesn’t lock it in place. A correction afterward goes through the same second-approver rule as any other transaction edit.',
      },
      {
        question: 'What’s a "reload"?',
        answer:
          'Adding money back onto the debit card. It’s really just a Deposit made on the Debit Card budget line, shown as "Reloaded" once it reaches Paid. It skips the Approved step since approving a reload is reloading it.',
      },
      {
        question: 'What happens if there’s sales tax on a debit card receipt?',
        answer:
          'Your org should be tax-exempt at checkout whenever the exemption form is shown, so this shouldn’t normally happen. If it does, the full amount (tax included) still counts against your budget right away, and the transaction gets flagged as owing SOFO a reimbursement. Clearing that flag is self-attested. The actual repayment happens on SOFO’s own site, which this app doesn’t connect to directly.',
      },
    ],
  },
  {
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
    heading: 'Other',
    items: [
      {
        question: 'Who can see my organization’s data?',
        answer:
          'Only the officers and SOFO Approvers listed on your org. Every organization’s data is walled off from every other organization’s, and nothing is ever shared outside your org’s own list. See the Privacy Policy for the full picture.',
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

export const FAQPage = () => (
  <div className="wl-register-root">
    <div className="wl-register-card wl-faq-card">
      <h1 className="wl-register-title">Frequently Asked Questions</h1>
      <p className="wl-register-subtitle">
        How WildcatLedger actually works, in plain terms.
      </p>

      {SECTIONS.map((section) => (
        <div key={section.heading} className="wl-faq-section">
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
);
