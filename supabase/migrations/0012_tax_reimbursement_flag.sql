-- Debit Card purchases should never carry sales tax (orgs are tax-exempt
-- when the exemption form is presented at purchase). When it happens
-- anyway -- no exemption form submitted, and tax shows on the receipt --
-- the full amount (tax included) still posts to the Debit Card line
-- immediately, same as always, but the transaction gets flagged as owing
-- a reimbursement to SOFO. Clearing the flag is self-attested (the actual
-- payment happens on SOFO's own external CardPointe form, which this app
-- has no integration with) via a dedicated mark-reimbursed RPC, kept
-- separate from the general edit path the same way payment_status is.

alter table transactions add column if not exists tax_exempt_form_submitted boolean;
alter table transactions add column if not exists tax_amount numeric;
alter table transactions add column if not exists tax_reimbursed boolean;

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
    'reimbursedMemberName', p_transaction.reimbursed_member_name,
    'isIndividualVendor', p_transaction.is_individual_vendor,
    'isNorthwesternEmployee', p_transaction.is_northwestern_employee,
    'paymentStatus', p_transaction.payment_status,
    'taxExemptFormSubmitted', p_transaction.tax_exempt_form_submitted,
    'taxAmount', p_transaction.tax_amount,
    'taxReimbursed', p_transaction.tax_reimbursed,
    'noReceiptAcknowledged', p_transaction.no_receipt_acknowledged,
    'receiptFileUrl', p_transaction.receipt_file_url,
    'contractFileUrl', p_transaction.contract_file_url,
    'w9FileUrl', p_transaction.w9_file_url,
    'contractedServicesFileUrl', p_transaction.contracted_services_file_url,
    'conflictOfInterestFileUrl', p_transaction.conflict_of_interest_file_url,
    'specialPayFormUrl', p_transaction.special_pay_form_url,
    'exemptionFormUrl', p_transaction.exemption_form_url,
    'reconciledAt', p_transaction.reconciled_at
  );
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
    zelle_info, reimbursed_member_name, is_individual_vendor, is_northwestern_employee,
    tax_exempt_form_submitted, tax_amount,
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
    (p_transaction ->> 'taxExemptFormSubmitted')::boolean,
    (p_transaction ->> 'taxAmount')::numeric,
    (p_transaction ->> 'noReceiptAcknowledged')::boolean, p_transaction ->> 'receiptFileUrl',
    p_transaction ->> 'contractFileUrl', p_transaction ->> 'w9FileUrl',
    p_transaction ->> 'contractedServicesFileUrl', p_transaction ->> 'conflictOfInterestFileUrl',
    p_transaction ->> 'specialPayFormUrl',
    p_transaction ->> 'exemptionFormUrl', (p_transaction ->> 'reconciledAt')::bigint,
    coalesce(p_upload_tokens, '{}'::jsonb)
  ) returning * into v_transaction;

  perform apply_budget_delta(p_org_id, v_transaction.budget_line, transaction_signed_amount(v_transaction));
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
      tax_exempt_form_submitted = (v_pending.after ->> 'taxExemptFormSubmitted')::boolean,
      tax_amount = (v_pending.after ->> 'taxAmount')::numeric,
      no_receipt_acknowledged = (v_pending.after ->> 'noReceiptAcknowledged')::boolean,
      receipt_file_url = v_pending.after ->> 'receiptFileUrl', contract_file_url = v_pending.after ->> 'contractFileUrl',
      w9_file_url = v_pending.after ->> 'w9FileUrl',
      contracted_services_file_url = v_pending.after ->> 'contractedServicesFileUrl',
      conflict_of_interest_file_url = v_pending.after ->> 'conflictOfInterestFileUrl',
      special_pay_form_url = v_pending.after ->> 'specialPayFormUrl',
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

-- Self-attested "I paid this back to SOFO" -- direct, single-approver
-- update, matching update_payment_status_with_audit's reasoning: it's a
-- frequent, low-risk bookkeeping action, not a change to the transaction
-- record itself, so it doesn't need the dual-approval pending_changes flow.
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
  if v_before.type <> 'Debit card purchase' then
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

revoke all on function mark_tax_reimbursed_with_audit(uuid, uuid) from public;
grant execute on function mark_tax_reimbursed_with_audit(uuid, uuid) to authenticated;
