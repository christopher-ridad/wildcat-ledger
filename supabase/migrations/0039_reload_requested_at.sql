-- Records when each Debit Card reload was requested, so the reconciliation
-- form can tell which reconciliation rounds are back on the card.
--
-- SOFO reloads a round in full or not at all, and only ever acts on the most
-- recent reload request, which covers everything reconciled before it. So:
--   * a round reconciled before the most recent Paid reload was requested is
--     back on the card; any later round is still a "Completed
--     Reconciliation (pending reload)";
--   * an older reload request that's still Pending once a newer one exists
--     is superseded and must never be marked Paid, or the same money would
--     count twice.
-- See docs/BUSINESS_RULES.md#reloads.

alter table transactions add column reload_requested_at bigint;

-- Set by the database rather than trusted from the client, the same way
-- reconciled_at is. Kept on later edits (the column isn't part of any edit
-- payload, so an UPDATE leaves it alone).
create or replace function set_reload_requested_at()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'Journal' and new.budget_line = 'Debit Card' then
    new.reload_requested_at := coalesce(new.reload_requested_at, ledger_now_ms());
  else
    new.reload_requested_at := null;
  end if;
  return new;
end;
$$;

create trigger transactions_set_reload_requested_at
  before insert or update on transactions
  for each row execute function set_reload_requested_at();

-- Existing reloads only have a calendar date, so treat each as requested at
-- the end of that day. transactions_restrict_member_updates would block this
-- when run from the SQL Editor (no JWT) -- see 0013 for the same pattern.
alter table transactions disable trigger transactions_restrict_member_updates;

update transactions
set reload_requested_at = (extract(epoch from (date + 1)::timestamptz) * 1000)::bigint - 1
where type = 'Journal' and budget_line = 'Debit Card' and date is not null;

alter table transactions enable trigger transactions_restrict_member_updates;

-- Body copied from 0036_optional_document_storage.sql's definition (the
-- current one); a superseded reload request can no longer be marked Paid.
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
  v_needs_vendor_forms boolean;
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
  if v_is_reload and p_status = 'Paid' and exists (
    select 1 from transactions
    where org_id = p_org_id and type = 'Journal' and budget_line = 'Debit Card'
      and id <> v_before.id
      and reload_requested_at > coalesce(v_before.reload_requested_at, 0)
  ) then
    raise exception 'This reload request was replaced by a newer one, so it can''t be marked as reloaded';
  end if;

  v_needs_vendor_forms := v_before.type = 'Payment to NU Employee'
    or (v_before.type = 'Payment Request' and not coalesce(v_before.is_existing_vendor, false));

  if p_status in ('Approved', 'Paid') then
    v_missing := array_remove(array[
      case when v_before.type in ('Payment Request', 'Payment to NU Employee')
        and v_before.contract_file_url is null
        and not v_before.contract_not_stored then 'RSO Agreement' end,
      case when v_needs_vendor_forms
        and v_before.w9_file_url is null
        and not v_before.w9_not_stored then 'W-9' end,
      case when v_needs_vendor_forms and v_before.type = 'Payment Request'
        and v_before.is_individual_vendor
        and v_before.contracted_services_file_url is null
        and not v_before.contracted_services_not_stored then 'Contracted Services Form' end,
      case when v_needs_vendor_forms and v_before.type = 'Payment Request'
        and v_before.is_individual_vendor
        and v_before.conflict_of_interest_file_url is null
        and not v_before.conflict_of_interest_not_stored then 'Conflict of Interest Form' end,
      case when v_before.type = 'Payment to NU Employee'
        and v_before.special_pay_form_url is null
        and not v_before.special_pay_form_not_stored then 'Special Pay Form' end,
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
