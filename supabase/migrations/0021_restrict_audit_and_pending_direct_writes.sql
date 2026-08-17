-- Security hardening: audit_log and pending_changes both had RLS INSERT
-- policies checking only org membership/manager status -- not that the
-- client-supplied identity fields (performed_by, requested_by) actually
-- matched the caller. Both tables are, in practice, only ever written by the
-- SECURITY DEFINER functions write_ledger_audit() and
-- request_transaction_change_with_audit(), which both force performed_by /
-- requested_by to current_email() themselves. The direct-insert RLS
-- policies were leftover permissiveness predating those RPCs, and let any
-- member/manager:
--   - forge audit_log entries (any action/before/after, attributed to any
--     email) via a raw PostgREST insert, undermining the audit trail's
--     value as a record of what actually happened;
--   - insert a pending_changes row with requested_by spoofed to a
--     colleague's email, then approve it themselves via
--     resolve_pending_change_with_audit -- fully defeating that function's
--     "you cannot approve your own pending change" check (0017), since it
--     only compares against whatever requested_by happens to say.
--
-- pending_changes' direct DELETE policy has the same issue in reverse: the
-- only legitimate deletes happen inside resolve_pending_change_with_audit /
-- cancel_pending_change_with_audit (both SECURITY DEFINER, both write an
-- audit entry first) -- a direct delete lets a manager destroy a pending
-- request with no trace.
--
-- None of these direct paths are used by the app (confirmed: it only ever
-- calls the RPCs), so revoking them is a pure hardening move, not a
-- behavior change.

drop policy "members can create audit log entries" on audit_log;
revoke insert on audit_log from authenticated;

drop policy "managers can create pending changes" on pending_changes;
drop policy "managers can delete pending changes" on pending_changes;
revoke insert, delete on pending_changes from authenticated;
