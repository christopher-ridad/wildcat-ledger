-- Security hardening: upload_tokens entries were minted as bare strings with
-- no timestamp, so a token never expires -- only single-use. An old "send
-- document link" email sitting in a vendor's inbox for months remains a
-- live, unexpiring credential.
--
-- Wrap each token with a server-set mintedAt (never trust a client-supplied
-- timestamp for this) and reject submit_document_upload calls against a
-- token older than 30 days -- long enough for a vendor to respond to a
-- request, short enough to close the "forever-valid" window. Both
-- add_transaction_upload_tokens (the live path, from the Files modal) and
-- create_transaction_with_audit's p_upload_tokens (currently unused by the
-- frontend, but part of the same mechanism) now wrap tokens the same way,
-- so submit_document_upload only ever has one shape to read.

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
declare
  v_wrapped jsonb;
begin
  perform require_org_manager(p_org_id);
  select coalesce(jsonb_object_agg(
    key, jsonb_build_object('token', value, 'mintedAt', ledger_now_ms())
  ), '{}'::jsonb)
  into v_wrapped
  from jsonb_each_text(p_tokens);

  update transactions
  set upload_tokens = coalesce(upload_tokens, '{}'::jsonb) || v_wrapped
  where id = p_transaction_id and org_id = p_org_id;
  if not found then raise exception 'Transaction not found'; end if;
end;
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
  v_key text;
  v_token_entry jsonb;
  v_stored_token text;
  v_minted_at bigint;
  v_max_age_ms constant bigint := 30::bigint * 24 * 60 * 60 * 1000; -- 30 days
begin
  if p_field not in (
    'receiptFileUrl', 'contractFileUrl', 'w9FileUrl',
    'contractedServicesFileUrl', 'conflictOfInterestFileUrl', 'specialPayFormUrl'
  ) then
    raise exception 'Invalid field';
  end if;

  v_key := case p_field
    when 'receiptFileUrl' then 'receipt'
    when 'contractFileUrl' then 'contract'
    when 'w9FileUrl' then 'w9'
    when 'contractedServicesFileUrl' then 'contractedServices'
    when 'conflictOfInterestFileUrl' then 'conflictOfInterest'
    when 'specialPayFormUrl' then 'specialPayForm'
  end;

  select upload_tokens -> v_key into v_token_entry
  from transactions
  where id = p_transaction_id and org_id = p_org_id;

  v_stored_token := v_token_entry ->> 'token';
  v_minted_at := (v_token_entry ->> 'mintedAt')::bigint;

  if v_stored_token is null or v_stored_token <> p_token then
    raise exception 'Invalid or already-used upload link';
  end if;
  if v_minted_at is null or ledger_now_ms() - v_minted_at > v_max_age_ms then
    raise exception 'This upload link has expired -- ask for a new one to be sent';
  end if;

  update transactions
  set
    receipt_file_url = case when p_field = 'receiptFileUrl' then p_url else receipt_file_url end,
    contract_file_url = case when p_field = 'contractFileUrl' then p_url else contract_file_url end,
    w9_file_url = case when p_field = 'w9FileUrl' then p_url else w9_file_url end,
    contracted_services_file_url = case when p_field = 'contractedServicesFileUrl' then p_url else contracted_services_file_url end,
    conflict_of_interest_file_url = case when p_field = 'conflictOfInterestFileUrl' then p_url else conflict_of_interest_file_url end,
    special_pay_form_url = case when p_field = 'specialPayFormUrl' then p_url else special_pay_form_url end,
    upload_tokens = upload_tokens - v_key
  where id = p_transaction_id and org_id = p_org_id;
end;
$$;
