-- Transaction type taxonomy rename + new "Payment to NU Employee" type.
--
--   'Direct payment'        -> 'Payment Request'
--   'Debit card purchase'   -> 'Debit Card'
--   'Reimbursement'         -> 'Non-Officer Reimbursement'
--   (new)                   -> 'Payment to NU Employee'
--   'Deposit'                  unchanged
--
-- The `type` column has no CHECK constraint, so this is a plain data
-- UPDATE against every existing row (all orgs), plus redefining the RPCs
-- that branch on the old literal strings. "Payment to NU Employee" was
-- split out of Direct Payment/Payment Request -- historical Payment
-- Request rows that used the old Northwestern-employee checkbox keep
-- their `is_northwestern_employee` flag and stay type = 'Payment Request';
-- this migration does not attempt to reclassify them.

update transactions set type = 'Payment Request' where type = 'Direct payment';
update transactions set type = 'Debit Card' where type = 'Debit card purchase';
update transactions set type = 'Non-Officer Reimbursement' where type = 'Reimbursement';

-- Payment to NU Employee joins Payment Request / Non-Officer Reimbursement /
-- Debit Card reload deposits as a type whose budget impact is deferred
-- until payment_status = 'Paid'.
create or replace function transaction_counts_toward_balance(p_transaction transactions)
returns boolean
language sql
immutable
as $$
  select not (
    p_transaction.type in ('Payment Request', 'Non-Officer Reimbursement', 'Payment to NU Employee')
    or (p_transaction.type = 'Deposit' and p_transaction.budget_line = 'Debit Card')
  ) or p_transaction.payment_status = 'Paid';
$$;

create or replace function update_payment_status_with_audit(
  p_org_id uuid,
  p_transaction_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before transactions;
  v_after transactions;
  v_is_reload boolean;
begin
  perform require_org_manager(p_org_id);
  if p_status not in ('Pending', 'Approved', 'Paid') then
    raise exception 'Invalid payment status';
  end if;

  select * into v_before from transactions
  where id = p_transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;

  v_is_reload := v_before.type = 'Deposit' and v_before.budget_line = 'Debit Card';
  if not (
    v_before.type in ('Payment Request', 'Non-Officer Reimbursement', 'Payment to NU Employee')
    or v_is_reload
  ) then
    raise exception 'Payment status only applies to Payment Request, Non-Officer Reimbursement, Payment to NU Employee, and Debit Card reload transactions';
  end if;
  if v_is_reload and p_status = 'Approved' then
    raise exception 'Reload deposits only support Pending or Paid status';
  end if;

  update transactions set payment_status = p_status
  where id = p_transaction_id
  returning * into v_after;

  if transaction_counts_toward_balance(v_after) and not transaction_counts_toward_balance(v_before) then
    perform apply_budget_delta(p_org_id, v_after.budget_line, transaction_signed_amount(v_after));
  elsif transaction_counts_toward_balance(v_before) and not transaction_counts_toward_balance(v_after) then
    perform apply_budget_delta(p_org_id, v_before.budget_line, -transaction_signed_amount(v_before));
  end if;

  perform write_ledger_audit(p_org_id, 'payment_status_change', v_after.id::text, v_after.title,
    transaction_audit_json(v_before), transaction_audit_json(v_after));
end;
$$;

create or replace function mark_tax_reimbursed_with_audit(
  p_org_id uuid,
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before transactions;
  v_after transactions;
begin
  perform require_org_manager(p_org_id);

  select * into v_before from transactions
  where id = p_transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_before.type <> 'Debit Card' then
    raise exception 'Only Debit Card purchases can be marked as tax-reimbursed';
  end if;
  if coalesce(v_before.tax_amount, 0) <= 0 or coalesce(v_before.tax_exempt_form_submitted, false) then
    raise exception 'This transaction was not flagged as owing a tax reimbursement';
  end if;

  update transactions set tax_reimbursed = true
  where id = p_transaction_id
  returning * into v_after;

  perform write_ledger_audit(p_org_id, 'tax_reimbursed', v_after.id::text, v_after.title,
    transaction_audit_json(v_before), transaction_audit_json(v_after));
end;
$$;
