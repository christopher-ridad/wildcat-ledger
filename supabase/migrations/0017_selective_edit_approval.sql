-- Selective edit approval: only edits that actually move money or reclassify
-- the transaction (amount, type, budget line) still require the other
-- Treasurer/President's approval via pending_changes. Everything else
-- (title, date, notes, vendor info, documents, acknowledgment flags)
-- applies immediately and is recorded in the audit log as a plain 'edit' --
-- an action that already exists in AuditAction/ACTION_LABELS but was never
-- actually written, since every edit previously went through
-- request_edit -> approve regardless of what changed. Deletes are
-- unaffected -- they always require approval.
--
-- Also closes a gap found alongside this: resolve_pending_change_with_audit
-- never checked that the approver differs from the requester -- the
-- "can't approve your own change" rule was enforced only client-side.

create or replace function transaction_edit_requires_approval(
  p_before transactions,
  p_after jsonb
)
returns boolean
language sql
immutable
as $$
  select
    (p_after ->> 'amount')::numeric is distinct from p_before.amount
    or p_after ->> 'type' is distinct from p_before.type
    -- budget_line alone covers a funding-source change too, since budgetLine
    -- is derived from type+funding client-side before it ever reaches here.
    or p_after ->> 'budgetLine' is distinct from p_before.budget_line;
$$;

-- Applies an edit's full column set and the corresponding budget-delta
-- bookkeeping. Shared by the direct-apply path (no approval needed) and the
-- approve-a-pending-edit path (approval was needed) so the column list only
-- lives in one place. Not security definer -- only ever called from within
-- another security definer function that has already authorized the caller.
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
    special_pay_form_acknowledged_missing = (p_after ->> 'specialPayFormAcknowledgedMissing')::boolean
  where id = p_transaction_id
  returning * into v_after;

  if transaction_counts_toward_balance(v_before) then
    perform apply_budget_delta(p_org_id, v_before.budget_line, -transaction_signed_amount(v_before));
  end if;
  if transaction_counts_toward_balance(v_after) then
    perform apply_budget_delta(p_org_id, v_after.budget_line, transaction_signed_amount(v_after));
  end if;

  return v_after;
end;
$$;

create or replace function request_transaction_change_with_audit(
  p_org_id uuid,
  p_transaction_id uuid,
  p_type text,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before transactions;
  v_before_json jsonb;
  v_after transactions;
begin
  perform require_org_manager(p_org_id);
  if p_type not in ('edit', 'delete') then raise exception 'Invalid change type'; end if;

  select * into v_before from transactions
  where id = p_transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_before.budget_line = 'Debit Card' and v_before.reconciled_at is not null then
    raise exception 'This transaction has been reconciled and cannot be changed';
  end if;
  if p_type = 'edit' and p_after is null then raise exception 'Edited transaction is required'; end if;

  v_before_json := transaction_audit_json(v_before);

  if p_type = 'edit' and not transaction_edit_requires_approval(v_before, p_after) then
    v_after := apply_transaction_edit(p_org_id, p_transaction_id, p_after);
    perform write_ledger_audit(p_org_id, 'edit', p_transaction_id::text, v_after.title,
      v_before_json, transaction_audit_json(v_after));
    return;
  end if;

  insert into pending_changes (
    org_id, type, transaction_id, transaction_title, requested_by, requested_by_role,
    requested_at, before, after
  ) values (
    p_org_id, p_type, p_transaction_id,
    case when p_type = 'edit' then p_after ->> 'title' else v_before.title end,
    coalesce(current_email(), 'unknown'), ledger_requested_role(p_org_id), ledger_now_ms(), v_before_json, p_after
  );

  perform write_ledger_audit(p_org_id,
    case when p_type = 'edit' then 'request_edit' else 'request_delete' end,
    p_transaction_id::text, case when p_type = 'edit' then p_after ->> 'title' else v_before.title end,
    v_before_json, case when p_type = 'edit' then p_after else null end);
end;
$$;

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
  if v_before.budget_line = 'Debit Card' and v_before.reconciled_at is not null then
    raise exception 'This transaction has been reconciled and cannot be changed';
  end if;

  if v_pending.type = 'edit' then
    perform apply_transaction_edit(p_org_id, v_pending.transaction_id, v_pending.after);
  else
    delete from transactions where id = v_pending.transaction_id;
    if transaction_counts_toward_balance(v_before) then
      perform apply_budget_delta(p_org_id, v_before.budget_line, -transaction_signed_amount(v_before));
    end if;
  end if;

  delete from pending_changes where id = p_pending_id;
  perform write_ledger_audit(p_org_id, 'approve', v_pending.transaction_id::text,
    v_pending.transaction_title, v_pending.before, v_pending.after);
end;
$$;

revoke all on function transaction_edit_requires_approval(transactions, jsonb) from public;
revoke all on function apply_transaction_edit(uuid, uuid, jsonb) from public;
