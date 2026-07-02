-- WildcatLedger schema, replacing Firestore collections under /clubs/{clubId}.

create extension if not exists pgcrypto;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  admins text[] not null default '{}',
  treasurer text[] not null default '{}',
  president text[] not null default '{}',
  officers text[] not null default '{}',
  budget_allocations jsonb not null default '{"ASG":0,"Operating":0,"Gifts":0,"Debit Card":0}'::jsonb,
  is_budget_lines_set boolean not null default false,
  last_reconciliation_date bigint
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  date date,
  amount numeric not null,
  direction text not null,
  type text not null,
  funding text,
  budget_line text not null,
  notes text not null default '',
  zelle_info text,
  is_individual_vendor boolean,
  no_receipt_acknowledged boolean,
  receipt_file_url text,
  contract_file_url text,
  w9_file_url text,
  contracted_services_file_url text,
  conflict_of_interest_file_url text,
  exemption_form_url text,
  reconciled_at bigint,
  upload_tokens jsonb not null default '{}'::jsonb
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  action text not null,
  performed_by text not null,
  "timestamp" bigint not null,
  transaction_id text not null,
  transaction_title text not null,
  before jsonb,
  after jsonb,
  reconciliation_summary jsonb,
  reload_amount numeric
);

create table pending_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type text not null,
  transaction_id uuid not null references transactions(id) on delete cascade,
  transaction_title text not null,
  requested_by text not null,
  requested_by_role text not null,
  requested_at bigint not null,
  before jsonb not null,
  after jsonb
);

create table reload_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  amount numeric not null,
  requested_by text not null,
  requested_at bigint not null,
  reconciled_total numeric not null,
  transaction_count integer not null
);

create index on transactions (org_id);
create index on audit_log (org_id);
create index on pending_changes (org_id);
create index on reload_requests (org_id);

-- ── Membership helpers, mirroring firestore.rules' isMemberOfClub/canManageClub ──

create or replace function current_email()
returns text
language sql stable
as $$
  select auth.jwt() ->> 'email';
$$;

create or replace function can_manage_org(p_org_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from organizations o
    where o.id = p_org_id
      and current_email() = any (o.admins || o.treasurer || o.president)
  );
$$;

create or replace function is_org_member(p_org_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from organizations o
    where o.id = p_org_id
      and current_email() = any (o.admins || o.treasurer || o.president || o.officers)
  );
$$;

-- Storage policies parse the org ID out of an object path as text. Looking
-- the org up and checking membership by column reference, in one EXISTS,
-- is what's proven reliable under RLS -- passing a nested scalar subquery's
-- result into is_org_member(uuid) as a bare argument is not.
create or replace function is_org_member_by_org_id_text(p_org_id_text text)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from organizations o
    where o.id::text = p_org_id_text
      and current_email() = any (o.admins || o.treasurer || o.president || o.officers)
  );
$$;

-- ── RLS ──

alter table organizations enable row level security;
alter table transactions enable row level security;
alter table audit_log enable row level security;
alter table pending_changes enable row level security;
alter table reload_requests enable row level security;

create policy "members can read their org" on organizations
  for select using (auth.role() = 'authenticated' and current_email() = any (admins || treasurer || president || officers));
create policy "managers can update their org" on organizations
  for update using (can_manage_org(id));
-- No insert policy: organizations are provisioned only by admin scripts via
-- service_role (which bypasses RLS), never by end users through the app.

create policy "members can read transactions" on transactions
  for select using (is_org_member(org_id));
create policy "members can create transactions" on transactions
  for insert with check (is_org_member(org_id));
create policy "managers can delete transactions" on transactions
  for delete using (can_manage_org(org_id));
create policy "members can update transactions" on transactions
  for update using (is_org_member(org_id));

-- Members may only ever change exemption_form_url; managers can change anything.
create or replace function enforce_transaction_update_columns()
returns trigger
language plpgsql
as $$
begin
  if can_manage_org(new.org_id) then
    return new;
  end if;
  if to_jsonb(new) - 'exemption_form_url' <> to_jsonb(old) - 'exemption_form_url' then
    raise exception 'Members may only update exemption_form_url';
  end if;
  return new;
end;
$$;

create trigger transactions_restrict_member_updates
  before update on transactions
  for each row execute function enforce_transaction_update_columns();

create policy "members can read audit log" on audit_log
  for select using (is_org_member(org_id));
create policy "members can create audit log entries" on audit_log
  for insert with check (is_org_member(org_id));

create policy "members can read pending changes" on pending_changes
  for select using (is_org_member(org_id));
create policy "managers can create pending changes" on pending_changes
  for insert with check (can_manage_org(org_id));
