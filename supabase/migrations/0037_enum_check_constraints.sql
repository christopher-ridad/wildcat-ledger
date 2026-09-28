-- transactions.direction/type/budget_line/funding/payment_status,
-- audit_log.action, and pending_changes.type are all plain `text` columns
-- with no database-level constraint at all -- the TypeScript union types
-- on the client (Transaction['type'], AuditAction, etc.) were the only
-- thing keeping these to their known-valid values, and only as long as
-- every write goes through the normal client code. Neither the schema nor
-- create_transaction_with_audit (the RPC every real transaction insert
-- goes through) validates these against a whitelist, so a bug or a direct
-- RPC call bypassing the UI could silently write an unrecognized value
-- that every downstream `row.type as Transaction['type']`-style cast in
-- dbMapping.ts would then blindly trust.
--
-- Added `not valid`: enforced for every write from this point forward,
-- but does NOT scan or fail on any row already in the table, so this half
-- is safe to apply regardless of what's already there. See
-- 0038_validate_enum_check_constraints.sql for the (separate, so a
-- failure there can't undo this one) step that checks existing rows.

alter table transactions
  add constraint transactions_direction_check
  check (direction in ('Inflow', 'Outflow')) not valid;

alter table transactions
  add constraint transactions_type_check
  check (type in (
    'Non-Officer Reimbursement', 'Debit Card', 'Payment Request',
    'Payment to NU Employee', 'Journal'
  )) not valid;

alter table transactions
  add constraint transactions_budget_line_check
  check (budget_line in ('ASG', 'Operating', 'Gifts', 'Debit Card')) not valid;

alter table transactions
  add constraint transactions_funding_check
  check (funding is null or funding in ('ASG', 'Operating', 'Gifts')) not valid;

alter table transactions
  add constraint transactions_payment_status_check
  check (payment_status is null or payment_status in ('Pending', 'Approved', 'Paid'))
  not valid;

alter table audit_log
  add constraint audit_log_action_check
  check (action in (
    'create', 'edit', 'delete', 'request_edit', 'request_delete', 'approve',
    'reject', 'cancel', 'reconcile', 'payment_status_change', 'tax_reimbursed',
    'reload_request'
  )) not valid;

alter table pending_changes
  add constraint pending_changes_type_check
  check (type in ('edit', 'delete')) not valid;
