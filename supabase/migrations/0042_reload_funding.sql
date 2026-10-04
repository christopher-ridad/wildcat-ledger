-- A Debit Card reload is paid for out of one of the org's other budget lines
-- (ASG, Operating, or Gifts), recorded in the reload Journal's existing
-- `funding` column. When the reload counts toward the balance (once it's
-- Paid), its money moves: added to the Debit Card line and subtracted from
-- the funding line, in the same step, and reversed together if it's
-- un-marked, edited, or deleted. Reloads from before this have no funding
-- line and only affect the Debit Card line, as before.
-- See docs/BUSINESS_RULES.md#reloads.

-- Applies (p_sign = 1) or reverses (p_sign = -1) one transaction's effect
-- on the org's budget line balances. Every balance change goes through
-- here so a funded reload always moves money on both lines.
create or replace function apply_transaction_to_balances(
  p_org_id uuid,
  p_transaction transactions,
  p_sign integer
)
returns void
language plpgsql
as $$
begin
  if not transaction_counts_toward_balance(p_transaction) then
    return;
  end if;
  perform apply_budget_delta(p_org_id, p_transaction.budget_line,
    p_sign * transaction_signed_amount(p_transaction));
  if p_transaction.type = 'Journal' and p_transaction.budget_line = 'Debit Card'
    and p_transaction.funding is not null then
    perform apply_budget_delta(p_org_id, p_transaction.funding,
      -p_sign * transaction_signed_amount(p_transaction));
  end if;
end;
$$;