create policy "managers can delete pending changes" on pending_changes
  for delete using (can_manage_org(org_id));

create policy "members can read reload requests" on reload_requests
  for select using (is_org_member(org_id));
create policy "managers can create reload requests" on reload_requests
  for insert with check (can_manage_org(org_id));

-- ── Atomic budget allocation adjustment (replaces Firestore increment()) ──

create or replace function adjust_budget_allocation(p_org_id uuid, p_line text, p_delta numeric)
returns void
language sql
as $$
  update organizations
  set budget_allocations = jsonb_set(
    budget_allocations,
    array[p_line],
    to_jsonb(coalesce((budget_allocations ->> p_line)::numeric, 0) + p_delta)
  )
  where id = p_org_id;
$$;

grant execute on function adjust_budget_allocation(uuid, text, numeric) to authenticated;

-- ── Hardened document-upload-by-email-link flow ──
-- Only these columns may be written by the unauthenticated upload link, and only
-- when the caller presents the single-use token minted when the link was sent.

create or replace function submit_document_upload(
  p_org_id uuid,
  p_transaction_id uuid,
  p_field text,
  p_token text,
  p_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stored_token text;
begin
  if p_field not in (
    'receiptFileUrl', 'contractFileUrl', 'w9FileUrl',
    'contractedServicesFileUrl', 'conflictOfInterestFileUrl'
  ) then
    raise exception 'Invalid field';
  end if;

  select upload_tokens ->> (
    case p_field
      when 'receiptFileUrl' then 'receipt'
      when 'contractFileUrl' then 'contract'
      when 'w9FileUrl' then 'w9'
      when 'contractedServicesFileUrl' then 'contractedServices'
      when 'conflictOfInterestFileUrl' then 'conflictOfInterest'
    end
  ) into v_stored_token
  from transactions
  where id = p_transaction_id and org_id = p_org_id;

  if v_stored_token is null or v_stored_token <> p_token then
    raise exception 'Invalid or already-used upload link';
  end if;

  update transactions
  set
    receipt_file_url = case when p_field = 'receiptFileUrl' then p_url else receipt_file_url end,
    contract_file_url = case when p_field = 'contractFileUrl' then p_url else contract_file_url end,
    w9_file_url = case when p_field = 'w9FileUrl' then p_url else w9_file_url end,
    contracted_services_file_url = case when p_field = 'contractedServicesFileUrl' then p_url else contracted_services_file_url end,
    conflict_of_interest_file_url = case when p_field = 'conflictOfInterestFileUrl' then p_url else conflict_of_interest_file_url end,
    upload_tokens = upload_tokens - (
      case p_field
        when 'receiptFileUrl' then 'receipt'
        when 'contractFileUrl' then 'contract'
        when 'w9FileUrl' then 'w9'
        when 'contractedServicesFileUrl' then 'contractedServices'
        when 'conflictOfInterestFileUrl' then 'conflictOfInterest'
      end
    )
  where id = p_transaction_id and org_id = p_org_id;
end;
$$;

grant execute on function submit_document_upload(uuid, uuid, text, text, text) to anon, authenticated;

-- Anonymous callers need to read the transaction title and confirm it exists,
-- but nothing else — narrow read access via a definer function rather than RLS.
create or replace function get_transaction_title(p_org_id uuid, p_transaction_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select title from transactions where id = p_transaction_id and org_id = p_org_id;
$$;

grant execute on function get_transaction_title(uuid, uuid) to anon, authenticated;

-- RLS only restricts *rows*; Postgres still requires base table grants before
-- a role can attempt a query at all. authenticated needs exactly the
-- operations its policies allow; service_role bypasses RLS but still needs
-- these grants (used by admin scripts and the Firebase->Supabase migration).
grant select, update on organizations to authenticated;
grant select, insert, update, delete on transactions to authenticated;
grant select, insert on audit_log to authenticated;
grant select, insert, delete on pending_changes to authenticated;
grant select, insert on reload_requests to authenticated;

grant select, insert, update, delete on
  organizations, transactions, audit_log, pending_changes, reload_requests
to service_role;

-- LedgerContext subscribes to postgres_changes on these tables to keep the
-- UI live; tables aren't included in the realtime publication by default.
alter publication supabase_realtime add table organizations;
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table audit_log;
alter publication supabase_realtime add table pending_changes;
alter publication supabase_realtime add table reload_requests;

-- REPLICA IDENTITY FULL is required for Realtime to deliver DELETE events
-- with column data (not just the primary key). Without it, org_id filters on
-- DELETE events never match and subscriptions can't react to row removals.
alter table organizations replica identity full;
alter table transactions replica identity full;
alter table audit_log replica identity full;
alter table pending_changes replica identity full;
alter table reload_requests replica identity full;
