-- Payment type + an auto-generated document-requirement checklist for
-- financial_tasks. Payment type reuses the same free-text TransactionType
-- vocabulary already used by transactions.type (no CHECK constraint here
-- either -- kept client-side-enforced for the same reason transactions.type
-- is: see SUPPORTED_TYPES in AddTransactionForm/types.ts).
--
-- Requirement rows are derived from getRequiredDocuments()
-- (documentRequirements.ts) entirely on the client. There is deliberately
-- no server-side re-derivation of "what documents does type X need" here --
-- that logic already exists in two other places (documentRequirements.ts
-- itself, and a raw SQL re-derivation inside update_payment_status_with_audit
-- for transactions, see 0030) and a third Postgres-side copy for
-- financial_tasks would make that worse, not better.

alter table financial_tasks
  add column payment_type text,
  add column is_individual_vendor boolean not null default false;

create table financial_task_requirements (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references financial_tasks(id) on delete cascade,
  -- Denormalized rather than derived via a join to financial_tasks, so RLS
  -- policies can stay the same direct is_org_member(org_id)/
  -- can_manage_org(org_id) shape used everywhere else in this schema.
  org_id uuid not null references organizations(id) on delete cascade,
  -- A DocumentTypeKey ('receipt' | 'contract' | 'w9' | 'contractedServices'
  -- | 'conflictOfInterest' | 'specialPayForm').
  key text not null,
  -- Snapshot of DocumentRequirement.label at generation time, so a later
  -- wording change in documentRequirements.ts doesn't retroactively rewrite
  -- the checklist on tasks created under the old label.
  label text not null,
  -- null = not yet done.
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, key)
);

create index on financial_task_requirements (task_id);
create index on financial_task_requirements (org_id);

alter table financial_task_requirements enable row level security;

create policy "members can read financial task requirements" on financial_task_requirements
  for select using (is_org_member(org_id));

create policy "managers can create financial task requirements" on financial_task_requirements
  for insert with check (can_manage_org(org_id));

create policy "members can update financial task requirements" on financial_task_requirements
  for update using (is_org_member(org_id));

create policy "managers can delete financial task requirements" on financial_task_requirements
  for delete using (can_manage_org(org_id));

-- Same shape as enforce_financial_task_update_columns (0030): no RPC wraps
-- this table either, managers write directly, so the bypass is
-- can_manage_org(...), not the current_user/'authenticated' trick used for
-- RPC-backed tables.
create or replace function enforce_financial_task_requirement_update_columns()
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

create trigger financial_task_requirements_restrict_member_updates
  before update on financial_task_requirements
  for each row execute function enforce_financial_task_requirement_update_columns();

grant select, insert, update, delete on financial_task_requirements to authenticated;
grant select, insert, update, delete on financial_task_requirements to service_role;

alter publication supabase_realtime add table financial_task_requirements;
alter table financial_task_requirements replica identity full;
