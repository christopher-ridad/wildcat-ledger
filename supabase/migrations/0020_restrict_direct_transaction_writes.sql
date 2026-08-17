-- Security hardening: the RLS policies on `transactions` only ever checked
-- org membership/manager status, not *which* columns were being touched or
-- *how* -- but every real guarantee this ledger makes (audit logging,
-- budget-delta bookkeeping, the dual-approval workflow for money-moving
-- edits, and the reconciled-transaction lock) is enforced only inside the
-- SECURITY DEFINER RPC functions (create_transaction_with_audit,
-- request_transaction_change_with_audit, resolve_pending_change_with_audit,
-- reconcile_transactions_with_audit). A manager (or delete's `can_manage_org`
-- check) could previously issue a raw PostgREST PATCH/DELETE against
-- /rest/v1/transactions directly, bypassing every one of those RPCs and
-- their checks entirely -- including editing an already-reconciled
-- transaction or deleting one with no audit trail and no budget reversal.
--
-- Fix:
--  1. enforce_transaction_update_columns previously let a manager change any
--     column directly (only non-managers were restricted to
--     exemption_form_url). Replace the can_manage_org(...) check with a
--     current_user check instead: SECURITY DEFINER functions execute as
--     their *owner* role (not `authenticated`), so this now restricts every
--     direct client update -- regardless of role -- to exemption_form_url
--     only, while the RPCs (which run with an elevated current_user for the
--     duration of their call, including nested non-definer helpers like
--     apply_transaction_edit) remain unaffected.
--  2. There is no legitimate direct-client delete path at all -- the only
--     real delete happens inside resolve_pending_change_with_audit. Revoke
--     the DELETE grant from `authenticated` entirely and drop the RLS
--     policy that permitted it.

create or replace function enforce_transaction_update_columns()
returns trigger
language plpgsql
as $$
begin
  -- current_user is the function's *owner* role while executing inside a
  -- SECURITY DEFINER function (and anything that function calls, even a
  -- non-definer helper like apply_transaction_edit) -- never 'authenticated'.
  -- A raw client request always executes as exactly 'authenticated'.
  if current_user <> 'authenticated' then
    return new;
  end if;
  if to_jsonb(new) - 'exemption_form_url' <> to_jsonb(old) - 'exemption_form_url' then
    raise exception 'Direct updates may only change exemption_form_url; use the appropriate action instead';
  end if;
  return new;
end;
$$;

drop policy "managers can delete transactions" on transactions;
revoke delete on transactions from authenticated;
