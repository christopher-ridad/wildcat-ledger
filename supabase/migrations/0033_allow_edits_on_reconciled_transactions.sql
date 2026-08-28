-- Reconciliation no longer permanently locks a Debit Card transaction from
-- being edited or deleted. It was the one place in the app where a
-- correction had no path at all, unlike every other transaction type/state,
-- where "can't unilaterally change it" is enforced by requiring a second
-- approver (dual-approval), not by removing the capability outright.
--
-- Reconciled transactions now go through the exact same rule as any other
-- transaction: transaction_edit_requires_approval (0017) already decides
-- whether an edit needs a second sign-off based on WHAT changed (amount/
-- type/budget line vs. everything else), regardless of reconciled status.
-- Deletes still always require approval, as before. Reconciling a
-- transaction that already has a pending request is still blocked (see
-- 0015_pending_change_blocks_reconciliation.sql, unrelated to this and
-- still worth keeping -- reconciling in the middle of an undecided change
-- would leave it unclear which version actually got confirmed).
--
-- Bodies otherwise copied verbatim from their current definitions
-- (0018_sofo_approvers.sql / 0017_selective_edit_approval.sql), minus the
-- reconciled-lock check each one had.

create or replace function request_transaction_change_with_audit(
  p_org_id uuid,
  p_transaction_id uuid,
  p_type text,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before transactions;
  v_before_json jsonb;
  v_after transactions;
begin
  perform require_org_manager(p_org_id);
  if p_type not in ('edit', 'delete') then raise exception 'Invalid change type'; end if;

  select * into v_before from transactions
  where id = p_transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if p_type = 'edit' and p_after is null then raise exception 'Edited transaction is required'; end if;

  v_before_json := transaction_audit_json(v_before);

  if p_type = 'edit' and not transaction_edit_requires_approval(v_before, p_after) then
    v_after := apply_transaction_edit(p_org_id, p_transaction_id, p_after);
    perform write_ledger_audit(p_org_id, 'edit', p_transaction_id::text, v_after.title,
      v_before_json, transaction_audit_json(v_after));
    return;
  end if;

  insert into pending_changes (
    org_id, type, transaction_id, transaction_title, requested_by,
    requested_at, before, after
  ) values (
    p_org_id, p_type, p_transaction_id,
    case when p_type = 'edit' then p_after ->> 'title' else v_before.title end,
    coalesce(current_email(), 'unknown'), ledger_now_ms(), v_before_json, p_after
  );

  perform write_ledger_audit(p_org_id,
    case when p_type = 'edit' then 'request_edit' else 'request_delete' end,
    p_transaction_id::text, case when p_type = 'edit' then p_after ->> 'title' else v_before.title end,
    v_before_json, case when p_type = 'edit' then p_after else null end);
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
  if v_pending.requested_by = coalesce(current_email(), 'unknown') then
    raise exception 'You cannot approve or reject your own pending change';
  end if;

  if not p_approved then
    delete from pending_changes where id = p_pending_id;
    perform write_ledger_audit(p_org_id, 'reject', v_pending.transaction_id::text,
      v_pending.transaction_title, v_pending.before, v_pending.after);
    return;
  end if;

  select * into v_before from transactions
  where id = v_pending.transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;

  if v_pending.type = 'edit' then
    perform apply_transaction_edit(p_org_id, v_pending.transaction_id, v_pending.after);
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
