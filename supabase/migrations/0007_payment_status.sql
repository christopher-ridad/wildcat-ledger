-- Payment status tracking for Direct Payment and Reimbursement transactions:
-- Pending -> Approved -> Paid. Distinct from pending_changes, which governs
-- edits/deletes to the transaction record itself, not its real-world
-- fulfillment status. Debit Card purchases use reconciled_at instead;
-- Deposits don't need a status.

alter table transactions add column if not exists payment_status text default 'Pending';

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
    'isNorthwesternEmployee', p_transaction.is_northwestern_employee,
    'paymentStatus', p_transaction.payment_status,
    'noReceiptAcknowledged', p_transaction.no_receipt_acknowledged,
    'receiptFileUrl', p_transaction.receipt_file_url,
    'contractFileUrl', p_transaction.contract_file_url,
    'w9FileUrl', p_transaction.w9_file_url,
    'contractedServicesFileUrl', p_transaction.contracted_services_file_url,
    'conflictOfInterestFileUrl', p_transaction.conflict_of_interest_file_url,
    'specialPayFormUrl', p_transaction.special_pay_form_url,
    'exemptionFormUrl', p_transaction.exemption_form_url,
    'reconciledAt', p_transaction.reconciled_at
  );
$$;

-- Direct, single-approver update (unlike editing a transaction's other
-- fields, which requires a second Treasurer/President to approve via
-- pending_changes) -- status changes are frequent and low-risk enough that
-- requiring dual sign-off would just be friction.
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
  if v_before.type not in ('Direct payment', 'Reimbursement') then
    raise exception 'Payment status only applies to Direct Payment and Reimbursement transactions';
  end if;

  update transactions set payment_status = p_status
  where id = p_transaction_id
  returning * into v_after;

  perform write_ledger_audit(p_org_id, 'payment_status_change', v_after.id::text, v_after.title,
    transaction_audit_json(v_before), transaction_audit_json(v_after));
end;
$$;

revoke all on function update_payment_status_with_audit(uuid, uuid, text) from public;
grant execute on function update_payment_status_with_audit(uuid, uuid, text) to authenticated;
