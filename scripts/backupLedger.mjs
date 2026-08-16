/**
 * Dumps every row from organizations, transactions, audit_log,
 * pending_changes, and reload_requests to a single timestamped JSON file
 * under backups/ (gitignored). Intended as a safety snapshot before a
 * destructive operation (e.g. a full ledger reset).
 *
 * Run with:
 *   node scripts/backupLedger.mjs
 */

import { mkdirSync, writeFileSync } from 'fs';

import { supabase } from './supabaseAdmin.mjs';

const TABLES = [
  'organizations',
  'transactions',
  'audit_log',
  'pending_changes',
  'reload_requests',
];

async function fetchAll(table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
  return data;
}

async function backup() {
  const snapshot = { exportedAt: new Date().toISOString() };

  for (const table of TABLES) {
    console.log(`Reading ${table}...`);
    const rows = await fetchAll(table);
    snapshot[table] = rows;
    console.log(`  ${rows.length} rows`);
  }

  mkdirSync('backups', { recursive: true });
  const filename = `backups/wildcat-ledger-backup-${snapshot.exportedAt.replace(/[:.]/g, '-')}.json`;
  writeFileSync(filename, JSON.stringify(snapshot, null, 2));

  console.log(`\nSaved to ${filename}`);
}

backup().catch((err) => {
  console.error(err);
  process.exit(1);
});
