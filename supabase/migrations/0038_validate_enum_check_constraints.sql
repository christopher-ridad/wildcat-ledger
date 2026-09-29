-- Validates the constraints 0037 added, against every row already in each
-- table -- the part that can actually fail if any existing row holds a
-- value outside what's expected. Deliberately its own migration, separate
-- from 0037: if any VALIDATE below does turn up a bad row, only this
-- migration fails, and 0037's `not valid` constraints (already protecting
-- every write since they were added) stay in effect rather than being
-- rolled back along with it. If this fails, the error names the
-- constraint and the fix is either correcting that row's value or
-- widening the constraint in 0037 to allow it, then re-running this file.

alter table transactions validate constraint transactions_direction_check;
alter table transactions validate constraint transactions_type_check;
alter table transactions validate constraint transactions_budget_line_check;
alter table transactions validate constraint transactions_funding_check;
alter table transactions validate constraint transactions_payment_status_check;
alter table audit_log validate constraint audit_log_action_check;
alter table pending_changes validate constraint pending_changes_type_check;