-- Body copied from 0041_service_fees.sql's definition (the current one),
-- with its balance update going through apply_transaction_to_balances.
create or replace function create_transaction_with_audit(
  p_org_id uuid,
  p_transaction_id uuid,
  p_transaction jsonb,
  p_upload_tokens jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction transactions;
  v_wrapped_tokens jsonb;
begin
  perform require_org_member(p_org_id);

  select coalesce(jsonb_object_agg(
    key, jsonb_build_object('token', value, 'mintedAt', ledger_now_ms())
  ), '{}'::jsonb)
  into v_wrapped_tokens
  from jsonb_each_text(coalesce(p_upload_tokens, '{}'::jsonb));

  insert into transactions (
    id, org_id, title, date, amount, direction, type, funding, budget_line, notes,
    zelle_info, reimbursed_member_name, is_individual_vendor,
    is_existing_vendor, existing_vendor_number, is_service_fee, is_northwestern_employee,
    tax_exempt_form_submitted, tax_amount,
    no_receipt_acknowledged, receipt_file_url, contract_file_url, w9_file_url,
    contracted_services_file_url, conflict_of_interest_file_url, special_pay_form_url,
    exemption_form_url, reconciled_at, upload_tokens,
    contract_acknowledged_missing, w9_acknowledged_missing,
    contracted_services_acknowledged_missing, conflict_of_interest_acknowledged_missing,
    special_pay_form_acknowledged_missing,
    contract_not_stored, w9_not_stored, contracted_services_not_stored,
    conflict_of_interest_not_stored, special_pay_form_not_stored
  ) values (
    p_transaction_id, p_org_id, p_transaction ->> 'title',
    nullif(p_transaction ->> 'date', '')::date, (p_transaction ->> 'amount')::numeric,
    p_transaction ->> 'direction', p_transaction ->> 'type', p_transaction ->> 'funding',
    p_transaction ->> 'budgetLine', coalesce(p_transaction ->> 'notes', ''),
    p_transaction ->> 'zelleInfo', p_transaction ->> 'reimbursedMemberName',
    (p_transaction ->> 'isIndividualVendor')::boolean,
    (p_transaction ->> 'isExistingVendor')::boolean,
    p_transaction ->> 'existingVendorNumber',
    coalesce((p_transaction ->> 'isServiceFee')::boolean, false),
    (p_transaction ->> 'isNorthwesternEmployee')::boolean,
    (p_transaction ->> 'taxExemptFormSubmitted')::boolean,
    (p_transaction ->> 'taxAmount')::numeric,
    (p_transaction ->> 'noReceiptAcknowledged')::boolean, p_transaction ->> 'receiptFileUrl',
    p_transaction ->> 'contractFileUrl', p_transaction ->> 'w9FileUrl',
    p_transaction ->> 'contractedServicesFileUrl', p_transaction ->> 'conflictOfInterestFileUrl',
    p_transaction ->> 'specialPayFormUrl',
    p_transaction ->> 'exemptionFormUrl',
    null, -- reconciled_at: never trust the client; only reconcile_transactions_with_audit may set this
    v_wrapped_tokens,
    (p_transaction ->> 'contractAcknowledgedMissing')::boolean,
    (p_transaction ->> 'w9AcknowledgedMissing')::boolean,
    (p_transaction ->> 'contractedServicesAcknowledgedMissing')::boolean,
    (p_transaction ->> 'conflictOfInterestAcknowledgedMissing')::boolean,
    (p_transaction ->> 'specialPayFormAcknowledgedMissing')::boolean,
    coalesce((p_transaction ->> 'contractNotStored')::boolean, false),
    coalesce((p_transaction ->> 'w9NotStored')::boolean, false),
    coalesce((p_transaction ->> 'contractedServicesNotStored')::boolean, false),
    coalesce((p_transaction ->> 'conflictOfInterestNotStored')::boolean, false),
    coalesce((p_transaction ->> 'specialPayFormNotStored')::boolean, false)
  ) returning * into v_transaction;

  perform apply_transaction_to_balances(p_org_id, v_transaction, 1);
  perform write_ledger_audit(p_org_id, 'create', v_transaction.id::text, v_transaction.title,
    null, transaction_audit_json(v_transaction));
end;
$$;

-- Body copied from 0041_service_fees.sql's definition (the current one),
-- with its balance updates going through apply_transaction_to_balances.
create or replace function apply_transaction_edit(
  p_org_id uuid,
  p_transaction_id uuid,
  p_after jsonb
)
returns transactions
language plpgsql
as $$
declare
  v_before transactions;
  v_after transactions;
begin
  select * into v_before from transactions
  where id = p_transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;

  update transactions set
    title = p_after ->> 'title', date = nullif(p_after ->> 'date', '')::date,
    amount = (p_after ->> 'amount')::numeric, direction = p_after ->> 'direction',
    type = p_after ->> 'type', funding = p_after ->> 'funding',
    budget_line = p_after ->> 'budgetLine', notes = coalesce(p_after ->> 'notes', ''),
    zelle_info = p_after ->> 'zelleInfo',
    reimbursed_member_name = p_after ->> 'reimbursedMemberName',
    is_individual_vendor = (p_after ->> 'isIndividualVendor')::boolean,
    is_existing_vendor = (p_after ->> 'isExistingVendor')::boolean,
    existing_vendor_number = p_after ->> 'existingVendorNumber',
    is_service_fee = coalesce((p_after ->> 'isServiceFee')::boolean, false),
    is_northwestern_employee = (p_after ->> 'isNorthwesternEmployee')::boolean,
    tax_exempt_form_submitted = (p_after ->> 'taxExemptFormSubmitted')::boolean,
    tax_amount = (p_after ->> 'taxAmount')::numeric,
    no_receipt_acknowledged = (p_after ->> 'noReceiptAcknowledged')::boolean,
    receipt_file_url = p_after ->> 'receiptFileUrl', contract_file_url = p_after ->> 'contractFileUrl',
    w9_file_url = p_after ->> 'w9FileUrl',
    contracted_services_file_url = p_after ->> 'contractedServicesFileUrl',
    conflict_of_interest_file_url = p_after ->> 'conflictOfInterestFileUrl',
    special_pay_form_url = p_after ->> 'specialPayFormUrl',
    exemption_form_url = p_after ->> 'exemptionFormUrl',
    contract_acknowledged_missing = (p_after ->> 'contractAcknowledgedMissing')::boolean,
    w9_acknowledged_missing = (p_after ->> 'w9AcknowledgedMissing')::boolean,
    contracted_services_acknowledged_missing = (p_after ->> 'contractedServicesAcknowledgedMissing')::boolean,
    conflict_of_interest_acknowledged_missing = (p_after ->> 'conflictOfInterestAcknowledgedMissing')::boolean,
    special_pay_form_acknowledged_missing = (p_after ->> 'specialPayFormAcknowledgedMissing')::boolean,
    contract_not_stored = coalesce((p_after ->> 'contractNotStored')::boolean, false),
    w9_not_stored = coalesce((p_after ->> 'w9NotStored')::boolean, false),
    contracted_services_not_stored = coalesce((p_after ->> 'contractedServicesNotStored')::boolean, false),
    conflict_of_interest_not_stored = coalesce((p_after ->> 'conflictOfInterestNotStored')::boolean, false),
    special_pay_form_not_stored = coalesce((p_after ->> 'specialPayFormNotStored')::boolean, false)
  where id = p_transaction_id
  returning * into v_after;

  perform apply_transaction_to_balances(p_org_id, v_before, -1);
  perform apply_transaction_to_balances(p_org_id, v_after, 1);

  return v_after;
end;
$$;

-- Body copied from 0039_reload_requested_at.sql's definition (the current
-- one), with its balance updates going through apply_transaction_to_balances
-- and a funded reload refused if its funding line can't cover it.
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
  -- The reload's money leaves its funding line when it's marked Paid, so
  -- that line has to have it by then (funds can change after the request).
  if v_is_reload and p_status = 'Paid' and v_before.payment_status is distinct from 'Paid'
    and v_before.funding is not null
    and coalesce((select (budget_allocations ->> v_before.funding)::numeric
                  from organizations where id = p_org_id), 0) < v_before.amount then
    raise exception '% doesn''t have enough left to pay for this reload', v_before.funding;
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

  perform apply_transaction_to_balances(p_org_id, v_before, -1);
  perform apply_transaction_to_balances(p_org_id, v_after, 1);

  perform write_ledger_audit(p_org_id, 'payment_status_change', v_after.id::text, v_after.title,
    transaction_audit_json(v_before), transaction_audit_json(v_after));
