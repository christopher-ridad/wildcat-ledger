-- Reconciling needs the debit card's Load Balance: the reconciliation form
-- works out Total Expenditures from it, and the form's numbers are frozen when
-- the round is reconciled. The app won't let anyone start a reconciliation
-- without it; this enforces the same rule on the server so it can't be
-- bypassed. See docs/BUSINESS_RULES.md#debit-card-reconciliation.

-- Body copied from 0043_reconciliation_rounds.sql's definition (the current
-- one), refusing to reconcile until a Load Balance is set. Same signature,
-- so the existing grants carry over.
create or replace function reconcile_transactions_with_audit(
  p_org_id uuid,
  p_transaction_ids uuid[],
  p_form_data jsonb
)
returns debit_card_reconciliations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_total numeric;
  v_exemption_count integer;
  v_now bigint := ledger_now_ms();
  v_round debit_card_reconciliations;
begin
  perform require_org_manager(p_org_id);
  if coalesce((select debit_card_load_balance from organizations where id = p_org_id), 0) <= 0 then
    raise exception 'Set the debit card''s Load Balance in SOFO / CO Settings before reconciling';
  end if;
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
  insert into debit_card_reconciliations (org_id, reconciled_at, transaction_ids, form_data)
  values (p_org_id, v_now, p_transaction_ids, p_form_data)
  returning * into v_round;
  return v_round;
end;
$$;
