-- SOFO debit card service fees ($3 after 3 months of inactivity) are
-- recorded in the ledger when they show up on the card, so the Debit Card
-- balance stays right. They're Debit Card transactions flagged
-- is_service_fee: they need no receipt to be reconciled, and the
-- reconciliation form counts them under Service Fees instead of Authorized
-- Charges. See docs/BUSINESS_RULES.md#service-fees.

alter table transactions add column is_service_fee boolean not null default false;

-- Body copied from 0036_optional_document_storage.sql's definition (the
-- current one), plus is_service_fee.
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
    'isServiceFee', p_transaction.is_service_fee,
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
    'specialPayFormAcknowledgedMissing', p_transaction.special_pay_form_acknowledged_missing,
    'contractNotStored', p_transaction.contract_not_stored,
    'w9NotStored', p_transaction.w9_not_stored,
    'contractedServicesNotStored', p_transaction.contracted_services_not_stored,
    'conflictOfInterestNotStored', p_transaction.conflict_of_interest_not_stored,
    'specialPayFormNotStored', p_transaction.special_pay_form_not_stored
  );
$$;

-- Body copied from 0036_optional_document_storage.sql's definition (the
-- current one), plus is_service_fee.
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

  if transaction_counts_toward_balance(v_transaction) then
    perform apply_budget_delta(p_org_id, v_transaction.budget_line, transaction_signed_amount(v_transaction));
  end if;
  perform write_ledger_audit(p_org_id, 'create', v_transaction.id::text, v_transaction.title,
    null, transaction_audit_json(v_transaction));
end;
$$;

-- Body copied from 0036_optional_document_storage.sql's definition (the
-- current one), plus is_service_fee.
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

  if transaction_counts_toward_balance(v_before) then
    perform apply_budget_delta(p_org_id, v_before.budget_line, -transaction_signed_amount(v_before));
  end if;
  if transaction_counts_toward_balance(v_after) then
    perform apply_budget_delta(p_org_id, v_after.budget_line, transaction_signed_amount(v_after));
  end if;

  return v_after;
end;
$$;

-- Body copied from 0015_pending_change_blocks_reconciliation.sql's
-- definition (the current one); a service fee needs no receipt.
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
    and receipt_file_url is null and exemption_form_url is null and not is_service_fee) then
    raise exception 'Every reconciled transaction needs a receipt or exemption form';
  end if;
  if exists (select 1 from pending_changes where org_id = p_org_id and transaction_id = any(p_transaction_ids)) then
    raise exception 'One or more transactions has a pending edit or delete request awaiting approval';
  end if;
  update transactions set reconciled_at = v_now where org_id = p_org_id and id = any(p_transaction_ids);
  update organizations set last_reconciliation_date = v_now where id = p_org_id;
  perform write_ledger_audit(p_org_id, 'reconcile', '',
    v_count::text || ' transaction' || case when v_count <> 1 then 's' else '' end || ' reconciled',
    null, null, jsonb_build_object('transactionCount', v_count, 'totalAmount', v_total,
      'exemptionCount', v_exemption_count, 'transactionIds', to_jsonb(p_transaction_ids)));
end;
$$;
