-- A Debit Card purchase with a pending edit or delete request shouldn't be
-- reconciled while that request is still outstanding: request_transaction_
-- change_with_audit and resolve_pending_change_with_audit both already
-- refuse to touch a reconciled Debit Card transaction, so a pending change
-- approved after the transaction had already been reconciled would fail
-- outright, leaving the approver stuck. Block reconciliation up front
-- instead, mirroring the existing receipt/tax-reimbursement blocks already
-- enforced client-side in ReconciliationModal.tsx.

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
