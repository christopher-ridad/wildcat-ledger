-- Rename the 'Deposit' transaction type to 'Journal', matching SOFO's own
-- term for it (requested by a SOFO advisor ahead of rolling the app out to
-- more orgs). Same shape as 0013's type rename: the stored value IS the
-- display string everywhere (no separate label map), so this is a plain
-- data UPDATE against every existing row, plus redefining the two RPCs that
-- branch on the old literal string.
--
-- transactions_restrict_member_updates (0001_init.sql) fires on every
-- UPDATE and only allows non-managers to touch exemption_form_url; it
-- checks can_manage_org() via auth.jwt(), which has no value when this runs
-- as a raw SQL Editor script (no request-scoped JWT), so it would otherwise
-- block this bulk rename. Safe to disable/re-enable around it since this
-- whole script runs as the table owner in one transaction -- see 0013 for
-- the same pattern.

alter table transactions disable trigger transactions_restrict_member_updates;

update transactions set type = 'Journal' where type = 'Deposit';

alter table transactions enable trigger transactions_restrict_member_updates;

-- Body copied verbatim from 0013_transaction_type_rename.sql's definition
-- (the current one), with 'Deposit' -> 'Journal'.
create or replace function transaction_counts_toward_balance(p_transaction transactions)
returns boolean
language sql
immutable
as $$
  select not (
    p_transaction.type in ('Payment Request', 'Non-Officer Reimbursement', 'Payment to NU Employee')
    or (p_transaction.type = 'Journal' and p_transaction.budget_line = 'Debit Card')
  ) or p_transaction.payment_status = 'Paid';
$$;

-- Body copied verbatim from 0014_missing_document_flags.sql's definition
-- (the current one), with 'Deposit' -> 'Journal'.
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
  v_missing text[];
begin
  perform require_org_manager(p_org_id);
  if p_status not in ('Pending', 'Approved', 'Paid') then
    raise exception 'Invalid payment status';
  end if;

  select * into v_before from transactions
  where id = p_transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;

  v_is_reload := v_before.type = 'Journal' and v_before.budget_line = 'Debit Card';
  if not (
    v_before.type in ('Payment Request', 'Non-Officer Reimbursement', 'Payment to NU Employee')
    or v_is_reload
  ) then
    raise exception 'Payment status only applies to Payment Request, Non-Officer Reimbursement, Payment to NU Employee, and Debit Card reload transactions';
  end if;
  if v_is_reload and p_status = 'Approved' then
    raise exception 'Reload journals only support Pending or Paid status';
  end if;

  if p_status in ('Approved', 'Paid') then
    v_missing := array_remove(array[
      case when v_before.type in ('Payment Request', 'Payment to NU Employee')
        and v_before.contract_file_url is null then 'RSO Agreement' end,
      case when v_before.type in ('Payment Request', 'Payment to NU Employee')
        and v_before.w9_file_url is null then 'W-9' end,
      case when v_before.type = 'Payment Request' and v_before.is_individual_vendor
        and v_before.contracted_services_file_url is null then 'Contracted Services Form' end,
      case when v_before.type = 'Payment Request' and v_before.is_individual_vendor
        and v_before.conflict_of_interest_file_url is null then 'Conflict of Interest Form' end,
      case when v_before.type = 'Payment to NU Employee'
        and v_before.special_pay_form_url is null then 'Special Pay Form' end,
      case when v_before.type = 'Non-Officer Reimbursement'
        and v_before.receipt_file_url is null then 'Receipt' end
    ], null);
    if array_length(v_missing, 1) > 0 then
      raise exception 'Cannot mark as % — missing required documents: %',
        p_status, array_to_string(v_missing, ', ');
    end if;
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
