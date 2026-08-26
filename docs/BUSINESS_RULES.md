# Business rules

This is a plain-language explainer of the financial rules WildcatLedger enforces. Most of them are
tied to SOFO (Northwestern's Student Organization Finance Office) policy, not general accounting
practice. Each section explains the rule the way a treasurer or president would need to understand
it, then adds a short **Technical implementation** note underneath for developers. Code comments
should point back here instead of re-explaining the "why."

One note on staying current: the database has been through many rounds of changes, so the
technical notes describe today's behavior rather than citing which past change introduced it.
Where a specific historical change is genuinely the point, it's called out explicitly as a
historical note.

## Roles & permissions

Every org has a **SOFO Approvers** list and an **officers** list. SOFO Approvers (usually the
treasurer and president, since they're the ones who actually process a club's paperwork with SOFO)
are the only people who can add, edit, or delete transactions, approve pending changes, reconcile
the debit card, and change SOFO settings. This doc calls that group "managers." SOFO itself doesn't
distinguish which title did the work, just that a SOFO Approver did — the app used to track
treasurer/president/admins as separate lists, but they always granted identical permissions
everywhere, so they were merged into one list. Officers can see everything but can't make changes
beyond their own baseline access as a member.

**Technical implementation:** role resolution happens client-side in `LedgerContext.tsx`, checking
`sofoApprovers` first, then `officers`, matched by email against the signed-in user. The
`UserRole` type is just `'sofoApprover' | 'officer'`. Enforced server-side too — see the RLS
policies and `can_manage_org`/`is_org_member` functions in `supabase/migrations/0018_sofo_approvers.sql`
onward — so this holds even if the interface were bypassed entirely.

## Transaction types & their documents

There are five kinds of transactions, and each one has its own required paperwork:

| Type                      | Documents required                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Debit Card                | A receipt, or a completed Policy Exemption Form instead (see [Tax exemption](#tax-exemption--sofo-reimbursement))                                |
| Non-Officer Reimbursement | A receipt                                                                                                                                        |
| Payment Request           | RSO Agreement and W-9, plus a Contracted Services Form and Conflict of Interest Form if the vendor is an individual person rather than a company |
| Payment to NU Employee    | RSO Agreement, W-9, and Special Pay Form                                                                                                         |
| Deposit                   | none                                                                                                                                             |

A transaction can always be saved before its paperwork is in hand. Just check "I don't have this
yet" on the form. It gets flagged as missing that document, and can't be moved to Approved or Paid
until the file actually shows up (see [Payment status lifecycle](#payment-status-lifecycle)).

A Deposit can only be funded from Operating or Gifts, never ASG. ASG funds aren't eligible to back
a debit-card reload or any other deposit.

**Technical implementation:** this matrix is defined once, in `getRequiredDocuments()` in
[`documentRequirements.ts`](../src/features/ledger/utils/documentRequirements.ts). The database has
its own copy of this same logic as a safety net, refusing to mark something Approved or Paid if the
paperwork is missing. If you change the matrix, that server-side copy needs to be kept in sync by
hand.

**Historical note:** these type names used to be different. "Direct payment" became "Payment
Request," "Debit card purchase" became "Debit Card," and "Reimbursement" became "Non-Officer
Reimbursement." "Payment to NU Employee" is a newer type, split out of what used to all be one
"Payment Request" bucket. Old Payment Request transactions that were actually paid to a Northwestern
employee were **not** retroactively reclassified into the new type. They were left as-is.

## Dual-approval workflow

Deleting a transaction always needs a second treasurer or president to sign off on it, and nobody
can approve their own request.

Editing is narrower. An edit only needs a second person's approval if it changes the **amount,
type, or budget line**, since those are the things that actually affect the org's money. Everything
else (title, date, notes, vendor info, attached documents, "I don't have this yet" checkboxes)
takes effect immediately with no approval needed, and still shows up in the audit log as a plain
edit.

Regular members who aren't managers can't edit or delete transactions at all through the normal
flow. The one exception: any member can attach a completed Policy Exemption Form themselves,
without needing a treasurer or president to do it for them. That's the one field members are
allowed to touch directly.

Once a Debit Card transaction has been reconciled, it's locked for good. It can never be edited or
deleted again, whether directly or through the approval flow (see
[Debit Card reconciliation](#debit-card-reconciliation)).

**Technical implementation:** the "can't approve your own change" rule and the "only
amount/type/budget-line edits need approval" split are both enforced in the database, not just the
interface, in `resolve_pending_change_with_audit` and `transaction_edit_requires_approval`. The
member-can-only-touch-the-exemption-form rule is a database-level column restriction, so it holds
even if the interface were bypassed entirely.

## Payment status lifecycle

Payment Request, Non-Officer Reimbursement, and Payment to NU Employee transactions move through
three stages: **Pending → Approved → Paid**. Unlike editing, changing this status only needs one
treasurer or president, not two. Status changes happen often enough, and are low-risk enough, that
requiring a second sign-off would just slow things down without adding real protection.

**"Pending" means already submitted to SOFO**, not "still being put together." The intended
workflow is submit the SOFO Microsoft Form first, then log the transaction here — the ledger has
no separate "still gathering paperwork" state, and isn't meant to. Nothing technically enforces
that ordering (there's nothing stopping someone from logging it first), but that's the assumption
the rest of this lifecycle is built on. "Approved" collapses SOFO's own multi-approver review on
their end into a single status once everyone there has signed off.

A transaction can't move to Approved or Paid while it's still missing a required document. SOFO
won't actually cut a check without the paperwork in hand, so the app won't let it be marked ready
either.

**When money actually counts against the budget is delayed for some types.** A Payment Request,
Reimbursement, NU-Employee payment, or debit-card reload doesn't affect the budget line's balance
until it reaches Paid, because the money hasn't actually gone out yet while it's still Pending or
Approved. A Debit Card _purchase_ and a regular (non-reload) Deposit work differently: they hit the
balance right away, since that money already moved the moment the purchase or deposit happened.

**A debit-card reload is really just a special Deposit,** one made specifically on the Debit Card
budget line. It goes through the same Pending → Paid stages as everything else above, but skips the
Approved step entirely. Approving a reload _is_ reloading it, so there's no separate "now pay it
out" step after that. It only ever goes Pending → Paid, and is shown to users as "Reloaded."

**Technical implementation:** the status update is a single-approver database function
(`update_payment_status_with_audit`), separate from the dual-approval edit/delete path. The
document-completeness check and the deferred-balance logic both live in the database, not just the
interface, so they hold regardless of how the request gets made.

**Historical note, a bug and its fix:** at one point, a change to how transactions get created
accidentally broke the "don't count it until Paid" rule above. Every transaction's full amount
started hitting the budget balance the moment it was created, regardless of its status. This was
later caught and fixed, along with a one-time correction to every affected org's budget numbers
(their audit-log history wasn't rewritten, just the current balance). It's a good illustration of
why keeping the ledger write, the budget update, and the audit-log entry bundled as one atomic step
matters in practice. See [Architecture notes](#for-developers-a-few-architectural-choices).

## Debit Card reconciliation

A Debit Card _purchase_ (not a reload; reloads are Deposits, and follow the payment-status flow
above instead) is considered "covered" once it has either a receipt or an attached Policy Exemption
Form. The two are interchangeable. A purchase can't be reconciled if:

- it isn't covered (no receipt or exemption form),
- it owes an unresolved tax reimbursement to SOFO (see below), or
- it has a pending edit or delete request still awaiting approval.

Once a purchase has been reconciled, it's locked permanently. It can never be edited or deleted
again, through any path.

**Technical implementation:** the "covered" check and all three reconciliation blockers are
enforced in `reconcile_transactions_with_audit`, and the post-reconciliation lock is enforced by the
same database functions that handle edits and deletes, not by the interface hiding the buttons.

## Tax exemption & SOFO reimbursement

Orgs are tax-exempt at the register when the exemption form is shown at the time of purchase, so a
Debit Card purchase should never actually have sales tax on it. When it does anyway, because the
exemption form wasn't shown and tax shows up on the receipt, the full amount (tax included) still
hits the budget immediately just like normal. But the transaction gets flagged as owing SOFO a
reimbursement.

Clearing that flag is **self-attested**. The actual repayment happens on SOFO's own external
payment site, which this app has no direct connection to. "Mark as Reimbursed" only needs one
treasurer or president to confirm it happened, the same as any other payment-status change.

**Technical implementation:** the external payment link lives in
[`constants.ts`](../src/features/ledger/utils/constants.ts) as a plain URL. There's no API
integration or webhook, so "reimbursed" is purely a flag the app trusts a manager to set honestly.

## SOFO / Cashier's Office settings

Each org can save the debit-card details needed to pre-fill the official SOFO debit-card
reconciliation form: Project ID, Account No., last 4 digits of the card, Inventory Control No., and
the card's load balance (its fixed limit, not its current running balance, which is tracked
separately). The exact formats below come straight from that official form's own validation rules,
not a choice made by this app:

- **Project ID:** 8 digits, between `70000000` and `79999999`
- **Account No.:** the format `20XX-XXX` (e.g. `2000-000`)
- **Inventory Control No.:** 8 digits, a dash, then 7 more digits (e.g. `12345678-1234567`)

**Technical implementation:** these fields are stored as regular, unencrypted columns. The last 4
digits and the Inventory Control No. aren't the full card number, and the database already encrypts
everything at rest the same way it does for every other piece of information it stores.

## Document requirements & requesting documents

When a document is missing, the treasurer or president can request it by email without leaving the
app. There are three different ways that plays out, depending on who actually needs to do the work:

- **The other party just handles it.** Receipt, W-9, and Special Pay Form all work this way: send
  the request, and the vendor or member fills it out and sends it back.
- **The org fills in its half first.** RSO Agreement and Contracted Services Form need the
  treasurer/president to download a blank template, fill in the org's side, and then send it to the
  vendor to sign. Since an email link can't attach a file automatically, the app has to remind
  whoever's sending it to attach their filled-in copy before hitting send.
- **Nobody outside the org is involved.** The Conflict of Interest Form is filled out and uploaded
  entirely by the treasurer/president, so there's nothing to email anyone about.

**Technical implementation:** which documents a transaction type needs is logic that currently has
to be kept in sync in three separate places: the canonical list in `documentRequirements.ts`,
form-time validation in `validation.ts`, and the database's own Approved/Paid gate. If you change
what's required for a type, check all three.

## For developers: a few architectural choices

These aren't SOFO rules. They're implementation decisions with no treasurer-facing equivalent, kept
here because they explain why the code is shaped this way.

- **Atomicity.** A financial action either fully succeeds or leaves no trace at all. The ledger
  write, the budget-balance update, and the audit-log entry always happen together as a single
  database transaction, never as separate steps that could partially fail.
- **File storage.** Transactions store Supabase Storage _paths_, not signed URLs, because URLs
  expire and paths don't. A signed, temporary URL is generated on the fly whenever a file actually
  needs to be viewed or downloaded.
- **Anonymous document uploads.** The emailed upload link works for someone with no account in the
  app, using a single-use token that's generated when the link is sent. The anonymous visitor can
  only read the one thing they need, the transaction's title, to confirm the link is valid. They
  never get direct access to anything else.
