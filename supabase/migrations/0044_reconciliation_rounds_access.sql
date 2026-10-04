-- Production created debit_card_reconciliations (0043) without the default
-- privileges Supabase normally hands new tables, so signed-in users couldn't
-- read it. That hid "View last reconciliation" and also broke saving a
-- round's follow-up choices, since each save reads the row back. Granted
-- explicitly here instead of relying on defaults. Insert and delete stay off
-- for signed-in users (0043): rounds are only created by
-- reconcile_transactions_with_audit. Safe to run more than once.

grant select on debit_card_reconciliations to authenticated;
grant select, insert, update, delete on debit_card_reconciliations to service_role;
