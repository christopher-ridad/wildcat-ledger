-- Debit card reloads skip the "Approved" middle state -- approving a reload
-- IS reloading it, there's no separate paid-out step the way there is for
-- Direct Payment/Reimbursement. Reload deposits only ever go Pending -> Paid
-- (rendered as "Reloaded" client-side).

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
begin
  perform require_org_manager(p_org_id);
  if p_status not in ('Pending', 'Approved', 'Paid') then
    raise exception 'Invalid payment status';
  end if;

  select * into v_before from transactions
  where id = p_transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;

  v_is_reload := v_before.type = 'Deposit' and v_before.budget_line = 'Debit Card';
  if not (v_before.type in ('Direct payment', 'Reimbursement') or v_is_reload) then
    raise exception 'Payment status only applies to Direct Payment, Reimbursement, and Debit Card reload transactions';
  end if;
  if v_is_reload and p_status = 'Approved' then
    raise exception 'Reload deposits only support Pending or Paid status';
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
