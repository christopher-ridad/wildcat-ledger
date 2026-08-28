-- Financial tasks can now be assigned to more than one person at once,
-- replacing the single assignee_email column. No production data depends
-- on the old column yet (this feature hasn't shipped), so this is a
-- straight rename-in-shape rather than a column-preserving migration.
alter table financial_tasks add column assignee_emails text[] not null default '{}';

update financial_tasks
set assignee_emails = case
  when assignee_email is not null then array[assignee_email]
  else '{}'
end;

alter table financial_tasks drop column assignee_email;
