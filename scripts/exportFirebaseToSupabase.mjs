/**
 * One-off migration: reads every club (and its transactions/audit log/
 * pending changes/reload requests) out of the old Firestore project and
 * writes equivalent rows into the new Supabase schema.
 *
 * Uses the Firebase Admin SDK so it bypasses firestore.rules entirely and
 * sees every club, not just ones a given user is a member of.
 *
 * NOTE: receiptFileUrl/contractFileUrl/w9FileUrl/contractedServicesFileUrl/
 * conflictOfInterestFileUrl/exemptionFormUrl pointed at Firebase Storage
 * download URLs. Supabase Storage is a different system with a private
 * bucket, so those URLs won't resolve — this script intentionally migrates
 * the transaction *data* but leaves those file fields null. Re-upload
 * documents manually afterward if you need them for testing.
 *
 * Run with:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/key.json node scripts/exportFirebaseToSupabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT_PATH to the downloaded service account JSON file.');
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const firestore = getFirestore();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function migrateClub(clubDoc) {
  const data = clubDoc.data();
  const name = data.name ?? clubDoc.id;

  console.log(`\n— ${name} (${clubDoc.id})`);

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .upsert(
      {
        name,
        admins: data.admins ?? [],
        treasurer: data.treasurers ?? data.treasurer ?? [],
        president: data.presidents ?? data.president ?? [],
        officers: data.officers ?? [],
        budget_allocations: data.budgetAllocations ?? {
          ASG: 0,
          Operating: 0,
          Gifts: 0,
          'Debit Card': 0,
        },
        is_budget_lines_set: data.isBudgetLinesSet ?? false,
        last_reconciliation_date: data.lastReconciliationDate ?? null,
      },
      { onConflict: 'name' },
    )
    .select()
    .single();
  if (orgError) throw orgError;

  const txnIdMap = new Map(); // Firestore transaction ID -> new Supabase uuid

  const txnsSnap = await firestore.collection('clubs').doc(clubDoc.id).collection('transactions').get();
  if (!txnsSnap.empty) {
    const rows = txnsSnap.docs.map((doc) => {
      const t = doc.data();
      return {
        org_id: org.id,
        title: t.title,
        date: t.date ?? null,
        amount: t.amount,
        direction: t.direction,
        type: t.type,
        funding: t.funding ?? null,
        budget_line: t.budgetLine,
        notes: t.notes ?? '',
        zelle_info: t.zelleInfo ?? null,
        is_individual_vendor: t.isIndividualVendor ?? null,
        no_receipt_acknowledged: t.noReceiptAcknowledged ?? null,
        // File URLs pointed at Firebase Storage and don't carry over — see header comment.
        receipt_file_url: null,
        contract_file_url: null,
        w9_file_url: null,
        contracted_services_file_url: null,
        conflict_of_interest_file_url: null,
        exemption_form_url: null,
        reconciled_at: t.reconciledAt ?? null,
        firestoreId: doc.id, // not a real column — stripped before insert below
      };
    });

    const { data: inserted, error: txnError } = await supabase
      .from('transactions')
      .insert(rows.map(({ firestoreId, ...row }) => row))
      .select('id');
    if (txnError) throw txnError;

    rows.forEach((row, i) => txnIdMap.set(row.firestoreId, inserted[i].id));
    console.log(`  ${rows.length} transactions migrated`);
  }

  const remapTxnId = (firestoreTxnId) => txnIdMap.get(firestoreTxnId) ?? null;

  const auditSnap = await firestore.collection('clubs').doc(clubDoc.id).collection('auditLog').get();
  if (!auditSnap.empty) {
    const rows = auditSnap.docs
      .map((doc) => doc.data())
      .map((a) => ({
        org_id: org.id,
        action: a.action,
        performed_by: a.performedBy,
        timestamp: a.timestamp,
        transaction_id: remapTxnId(a.transactionId) ?? a.transactionId ?? '',
        transaction_title: a.transactionTitle ?? '',
        before: a.before ?? null,
        after: a.after ?? null,
        reconciliation_summary: a.reconciliationSummary ?? null,
        reload_amount: a.reloadAmount ?? null,
      }));
    const { error } = await supabase.from('audit_log').insert(rows);
    if (error) throw error;
    console.log(`  ${rows.length} audit log entries migrated`);
  }

  const pendingSnap = await firestore.collection('clubs').doc(clubDoc.id).collection('pendingChanges').get();
  if (!pendingSnap.empty) {
    const rows = pendingSnap.docs
      .map((doc) => doc.data())
      .map((p) => ({
        org_id: org.id,
        type: p.type,
        transaction_id: remapTxnId(p.transactionId),
        transaction_title: p.transactionTitle,
        requested_by: p.requestedBy,
        requested_by_role: p.requestedByRole,
        requested_at: p.requestedAt,
        before: p.before,
        after: p.after ?? null,
      }))
      .filter((p) => p.transaction_id); // skip if the referenced transaction wasn't migrated
    if (rows.length) {
      const { error } = await supabase.from('pending_changes').insert(rows);
      if (error) throw error;
      console.log(`  ${rows.length} pending changes migrated`);
    }
  }

  const reloadSnap = await firestore.collection('clubs').doc(clubDoc.id).collection('reloadRequests').get();
  if (!reloadSnap.empty) {
    const rows = reloadSnap.docs
      .map((doc) => doc.data())
      .map((r) => ({
        org_id: org.id,
        amount: r.amount,
        requested_by: r.requestedBy,
        requested_at: r.requestedAt,
        reconciled_total: r.reconciledTotal,
        transaction_count: r.transactionCount,
      }));
    const { error } = await supabase.from('reload_requests').insert(rows);
    if (error) throw error;
    console.log(`  ${rows.length} reload requests migrated`);
  }
}

async function main() {
  const clubsSnap = await firestore.collection('clubs').get();
  console.log(`Found ${clubsSnap.size} clubs in Firestore.`);

  for (const clubDoc of clubsSnap.docs) {
    await migrateClub(clubDoc);
  }

  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => firestore.terminate());