end;
$$;

-- Body copied from 0033_allow_edits_on_reconciled_transactions.sql's
-- definition (the current one), with its balance update going through
-- apply_transaction_to_balances.
create or replace function resolve_pending_change_with_audit(p_org_id uuid, p_pending_id uuid, p_approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending pending_changes;
  v_before transactions;
  v_after transactions;
begin
  perform require_org_manager(p_org_id);
  select * into v_pending from pending_changes
  where id = p_pending_id and org_id = p_org_id for update;
  if not found then raise exception 'Pending change not found'; end if;
  if v_pending.requested_by = coalesce(current_email(), 'unknown') then
    raise exception 'You cannot approve or reject your own pending change';
  end if;

  if not p_approved then
    delete from pending_changes where id = p_pending_id;
    perform write_ledger_audit(p_org_id, 'reject', v_pending.transaction_id::text,
      v_pending.transaction_title, v_pending.before, v_pending.after);
    return;
  end if;

  select * into v_before from transactions
  where id = v_pending.transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;

  if v_pending.type = 'edit' then
    perform apply_transaction_edit(p_org_id, v_pending.transaction_id, v_pending.after);
  else
    delete from transactions where id = v_pending.transaction_id;
    perform apply_transaction_to_balances(p_org_id, v_before, -1);
  end if;

  delete from pending_changes where id = p_pending_id;
  perform write_ledger_audit(p_org_id, 'approve', v_pending.transaction_id::text,
    v_pending.transaction_title, v_pending.before, v_pending.after);
end;
$$;
