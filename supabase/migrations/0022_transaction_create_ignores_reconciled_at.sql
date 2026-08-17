-- Security hardening: create_transaction_with_audit has, since 0001, read
-- `reconciledAt` straight out of the client-supplied p_transaction JSON and
-- written it to reconciled_at at creation time. reconciled_at is meant to be
-- set *only* by reconcile_transactions_with_audit (manager-only, requires a
-- receipt/exemption form on every included transaction, blocks reconciling
-- while a pending change is outstanding). A member (require_org_member is
-- all this function checks -- not manager-level) could otherwise create a
-- brand-new Debit Card transaction that is already flagged reconciled, with
-- none of those checks -- and reconciled transactions are then immune to
-- request_transaction_change_with_audit's edit/delete path, so it couldn't
-- even be corrected through the normal UI afterward.
--
-- The frontend never sends reconciledAt on create (confirmed: addTransaction
-- doesn't accept or forward one), so this is a pure hardening move -- always
-- insert null regardless of what the JSON payload contains.

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
    p_transaction ->> 'exemptionFormUrl',
    null, -- reconciled_at: never trust the client; only reconcile_transactions_with_audit may set this
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
