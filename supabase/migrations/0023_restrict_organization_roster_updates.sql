-- Security hardening: "managers can update their org" has no column
-- restriction, so any current SOFO approver can directly PATCH
-- sofo_approvers/officers -- the org's entire permission roster -- even
-- though the app's UI never exposes an edit-roster feature (roster changes
-- are only ever made by an administrator running scripts/importAdmins.mjs
-- via the service_role key). A rogue or compromised manager account could
-- add an arbitrary email to sofo_approvers to grant persistent financial
-- control of the org, or remove a co-approver, with no audit_log entry
-- recorded for it (unlike every transaction-driven change).
--
-- Mirrors enforce_transaction_update_columns' current_user approach: block
-- only the exact `authenticated` role (a live end-user REST API session) --
-- not service_role, not postgres/supabase_admin (SQL Editor or a direct
-- connection already has full superuser-equivalent control over the
-- database regardless of what this trigger does, so restricting those
-- roles would only block legitimate admin fixes without any real security
-- benefit). budget_allocations, is_budget_lines_set, and the debit-card
-- settings columns -- the ones the app's updateActiveOrganization actually
-- writes as `authenticated` -- are untouched by this check.

create or replace function enforce_organization_update_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.sofo_approvers is distinct from old.sofo_approvers
     or new.officers is distinct from old.officers then
    raise exception 'sofo_approvers/officers cannot be changed directly; contact an administrator';
  end if;
  return new;
end;
$$;

create trigger organizations_restrict_roster_updates
  before update on organizations
  for each row execute function enforce_organization_update_columns();
