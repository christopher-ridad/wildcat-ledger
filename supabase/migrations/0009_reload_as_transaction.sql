-- Debit card reloads are now created as real transactions (type 'Deposit',
-- budget_line 'Debit Card') instead of the separate reload_requests log --
-- see #49. Since regular Deposits can only ever have budget_line 'Debit
-- Card' via this reload path (the funding options a Deposit can otherwise
-- take -- ASG/Operating/Gifts -- never produce that budget line), a Deposit
-- on the Debit Card line unambiguously means "reload."
--
-- Reloads go through the same Pending -> Approved -> Paid lifecycle as
-- Direct Payment/Reimbursement, and likewise only count toward the budget
-- balance once Paid (the money hasn't actually landed on the card yet while
-- pending). Debit Card purchases are unaffected -- that money already moved.

create or replace function transaction_counts_toward_balance(p_transaction transactions)
returns boolean
language sql
immutable
as $$
  select not (
    p_transaction.type in ('Direct payment', 'Reimbursement')
    or (p_transaction.type = 'Deposit' and p_transaction.budget_line = 'Debit Card')
  ) or p_transaction.payment_status = 'Paid';
$$;

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
begin
  perform require_org_manager(p_org_id);
  if p_status not in ('Pending', 'Approved', 'Paid') then
    raise exception 'Invalid payment status';
  end if;

  select * into v_before from transactions
  where id = p_transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if not (
    v_before.type in ('Direct payment', 'Reimbursement')
    or (v_before.type = 'Deposit' and v_before.budget_line = 'Debit Card')
  ) then
    raise exception 'Payment status only applies to Direct Payment, Reimbursement, and Debit Card reload transactions';
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
