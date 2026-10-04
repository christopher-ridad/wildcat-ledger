-- Saves each debit card reconciliation round so its finishing screen (reload
-- choice, reconciliation form, receipts ZIP) can be reopened after it's
-- closed. The form's numbers are frozen when the round is reconciled
-- (form_data), since recomputing them later would drift with any card
-- activity since; the reload choice, the reload it requested, and a date of
-- last reconciliation the treasurer typed in are filled in afterwards.
-- See docs/BUSINESS_RULES.md#revisiting-the-last-reconciliation.

create table debit_card_reconciliations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  reconciled_at bigint not null,
  transaction_ids uuid[] not null,
  -- ReconciliationFormData (debitCardReconciliationForm.ts) as of reconciling.
  form_data jsonb not null,
  reload_choice text check (reload_choice in ('please-reload', 'do-not-reload')),
  reload_transaction_id uuid references transactions(id) on delete set null,
  last_reconciliation_date date,
  created_at timestamptz not null default now()
);

create index on debit_card_reconciliations (org_id, reconciled_at desc);

alter table debit_card_reconciliations enable row level security;

create policy "members can read reconciliations" on debit_card_reconciliations
  for select using (is_org_member(org_id));
create policy "managers can update reconciliations" on debit_card_reconciliations
  for update using (can_manage_org(org_id));

-- Rows are only ever created by reconcile_transactions_with_audit, and only
-- the follow-up choices can change afterwards -- never the frozen numbers or
-- which transactions were in the round.
revoke insert, update, delete on debit_card_reconciliations from anon, authenticated;
grant update (reload_choice, reload_transaction_id, last_reconciliation_date)
  on debit_card_reconciliations to authenticated;

-- Body copied from 0041_service_fees.sql's definition (the current one),
-- now also saving the round and returning it. Dropped first because the
-- parameter list changes: create or replace would leave the old two-argument
-- version alongside it.
drop function reconcile_transactions_with_audit(uuid, uuid[]);

create function reconcile_transactions_with_audit(
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

revoke all on function reconcile_transactions_with_audit(uuid, uuid[], jsonb) from public;
grant execute on function reconcile_transactions_with_audit(uuid, uuid[], jsonb) to authenticated;
