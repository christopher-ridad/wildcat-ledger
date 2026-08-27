-- Ad-hoc financial to-do items for SOFO approvers to track deadlines
-- (contracts, forms, deposits, etc.) against, displayed as a timeline
-- grouped by month. A lightweight collaborative to-do list, not
-- financial-record data -- no audit log, no pending-change approval flow,
-- just direct RLS-gated CRUD (see pending_changes in 0001_init.sql for the
-- pattern this follows).

create table financial_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text,
  due_date date not null,
  assignee_email text,
  -- null = not yet done.
  completed_at timestamptz,
  created_by text not null default current_email(),
  created_at timestamptz not null default now()
);

create index on financial_tasks (org_id);

alter table financial_tasks enable row level security;

create policy "members can read financial tasks" on financial_tasks
  for select using (is_org_member(org_id));

create policy "managers can create financial tasks" on financial_tasks
  for insert with check (can_manage_org(org_id));

create policy "members can update financial tasks" on financial_tasks
  for update using (is_org_member(org_id));

create policy "managers can delete financial tasks" on financial_tasks
  for delete using (can_manage_org(org_id));

-- The update policy alone would let any officer rewrite title/due_date/
-- assignee, not just toggle completion. Unlike
-- enforce_transaction_update_columns (0020) / enforce_organization_
-- update_columns (0023), the bypass here is can_manage_org(...), not a
-- current_user/'authenticated' check -- those two exist to hide
-- SECURITY DEFINER RPCs' internal writes from a stricter direct-client
-- rule; this table has no RPC at all, so managers really do write to it
-- directly and need the bypass to apply to them specifically.
create or replace function enforce_financial_task_update_columns()
returns trigger
language plpgsql
as $$
begin
  if can_manage_org(new.org_id) then
    return new;
  end if;
  if to_jsonb(new) - 'completed_at' <> to_jsonb(old) - 'completed_at' then
    raise exception 'Members may only update completed_at';
  end if;
  return new;
end;
$$;

create trigger financial_tasks_restrict_member_updates
  before update on financial_tasks
  for each row execute function enforce_financial_task_update_columns();

grant select, insert, update, delete on financial_tasks to authenticated;
grant select, insert, update, delete on financial_tasks to service_role;

alter publication supabase_realtime add table financial_tasks;
alter table financial_tasks replica identity full;
