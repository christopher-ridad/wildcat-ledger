-- Financial tasks can now be assigned to more than one person at once,
-- replacing the single assignee_email column. Existing rows' single
-- assignee is preserved as a one-element array rather than dropped.
alter table financial_tasks add column assignee_emails text[] not null default '{}';

-- Disabled for this backfill only: enforce_financial_task_update_columns's
-- can_manage_org(...) bypass reads auth.jwt(), which is empty outside of a
-- real PostgREST request -- i.e. always, when this migration itself runs --
-- so without disabling it here, this UPDATE gets rejected by the same
-- "members may only update completed_at" guard real client requests are
-- correctly held to.
alter table financial_tasks disable trigger financial_tasks_restrict_member_updates;

update financial_tasks
set assignee_emails = case
  when assignee_email is not null then array[assignee_email]
  else '{}'
end;

alter table financial_tasks enable trigger financial_tasks_restrict_member_updates;

alter table financial_tasks drop column assignee_email;
