-- Missing-document flagging + post-creation document requests.
--
-- Each document requirement (contract/W-9/CSF/COI/Special Pay Form) can now
-- be satisfied at creation/edit time by an attached file OR by checking
-- "I don't have this yet" on the form, which sets a new
-- *_acknowledged_missing flag instead of silently letting a since-removed
-- "request via email" button bypass validation. Requesting a document is
-- now a standalone action (add_transaction_upload_tokens, driven from the
-- transaction's Files modal) usable any time after creation, not just
-- during the create flow.
--
-- Missing required documents now also block moving payment_status to
-- Approved or Paid (see update_payment_status_with_audit below) -- SOFO
-- won't actually pay something out without the paperwork in hand, so the
-- ledger shouldn't let it get signed off as ready either.

alter table transactions add column if not exists contract_acknowledged_missing boolean;
alter table transactions add column if not exists w9_acknowledged_missing boolean;
alter table transactions add column if not exists contracted_services_acknowledged_missing boolean;
alter table transactions add column if not exists conflict_of_interest_acknowledged_missing boolean;
alter table transactions add column if not exists special_pay_form_acknowledged_missing boolean;

-- Mints an upload token for an existing transaction so a document can be
-- requested any time after creation, not just during the create flow.
-- Manager-only: matches the current UI, where only the treasurer/president
-- can open a transaction's Files modal at all (TransactionRow only renders
-- an Actions column for canEdit).
create or replace function add_transaction_upload_tokens(
  p_org_id uuid,
  p_transaction_id uuid,
  p_tokens jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform require_org_manager(p_org_id);
  update transactions
  set upload_tokens = coalesce(upload_tokens, '{}'::jsonb) || p_tokens
  where id = p_transaction_id and org_id = p_org_id;
  if not found then raise exception 'Transaction not found'; end if;
end;
$$;

revoke all on function add_transaction_upload_tokens(uuid, uuid, jsonb) from public;
grant execute on function add_transaction_upload_tokens(uuid, uuid, jsonb) to authenticated;

-- Fixes a pre-existing gap: Special Pay Form was never wired into the
-- email-link upload flow (UploadReceiptPage's FILE_TYPE_MAP was missing
-- it too), so requesting one via email has never actually worked.
create or replace function submit_document_upload(
  p_org_id uuid,
  p_transaction_id uuid,
  p_field text,
  p_token text,
  p_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stored_token text;
begin
  if p_field not in (
    'receiptFileUrl', 'contractFileUrl', 'w9FileUrl',
    'contractedServicesFileUrl', 'conflictOfInterestFileUrl', 'specialPayFormUrl'
  ) then
    raise exception 'Invalid field';
  end if;

  select upload_tokens ->> (
    case p_field
      when 'receiptFileUrl' then 'receipt'
      when 'contractFileUrl' then 'contract'
      when 'w9FileUrl' then 'w9'
      when 'contractedServicesFileUrl' then 'contractedServices'
      when 'conflictOfInterestFileUrl' then 'conflictOfInterest'
      when 'specialPayFormUrl' then 'specialPayForm'
    end
  ) into v_stored_token
  from transactions
  where id = p_transaction_id and org_id = p_org_id;

  if v_stored_token is null or v_stored_token <> p_token then
    raise exception 'Invalid or already-used upload link';
  end if;

  update transactions
  set
    receipt_file_url = case when p_field = 'receiptFileUrl' then p_url else receipt_file_url end,
    contract_file_url = case when p_field = 'contractFileUrl' then p_url else contract_file_url end,
    w9_file_url = case when p_field = 'w9FileUrl' then p_url else w9_file_url end,
    contracted_services_file_url = case when p_field = 'contractedServicesFileUrl' then p_url else contracted_services_file_url end,
    conflict_of_interest_file_url = case when p_field = 'conflictOfInterestFileUrl' then p_url else conflict_of_interest_file_url end,
    special_pay_form_url = case when p_field = 'specialPayFormUrl' then p_url else special_pay_form_url end,
    upload_tokens = upload_tokens - (
      case p_field
        when 'receiptFileUrl' then 'receipt'
        when 'contractFileUrl' then 'contract'
        when 'w9FileUrl' then 'w9'
        when 'contractedServicesFileUrl' then 'contractedServices'
        when 'conflictOfInterestFileUrl' then 'conflictOfInterest'
        when 'specialPayFormUrl' then 'specialPayForm'
      end
    )
  where id = p_transaction_id and org_id = p_org_id;
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
    'reconciledAt', p_transaction.reconciled_at,
    'contractAcknowledgedMissing', p_transaction.contract_acknowledged_missing,
    'w9AcknowledgedMissing', p_transaction.w9_acknowledged_missing,
    'contractedServicesAcknowledgedMissing', p_transaction.contracted_services_acknowledged_missing,
    'conflictOfInterestAcknowledgedMissing', p_transaction.conflict_of_interest_acknowledged_missing,
    'specialPayFormAcknowledgedMissing', p_transaction.special_pay_form_acknowledged_missing
  );
$$;

-- ── Fix: 0012 dropped the transaction_counts_toward_balance gate on
-- create/edit/delete, so every transaction's full amount posted to the
-- budget balance immediately regardless of payment_status, instead of
-- being deferred until Paid. Restoring it here, plus inserting/updating
-- the 5 new acknowledged-missing columns.

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
    exemption_form_url, reconciled_at, upload_tokens,
    contract_acknowledged_missing, w9_acknowledged_missing,
    contracted_services_acknowledged_missing, conflict_of_interest_acknowledged_missing,
    special_pay_form_acknowledged_missing
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
    coalesce(p_upload_tokens, '{}'::jsonb),
    (p_transaction ->> 'contractAcknowledgedMissing')::boolean,
    (p_transaction ->> 'w9AcknowledgedMissing')::boolean,
    (p_transaction ->> 'contractedServicesAcknowledgedMissing')::boolean,
    (p_transaction ->> 'conflictOfInterestAcknowledgedMissing')::boolean,
    (p_transaction ->> 'specialPayFormAcknowledgedMissing')::boolean
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
      tax_exempt_form_submitted = (v_pending.after ->> 'taxExemptFormSubmitted')::boolean,
      tax_amount = (v_pending.after ->> 'taxAmount')::numeric,
      no_receipt_acknowledged = (v_pending.after ->> 'noReceiptAcknowledged')::boolean,
      receipt_file_url = v_pending.after ->> 'receiptFileUrl', contract_file_url = v_pending.after ->> 'contractFileUrl',
      w9_file_url = v_pending.after ->> 'w9FileUrl',
      contracted_services_file_url = v_pending.after ->> 'contractedServicesFileUrl',
      conflict_of_interest_file_url = v_pending.after ->> 'conflictOfInterestFileUrl',
      special_pay_form_url = v_pending.after ->> 'specialPayFormUrl',
      exemption_form_url = v_pending.after ->> 'exemptionFormUrl',
      contract_acknowledged_missing = (v_pending.after ->> 'contractAcknowledgedMissing')::boolean,
      w9_acknowledged_missing = (v_pending.after ->> 'w9AcknowledgedMissing')::boolean,
      contracted_services_acknowledged_missing = (v_pending.after ->> 'contractedServicesAcknowledgedMissing')::boolean,
      conflict_of_interest_acknowledged_missing = (v_pending.after ->> 'conflictOfInterestAcknowledgedMissing')::boolean,
      special_pay_form_acknowledged_missing = (v_pending.after ->> 'specialPayFormAcknowledgedMissing')::boolean
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

-- Adds the Approved/Paid document-completeness gate: SOFO won't actually
-- pay something out without the paperwork, so the ledger shouldn't let it
-- be signed off as ready either. Required documents mirror
-- documentRequirements.ts's getRequiredDocuments -- keep both in sync.
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

-- ── One-time correction for the 0012 regression above ──
-- Every currently-existing Payment Request / Non-Officer Reimbursement /
-- Payment to NU Employee / Debit Card reload-Deposit transaction picked up
-- exactly one extra unconditional credit/debit of its own
-- transaction_signed_amount() to its current budget_line -- whether it's
-- since been marked Paid (double-counted: once wrongly at creation, once
-- correctly at the Paid transition) or is still Pending/Approved (counted
-- now when it shouldn't be counted at all yet). Deleted transactions
-- self-cancelled (their wrongful add and later unconditional removal were
-- symmetric) and need no correction. This corrects current
-- budget_allocations directly; it does not rewrite audit_log history.
do $$
declare
  r record;
begin
  for r in
    select org_id, budget_line, sum(transaction_signed_amount(t)) as excess
    from transactions t
    where t.type in ('Payment Request', 'Non-Officer Reimbursement', 'Payment to NU Employee')
       or (t.type = 'Deposit' and t.budget_line = 'Debit Card')
    group by org_id, budget_line
  loop
    perform apply_budget_delta(r.org_id, r.budget_line, -r.excess);
  end loop;
end;
$$;
