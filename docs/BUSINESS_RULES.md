# Business rules

WildcatLedger encodes a specific set of Northwestern student-org financial rules — most of them
tied to SOFO (Student Organization Finance Office) policy, not general accounting practice. This
doc is the single place those rules are explained; the code should read as _mechanism_, pointing
back here for _why_.

Rules that matter for correctness are enforced server-side, in the Postgres RPCs under
[`supabase/migrations/`](../supabase/migrations/) — that's the authoritative source. The client
mirrors the same rules for fast feedback (form validation, disabled buttons), but a client-side
check alone is never the real guarantee.

## Roles & permissions

Every org has a `treasurer`, a `president`, an `officers` list, and an `admins` list. Treasurer and
president are "managers" — the only roles that can add/edit/delete transactions, approve pending
changes, reconcile the debit card, and change SOFO settings. `admins` is treated as
treasurer-equivalent for permission purposes (`LedgerContext.tsx`'s `userRole` resolution checks it
last, after treasurer/president/officer). `officers` is read-only beyond a member's own baseline
access.

## Transaction types & their documents

Five transaction types, each with its own required paperwork. A transaction can always be saved
without its documents by checking "I don't have this yet" — it just gets flagged as missing and
can't move to `Approved`/`Paid` until the file shows up (see
[Document requirements](#document-requirements-requesting-documents) and
[Payment status lifecycle](#payment-status-lifecycle)).

| Type                      | Documents required                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Debit Card                | Receipt (or an attached Policy Exemption Form in its place — see [Tax exemption](#tax-exemption--sofo-reimbursement)) |
| Non-Officer Reimbursement | Receipt                                                                                                               |
| Payment Request           | RSO Agreement, W-9 — plus Contracted Services Form and Conflict of Interest Form if the vendor is an individual       |
| Payment to NU Employee    | RSO Agreement, W-9, Special Pay Form                                                                                  |
| Deposit                   | none                                                                                                                  |

A Deposit can only be funded from Operating or Gifts, never ASG — ASG funds aren't eligible to
back a debit-card reload or other deposit.

This matrix is defined once, in `getRequiredDocuments()` in
[`src/features/ledger/utils/documentRequirements.ts`](../src/features/ledger/utils/documentRequirements.ts) —
the SQL-side document-completeness gate (`update_payment_status_with_audit`, see
[`0014_missing_document_flags.sql`](../supabase/migrations/0014_missing_document_flags.sql)) is
meant to mirror it exactly.

**Historical note:** transaction types were renamed in
[`0013_transaction_type_rename.sql`](../supabase/migrations/0013_transaction_type_rename.sql):
"Direct payment" → "Payment Request", "Debit card purchase" → "Debit Card", "Reimbursement" →
"Non-Officer Reimbursement", and "Payment to NU Employee" was newly split out. Pre-existing
"Payment Request" rows that used the old Northwestern-employee checkbox were **not** retroactively
reclassified — they keep their `is_northwestern_employee` flag and stay typed as "Payment Request."

## Dual-approval workflow

Deleting a transaction always requires a second manager's approval (via `pending_changes`), and a
manager can never approve or reject their own request — enforced both client-side and, as of
[`0015_selective_edit_approval.sql`](../supabase/migrations/0015_selective_edit_approval.sql),
server-side in `resolve_pending_change_with_audit`.

Editing is narrower: only an edit that changes the **amount, type, or budget line** requires
approval. Everything else (title, date, notes, vendor info, documents, acknowledgment checkboxes)
applies immediately and is logged as a plain `edit` action — see
`transaction_edit_requires_approval` in the same migration.

Non-managers (regular members) can't edit or delete at all through the normal flow — the one
exception is `exemption_form_url`, which any member can attach directly (enforced by
`transactions_restrict_member_updates` in
[`0001_init.sql`](../supabase/migrations/0001_init.sql)), so a member can clear a tax-exemption
issue without needing a manager to intervene.

A Debit Card transaction that's already been reconciled can never be edited or deleted, pending or
otherwise — both RPCs refuse to touch it (see
[Debit Card reconciliation](#debit-card-reconciliation)).

## Payment status lifecycle

Payment Request, Non-Officer Reimbursement, and Payment to NU Employee transactions carry a
`payment_status`: `Pending → Approved → Paid`. It's a **direct, single-approver** update (see
`update_payment_status_with_audit` in
[`0007_payment_status.sql`](../supabase/migrations/0007_payment_status.sql)) — unlike editing a
transaction's other fields, status changes are frequent and low-risk enough that requiring dual
sign-off would just be friction.

Moving to `Approved` or `Paid` is blocked while any required document is still missing (added in
[`0014_missing_document_flags.sql`](../supabase/migrations/0014_missing_document_flags.sql)) — SOFO
won't actually pay something out without the paperwork in hand, so the ledger shouldn't sign it off
as ready either.

**Budget balance recognition is deferred, not immediate**, for these types: a Payment
Request/Reimbursement/NU-Employee-payment (and a Debit Card reload — see below) only counts against
the budget line once it reaches `Paid`. A Debit Card _purchase_ and a non-reload Deposit, by
contrast, post to the budget immediately at creation, because that money has already moved. See
[`0008_paid_status_gates_balance.sql`](../supabase/migrations/0008_paid_status_gates_balance.sql).

**Debit Card reloads are a special case of Deposit.** A Deposit whose budget line is "Debit Card" is
a reload (see [`0009_reload_as_transaction.sql`](../supabase/migrations/0009_reload_as_transaction.sql));
it goes through the same Pending→Approved→Paid lifecycle, but skips the `Approved` middle state —
approving a reload _is_ reloading it, there's no separate paid-out step. Reloads only ever go
Pending → Paid, rendered as "Reloaded" client-side
([`0010_reload_skips_approved.sql`](../supabase/migrations/0010_reload_skips_approved.sql)).

**Historical note — a regression and its fix:**
[`0012_tax_reimbursement_flag.sql`](../supabase/migrations/0012_tax_reimbursement_flag.sql) silently
dropped the deferred-recognition gate above when it redefined the create/edit/delete RPCs — every
transaction's full amount started posting to the budget balance immediately regardless of
`payment_status`.
[`0014_missing_document_flags.sql`](../supabase/migrations/0014_missing_document_flags.sql) restored
the gate and ran a one-time compensating correction against every affected org's
`budget_allocations` (it does not rewrite audit-log history). This is the reason the atomicity
principle below matters in practice, not just in theory.

## Debit Card reconciliation

A Debit Card _purchase_ (not a reload — reloads are Deposits, tracked via payment status instead)
is "covered" once it has a receipt or an attached Policy Exemption Form — the two are
interchangeable (`isCovered` in `ReconciliationModal.tsx`). Reconciliation is blocked, transaction
by transaction, on any of:

- an uncovered purchase (no receipt or exemption form),
- an unresolved tax reimbursement owed to SOFO (see below), or
- a pending edit/delete request awaiting approval.

Once reconciled, a purchase is permanently locked — the reconciliation RPCs refuse to edit or delete
it ever again. See `reconcile_transactions_with_audit` in
[`0003_atomic_ledger_workflows.sql`](../supabase/migrations/0003_atomic_ledger_workflows.sql),
extended by
[`0015_pending_change_blocks_reconciliation.sql`](../supabase/migrations/0015_pending_change_blocks_reconciliation.sql).

## Tax exemption & SOFO reimbursement

Orgs are tax-exempt at the point of purchase when the exemption form is presented, so a Debit Card
purchase should never carry sales tax. When it happens anyway (no exemption form submitted, tax
shows on the receipt), the full amount — tax included — still posts to the Debit Card line
immediately, same as always, but the transaction is flagged as owing a reimbursement to SOFO.

Clearing that flag is **self-attested**: the actual repayment happens on SOFO's own external
CardPointe form (`SOFO_SALES_TAX_REIMBURSEMENT_URL` in
[`src/features/ledger/utils/constants.ts`](../src/features/ledger/utils/constants.ts)), which this
app has no integration or callback with. "Mark as Reimbursed" is a direct, single-approver action
for the same reason `payment_status` is (see
[`0012_tax_reimbursement_flag.sql`](../supabase/migrations/0012_tax_reimbursement_flag.sql)).

## SOFO / Cashier's Office settings

Each org can store the debit-card details needed to pre-fill the official SOFO debit card
reconciliation form: Project ID, Account No., last 4 digits, Inventory Control No., and the card's
load balance (its fixed limit, distinct from the live running balance in `budget_allocations`). Field
formats come from the official form's own validation, not an app-level choice:

- **Project ID** — 8 digits, `70000000`–`79999999`
- **Account No.** — `20XX-XXX` (e.g. `2000-000`)
- **Inventory Control No.** — 8 digits, a dash, then 7 digits (e.g. `12345678-1234567`)

These are plain columns, not specially encrypted: last-4-digits and the ICN aren't the full card
number, and Postgres/Supabase already encrypts data at rest the same way it does for every other
column here. See
[`0011_debit_card_settings.sql`](../supabase/migrations/0011_debit_card_settings.sql) and
[`0016_sofo_project_id.sql`](../supabase/migrations/0016_sofo_project_id.sql).

## Document requirements & requesting documents

When a document is missing, it can be requested by email without leaving the app. Three request
behaviors, depending on who needs to act (`DocumentRequestBehavior` in `documentRequirements.ts`):

- **`simple`** — the other party just fills it out and sends it back (Receipt, W-9, Special Pay Form).
- **`prepareFirst`** — the treasurer/president downloads the blank template, fills in the org's side
  first, then sends it to the vendor to sign (RSO Agreement, Contracted Services Form). A `mailto:`
  link can't attach a file automatically, so the UI has to remind them to attach their filled-in
  copy before sending.
- **`none`** — nobody else is involved; the treasurer/president completes and uploads it themselves
  (Conflict of Interest Form), so there's nothing to email.

This document-type taxonomy is the one place with the most duplication risk in the codebase: the
same "which documents does type X need" logic is expressed in `documentRequirements.ts` (canonical),
`validation.ts` (form-time validation), and the SQL-side gate in
`update_payment_status_with_audit`. All three are meant to be kept in sync by hand — if you change
one, check the other two.

## Architecture notes

- **Atomicity.** Financial workflows must either fully succeed or leave no trace. The ledger write,
  its budget-balance delta, and its audit-log entry are grouped into one Postgres transaction per
  RPC call (transactional by default) — see the header of
  [`0003_atomic_ledger_workflows.sql`](../supabase/migrations/0003_atomic_ledger_workflows.sql).
- **File storage.** Transactions store Supabase Storage _paths_, not signed URLs — URLs expire,
  paths don't. Signed URLs are minted on demand when a file needs to be viewed or downloaded.
- **Anonymous document uploads.** The emailed upload link works without the recipient having an
  account, via a single-use token minted when the link is sent (`0001_init.sql`'s hardened
  upload-by-email-link flow). The anonymous caller can read just enough (the transaction's title, to
  confirm the link is valid) through a narrow definer function — never direct table access.
