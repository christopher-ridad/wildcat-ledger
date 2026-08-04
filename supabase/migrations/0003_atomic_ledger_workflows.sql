-- Financial workflows must either fully succeed or leave no trace.  These
-- functions group the ledger write, its budget impact, and audit record into
-- one Postgres transaction (an RPC call is transactional by default).

create or replace function ledger_now_ms()
returns bigint
language sql
stable
as $$
  select floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

create or replace function require_org_member(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_org_member(p_org_id) then
    raise exception 'You are not a member of this organization';
  end if;
end;
$$;

create or replace function require_org_manager(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_manage_org(p_org_id) then
    raise exception 'You do not have permission to manage this organization';
  end if;
end;
$$;

create or replace function transaction_audit_json(p_transaction transactions)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'title', p_transaction.title,
    'date', p_transaction.date,
    'amount', p_transaction.amount,
    'direction', p_transaction.direction,
    'type', p_transaction.type,
    'funding', p_transaction.funding,
    'budgetLine', p_transaction.budget_line,
    'notes', p_transaction.notes,
    'zelleInfo', p_transaction.zelle_info,
    'isIndividualVendor', p_transaction.is_individual_vendor,
    'noReceiptAcknowledged', p_transaction.no_receipt_acknowledged,
    'receiptFileUrl', p_transaction.receipt_file_url,
    'contractFileUrl', p_transaction.contract_file_url,
    'w9FileUrl', p_transaction.w9_file_url,
    'contractedServicesFileUrl', p_transaction.contracted_services_file_url,
    'conflictOfInterestFileUrl', p_transaction.conflict_of_interest_file_url,
    'exemptionFormUrl', p_transaction.exemption_form_url,
    'reconciledAt', p_transaction.reconciled_at
  );
$$;

create or replace function write_ledger_audit(
  p_org_id uuid,
  p_action text,
  p_transaction_id text,
  p_transaction_title text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reconciliation_summary jsonb default null,
  p_reload_amount numeric default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into audit_log (
    org_id, action, performed_by, timestamp, transaction_id, transaction_title,
    before, after, reconciliation_summary, reload_amount
  ) values (
    p_org_id, p_action, coalesce(current_email(), 'unknown'), ledger_now_ms(),
    p_transaction_id, p_transaction_title, p_before, p_after,
    p_reconciliation_summary, p_reload_amount
  );
$$;

create or replace function apply_budget_delta(p_org_id uuid, p_line text, p_delta numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update organizations
  set budget_allocations = jsonb_set(
    budget_allocations,
    array[p_line],
    to_jsonb(coalesce((budget_allocations ->> p_line)::numeric, 0) + p_delta)
  )
  where id = p_org_id;
$$;

create or replace function transaction_signed_amount(p_transaction transactions)
returns numeric
language sql
immutable
as $$
  select case when p_transaction.direction = 'Inflow'
    then p_transaction.amount else -p_transaction.amount end;
$$;

create or replace function ledger_requested_role(p_org_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when current_email() = any(treasurer) or current_email() = any(admins) then 'treasurer'
    when current_email() = any(president) then 'president'
    else 'manager'
  end
  from organizations where id = p_org_id;
$$;

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
begin
  perform require_org_member(p_org_id);

  insert into transactions (
    id, org_id, title, date, amount, direction, type, funding, budget_line, notes,
    zelle_info, is_individual_vendor, no_receipt_acknowledged, receipt_file_url,
    contract_file_url, w9_file_url, contracted_services_file_url,
    conflict_of_interest_file_url, exemption_form_url, reconciled_at, upload_tokens
  ) values (
    p_transaction_id, p_org_id, p_transaction ->> 'title',
    nullif(p_transaction ->> 'date', '')::date, (p_transaction ->> 'amount')::numeric,
    p_transaction ->> 'direction', p_transaction ->> 'type', p_transaction ->> 'funding',
    p_transaction ->> 'budgetLine', coalesce(p_transaction ->> 'notes', ''),
    p_transaction ->> 'zelleInfo', (p_transaction ->> 'isIndividualVendor')::boolean,
    (p_transaction ->> 'noReceiptAcknowledged')::boolean, p_transaction ->> 'receiptFileUrl',
    p_transaction ->> 'contractFileUrl', p_transaction ->> 'w9FileUrl',
    p_transaction ->> 'contractedServicesFileUrl', p_transaction ->> 'conflictOfInterestFileUrl',
    p_transaction ->> 'exemptionFormUrl', (p_transaction ->> 'reconciledAt')::bigint,
    coalesce(p_upload_tokens, '{}'::jsonb)
  ) returning * into v_transaction;

  perform apply_budget_delta(p_org_id, v_transaction.budget_line, transaction_signed_amount(v_transaction));
  perform write_ledger_audit(p_org_id, 'create', v_transaction.id::text, v_transaction.title,
    null, transaction_audit_json(v_transaction));
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
    update transactions set
      title = v_pending.after ->> 'title', date = nullif(v_pending.after ->> 'date', '')::date,
      amount = (v_pending.after ->> 'amount')::numeric, direction = v_pending.after ->> 'direction',
      type = v_pending.after ->> 'type', funding = v_pending.after ->> 'funding',
      budget_line = v_pending.after ->> 'budgetLine', notes = coalesce(v_pending.after ->> 'notes', ''),
      zelle_info = v_pending.after ->> 'zelleInfo',
      is_individual_vendor = (v_pending.after ->> 'isIndividualVendor')::boolean,
      no_receipt_acknowledged = (v_pending.after ->> 'noReceiptAcknowledged')::boolean,
      receipt_file_url = v_pending.after ->> 'receiptFileUrl', contract_file_url = v_pending.after ->> 'contractFileUrl',
      w9_file_url = v_pending.after ->> 'w9FileUrl',
      contracted_services_file_url = v_pending.after ->> 'contractedServicesFileUrl',
      conflict_of_interest_file_url = v_pending.after ->> 'conflictOfInterestFileUrl',
      exemption_form_url = v_pending.after ->> 'exemptionFormUrl'
    where id = v_pending.transaction_id
    returning * into v_after;
    perform apply_budget_delta(p_org_id, v_before.budget_line, -transaction_signed_amount(v_before));
    perform apply_budget_delta(p_org_id, v_after.budget_line, transaction_signed_amount(v_after));
  else
    delete from transactions where id = v_pending.transaction_id;
    perform apply_budget_delta(p_org_id, v_before.budget_line, -transaction_signed_amount(v_before));
  end if;

  delete from pending_changes where id = p_pending_id;
  perform write_ledger_audit(p_org_id, 'approve', v_pending.transaction_id::text,
    v_pending.transaction_title, v_pending.before, v_pending.after);
end;
$$;

create or replace function cancel_pending_change_with_audit(p_org_id uuid, p_pending_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_pending pending_changes;
begin
  perform require_org_manager(p_org_id);
  select * into v_pending from pending_changes
  where id = p_pending_id and org_id = p_org_id for update;
  if not found then raise exception 'Pending change not found'; end if;
  delete from pending_changes where id = p_pending_id;
  perform write_ledger_audit(p_org_id, 'cancel', v_pending.transaction_id::text,
    v_pending.transaction_title, v_pending.before, v_pending.after);
end;
$$;

create or replace function reconcile_transactions_with_audit(p_org_id uuid, p_transaction_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_total numeric;
  v_exemption_count integer;
  v_now bigint := ledger_now_ms();
begin
  perform require_org_manager(p_org_id);
  if coalesce(cardinality(p_transaction_ids), 0) = 0 then
    raise exception 'Select at least one transaction to reconcile';
  end if;
  perform 1 from transactions
  where org_id = p_org_id and id = any(p_transaction_ids)
    and budget_line = 'Debit Card' and reconciled_at is null
  for update;
  select count(*), coalesce(sum(case when direction = 'Outflow' then amount else 0 end), 0),
    count(*) filter (where exemption_form_url is not null)
  into v_count, v_total, v_exemption_count
  from transactions
  where org_id = p_org_id and id = any(p_transaction_ids)
    and budget_line = 'Debit Card' and reconciled_at is null;
  if v_count <> cardinality(p_transaction_ids) then
    raise exception 'One or more transactions cannot be reconciled';
  end if;
  if exists (select 1 from transactions where org_id = p_org_id and id = any(p_transaction_ids)
    and receipt_file_url is null and exemption_form_url is null) then
    raise exception 'Every reconciled transaction needs a receipt or exemption form';
  end if;
  update transactions set reconciled_at = v_now where org_id = p_org_id and id = any(p_transaction_ids);
  update organizations set last_reconciliation_date = v_now where id = p_org_id;
  perform write_ledger_audit(p_org_id, 'reconcile', '',
    v_count::text || ' transaction' || case when v_count <> 1 then 's' else '' end || ' reconciled',
    null, null, jsonb_build_object('transactionCount', v_count, 'totalAmount', v_total,
      'exemptionCount', v_exemption_count, 'transactionIds', to_jsonb(p_transaction_ids)));
end;
$$;

create or replace function request_reload_with_audit(
  p_org_id uuid, p_amount numeric, p_reconciled_total numeric, p_transaction_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform require_org_manager(p_org_id);
  insert into reload_requests (org_id, amount, requested_by, requested_at, reconciled_total, transaction_count)
  values (p_org_id, p_amount, coalesce(current_email(), 'unknown'), ledger_now_ms(),
    p_reconciled_total, p_transaction_count);
  perform write_ledger_audit(p_org_id, 'reload_request', '',
    'Reload request: $' || to_char(p_amount, 'FM999999999990.00'), null, null, null, p_amount);
end;
$$;

-- SECURITY DEFINER functions are executable by PUBLIC unless explicitly
-- revoked.  Keep helpers private and expose only the authenticated workflows.
revoke all on function ledger_now_ms() from public;
revoke all on function require_org_member(uuid) from public;
revoke all on function require_org_manager(uuid) from public;
revoke all on function transaction_audit_json(transactions) from public;
revoke all on function write_ledger_audit(uuid, text, text, text, jsonb, jsonb, jsonb, numeric) from public;
revoke all on function apply_budget_delta(uuid, text, numeric) from public;
revoke all on function transaction_signed_amount(transactions) from public;
revoke all on function ledger_requested_role(uuid) from public;
revoke all on function create_transaction_with_audit(uuid, uuid, jsonb, jsonb) from public;
revoke all on function request_transaction_change_with_audit(uuid, uuid, text, jsonb) from public;
revoke all on function resolve_pending_change_with_audit(uuid, uuid, boolean) from public;
revoke all on function cancel_pending_change_with_audit(uuid, uuid) from public;
revoke all on function reconcile_transactions_with_audit(uuid, uuid[]) from public;
revoke all on function request_reload_with_audit(uuid, numeric, numeric, integer) from public;

grant execute on function create_transaction_with_audit(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function request_transaction_change_with_audit(uuid, uuid, text, jsonb) to authenticated;
grant execute on function resolve_pending_change_with_audit(uuid, uuid, boolean) to authenticated;
grant execute on function cancel_pending_change_with_audit(uuid, uuid) to authenticated;
grant execute on function reconcile_transactions_with_audit(uuid, uuid[]) to authenticated;
grant execute on function request_reload_with_audit(uuid, numeric, numeric, integer) to authenticated;
