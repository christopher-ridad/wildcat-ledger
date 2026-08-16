-- A small email -> display-name directory, entirely decoupled from org
-- membership and permissions. sofo_approvers/officers stay exactly as they
-- are (plain text[], still what every permission check reads) -- this
-- table only answers "whose name goes with this email" when displaying
-- approvers/officers in the UI. Keeping it separate (keyed by email, not
-- tied to array position) means a mid-year approver swap only ever touches
-- the org's email array; the new person's name is a completely independent
-- upsert, with no positional pairing to get wrong.

create table people (
  email text primary key,
  name text not null
);

alter table people enable row level security;

create policy "authenticated users can read the directory" on people
  for select using (auth.role() = 'authenticated');

grant select on people to authenticated;
grant select, insert, update, delete on people to service_role;
