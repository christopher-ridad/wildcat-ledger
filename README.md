# Wildcat Ledger

A budget management platform for Northwestern student organizations, replacing spreadsheet-based financial tracking with a centralized web app for transactions, supporting documents, approval workflows, audit history, and debit card reconciliation.

**🔗 Live app:** [wildcat-ledger.vercel.app](https://wildcat-ledger.vercel.app/)

---

## Why Wildcat Ledger?

Most Northwestern student orgs were tracking budgets across scattered spreadsheets, with no audit trail, no permission structure, and no easy way for multiple e-board members to safely manage shared funds. Wildcat Ledger centralizes that into one application with:

- **Multi-account budgets** across transactions, supporting documents, and reconciliation
- **Role-based permissions** enforced at the database layer via Postgres Row-Level Security, not just hidden in the UI
- **Audited approval workflow** with full transaction and audit history
- **Debit card reconciliation** to match spending against statements
- **Token-scoped receipt uploads** for unauthenticated contributors submitting reimbursements
- **Automatic document completeness checks** for the five required SOFO forms (W-9, RSO Agreement, Contracted Services, Conflict of Interest, Special Pay Request), flagging likely-blank fields before submission

## Architecture

- **Frontend:** React + Vite + TypeScript, communicating directly with Supabase from the client
- **Backend:** Supabase (Postgres, Auth, Storage). No separate API server; business logic and access control live in the database itself
- **Permissions:** enforced via Postgres Row-Level Security policies rather than application-layer checks, so access control holds even if a client request bypasses the UI
- **Audit trail:** every transaction and approval action is logged, giving orgs a full history of who did what and when
- **Receipt & budget-document scanning:** Google Cloud Vision OCR pre-fills a receipt's title/amount, or a budget-allocation document's line amounts, on upload — always reviewable and editable, never blocking manual entry if a scan fails
- **Document completeness checks:** Google Cloud Document AI runs server-side (via Supabase Edge Functions, `supabase/functions/check-*-completeness`) against each of the five required SOFO forms, flagging fields that look blank with a red box on the rendered page — advisory only, requires an explicit acknowledgment to proceed rather than blocking, and fails open (not at all) if the check itself errors
- **Testing:** Vitest for unit/integration coverage, Playwright for end-to-end flows (including automated WCAG accessibility scans via axe-core), both run in CI before merges

## Tech Stack

React · TypeScript · Vite · Supabase (Postgres, RLS, Auth, Storage) · Vitest · Playwright

## Getting Started

**Requirements:** Node.js 22+, npm 10+, and a Supabase project running the schema in `supabase/migrations`.

```bash
npm install
cp .env.example .env
```

Fill in `.env` with your Supabase project URL and keys.

```bash
npm run dev        # start the local dev server
npm run build      # type-check + production build
npm test -- --run  # run the full test suite once
npm run e2e        # run the Playwright end-to-end suite (needs a local Supabase instance, see supabase/)
```

Before shipping changes, run `npm run type-check`, `npm test -- --run`, and `npm run build`.

## Author

Originally built as a team project at Northwestern; now maintained by
[Christopher Ridad](https://linkedin.com/in/christopher-ridad).
