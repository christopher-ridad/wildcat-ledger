-- Existing SOFO vendors on Payment Requests. A vendor already on SOFO's
-- Existing Vendor List (tinyurl.com/ExistingVendorList) has its W-9 (and,
-- for individuals, its Contracted Services and Conflict of Interest forms)
-- on file with SOFO already, so only the RSO Agreement is needed, and the
-- SOFO Transaction Request Form just takes the vendor number from that list.
-- See docs/BUSINESS_RULES.md#existing-vendors.
--
-- Nothing here reads that list: it's a PDF behind Northwestern sign-in, so
-- the officer checks it and records the result on the transaction.

alter table transactions
  add column is_existing_vendor boolean,
  add column existing_vendor_number text;

alter table financial_tasks
  add column is_existing_vendor boolean not null default false;

-- Body copied from 0014_missing_document_flags.sql's definition (the
-- current one), plus the two new columns.
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
    'isExistingVendor', p_transaction.is_existing_vendor,
    'existingVendorNumber', p_transaction.existing_vendor_number,
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

-- Body copied from 0025_upload_token_expiry.sql's definition (the current
-- one), plus the two new columns.
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
    is_existing_vendor, existing_vendor_number, is_northwestern_employee,
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
    (p_transaction ->> 'isExistingVendor')::boolean,
    p_transaction ->> 'existingVendorNumber',
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
    (p_transaction ->> 'specialPayFormAcknowledgedMissing')::boolean
  ) returning * into v_transaction;

  if transaction_counts_toward_balance(v_transaction) then
    perform apply_budget_delta(p_org_id, v_transaction.budget_line, transaction_signed_amount(v_transaction));
  end if;
  perform write_ledger_audit(p_org_id, 'create', v_transaction.id::text, v_transaction.title,
    null, transaction_audit_json(v_transaction));
end;
$$;

-- Body copied from 0017_selective_edit_approval.sql's definition (the
-- current one), plus the two new columns.
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

-- Body copied from 0034_rename_deposit_to_journal.sql's definition (the
-- current one); an existing vendor's Payment Request now only needs the
-- RSO Agreement to reach Approved/Paid.
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

  v_needs_vendor_forms := v_before.type = 'Payment to NU Employee'
    or (v_before.type = 'Payment Request' and not coalesce(v_before.is_existing_vendor, false));

  if p_status in ('Approved', 'Paid') then
    v_missing := array_remove(array[
      case when v_before.type in ('Payment Request', 'Payment to NU Employee')
        and v_before.contract_file_url is null then 'RSO Agreement' end,
      case when v_needs_vendor_forms
        and v_before.w9_file_url is null then 'W-9' end,
      case when v_needs_vendor_forms and v_before.type = 'Payment Request'
        and v_before.is_individual_vendor
        and v_before.contracted_services_file_url is null then 'Contracted Services Form' end,
      case when v_needs_vendor_forms and v_before.type = 'Payment Request'
        and v_before.is_individual_vendor
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
