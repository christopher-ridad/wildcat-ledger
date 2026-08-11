-- Only Debit Card purchases (and Deposits) hit the running budget balance
-- immediately -- that money has already moved. Direct Payment and
-- Reimbursement transactions default to payment_status 'Pending' at
-- creation and haven't actually been paid out yet, so their budget impact
-- is deferred until payment_status is set to 'Paid' (and reversed if it
-- ever moves back off 'Paid').

create or replace function transaction_counts_toward_balance(p_transaction transactions)
returns boolean
language sql
immutable
as $$
  select p_transaction.type not in ('Direct payment', 'Reimbursement')
    or p_transaction.payment_status = 'Paid';
$$;

revoke all on function transaction_counts_toward_balance(transactions) from public;

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
    zelle_info, reimbursed_member_name, is_individual_vendor, is_northwestern_employee,
    no_receipt_acknowledged, receipt_file_url, contract_file_url, w9_file_url,
    contracted_services_file_url, conflict_of_interest_file_url, special_pay_form_url,
    exemption_form_url, reconciled_at, upload_tokens
  ) values (
    p_transaction_id, p_org_id, p_transaction ->> 'title',
    nullif(p_transaction ->> 'date', '')::date, (p_transaction ->> 'amount')::numeric,
    p_transaction ->> 'direction', p_transaction ->> 'type', p_transaction ->> 'funding',
    p_transaction ->> 'budgetLine', coalesce(p_transaction ->> 'notes', ''),
    p_transaction ->> 'zelleInfo', p_transaction ->> 'reimbursedMemberName',
    (p_transaction ->> 'isIndividualVendor')::boolean,
    (p_transaction ->> 'isNorthwesternEmployee')::boolean,
    (p_transaction ->> 'noReceiptAcknowledged')::boolean, p_transaction ->> 'receiptFileUrl',
    p_transaction ->> 'contractFileUrl', p_transaction ->> 'w9FileUrl',
    p_transaction ->> 'contractedServicesFileUrl', p_transaction ->> 'conflictOfInterestFileUrl',
    p_transaction ->> 'specialPayFormUrl',
    p_transaction ->> 'exemptionFormUrl', (p_transaction ->> 'reconciledAt')::bigint,
    coalesce(p_upload_tokens, '{}'::jsonb)
  ) returning * into v_transaction;

  if transaction_counts_toward_balance(v_transaction) then
    perform apply_budget_delta(p_org_id, v_transaction.budget_line, transaction_signed_amount(v_transaction));
  end if;
  perform write_ledger_audit(p_org_id, 'create', v_transaction.id::text, v_transaction.title,
    null, transaction_audit_json(v_transaction));
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
      reimbursed_member_name = v_pending.after ->> 'reimbursedMemberName',
      is_individual_vendor = (v_pending.after ->> 'isIndividualVendor')::boolean,
      is_northwestern_employee = (v_pending.after ->> 'isNorthwesternEmployee')::boolean,
      no_receipt_acknowledged = (v_pending.after ->> 'noReceiptAcknowledged')::boolean,
      receipt_file_url = v_pending.after ->> 'receiptFileUrl', contract_file_url = v_pending.after ->> 'contractFileUrl',
      w9_file_url = v_pending.after ->> 'w9FileUrl',
      contracted_services_file_url = v_pending.after ->> 'contractedServicesFileUrl',
      conflict_of_interest_file_url = v_pending.after ->> 'conflictOfInterestFileUrl',
      special_pay_form_url = v_pending.after ->> 'specialPayFormUrl',
      exemption_form_url = v_pending.after ->> 'exemptionFormUrl'
    where id = v_pending.transaction_id
    returning * into v_after;
    if transaction_counts_toward_balance(v_before) then
      perform apply_budget_delta(p_org_id, v_before.budget_line, -transaction_signed_amount(v_before));
    end if;
    if transaction_counts_toward_balance(v_after) then
      perform apply_budget_delta(p_org_id, v_after.budget_line, transaction_signed_amount(v_after));
    end if;
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
begin
  perform require_org_manager(p_org_id);
  if p_status not in ('Pending', 'Approved', 'Paid') then
    raise exception 'Invalid payment status';
  end if;

  select * into v_before from transactions
  where id = p_transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_before.type not in ('Direct payment', 'Reimbursement') then
    raise exception 'Payment status only applies to Direct Payment and Reimbursement transactions';
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
