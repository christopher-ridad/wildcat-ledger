# WildcatLedger

WildcatLedger is a React/Vite ledger app for managing Northwestern student organization budgets, transactions, supporting documents, approval flows, audit history, and debit card reconciliation.

## Requirements

- Node.js `22+`
- npm `10+`
- Supabase project with the schema in `supabase/migrations`

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env` with the Supabase URL and keys needed by the app and scripts.

## Scripts

- `npm run dev` starts the local Vite dev server.
- `npm run build` type-checks and creates a production build.
- `npm run type-check` runs TypeScript without emitting files.
- `npm run lint` formats and fixes lint issues.
- `npm test` runs Vitest in watch mode.
- `npm test -- --run` runs the test suite once.
- `npm run test:coverage` runs tests with coverage.
- `npm run test:ui` starts the Vitest UI on `127.0.0.1:51204`.

## Utility Scripts

- `node scripts/importAdmins.mjs path/to/club_officers.csv` imports organization officers into Supabase.
- `node scripts/devLogin.mjs you@example.com` creates a development magic link with the Supabase Admin API.
- `FIREBASE_SERVICE_ACCOUNT_PATH=path/to/key.json node scripts/exportFirebaseToSupabase.mjs` migrates legacy Firestore data into Supabase.

The utility scripts require `SUPABASE_SERVICE_ROLE_KEY`; keep it server-side and out of committed files.

## Verification

Before shipping changes, run:

```bash
npm run type-check
npm test -- --run
npm run build
```
