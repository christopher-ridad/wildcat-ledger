-- Collapses treasurer/president/admins into a single sofo_approvers list --
-- SOFO itself doesn't distinguish which manager title processed a club's
-- paperwork, just that a "SOFO Approver" (usually treasurer + president)
-- did. All three columns already granted identical permissions everywhere,
-- so this is a rename/merge, not a permissions change. officers is
-- untouched.

alter table organizations add column sofo_approvers text[] not null default '{}';

update organizations
set sofo_approvers = array(select distinct unnest(admins || treasurer || president));

create or replace function can_manage_org(p_org_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from organizations o
    where o.id = p_org_id
      and current_email() = any (o.sofo_approvers)
  );
$$;

create or replace function is_org_member(p_org_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from organizations o
    where o.id = p_org_id
      and current_email() = any (o.sofo_approvers || o.officers)
  );
$$;

create or replace function is_org_member_by_org_id_text(p_org_id_text text)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from organizations o
    where o.id::text = p_org_id_text
      and current_email() = any (o.sofo_approvers || o.officers)
  );
$$;

drop policy "members can read their org" on organizations;
create policy "members can read their org" on organizations
  for select using (auth.role() = 'authenticated' and current_email() = any (sofo_approvers || officers));

-- Only now safe to drop -- nothing left referencing them (the functions and
-- policy above were redefined against sofo_approvers first).
alter table organizations
  drop column admins,
  drop column treasurer,
  drop column president;

-- Only ever distinguished treasurer/admins from president as a label on
-- pending_changes.requested_by_role -- with one merged role there's nothing
-- left for it to say, and nothing in the app ever read that column anyway.
drop function ledger_requested_role(uuid);

alter table pending_changes drop column requested_by_role;

create or replace function request_transaction_change_with_audit(
  p_org_id uuid,
  p_transaction_id uuid,
  p_type text,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before transactions;
  v_before_json jsonb;
  v_after transactions;
begin
  perform require_org_manager(p_org_id);
  if p_type not in ('edit', 'delete') then raise exception 'Invalid change type'; end if;

  select * into v_before from transactions
  where id = p_transaction_id and org_id = p_org_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_before.budget_line = 'Debit Card' and v_before.reconciled_at is not null then
    raise exception 'This transaction has been reconciled and cannot be changed';
  end if;
  if p_type = 'edit' and p_after is null then raise exception 'Edited transaction is required'; end if;

  v_before_json := transaction_audit_json(v_before);

  if p_type = 'edit' and not transaction_edit_requires_approval(v_before, p_after) then
    v_after := apply_transaction_edit(p_org_id, p_transaction_id, p_after);
    perform write_ledger_audit(p_org_id, 'edit', p_transaction_id::text, v_after.title,
      v_before_json, transaction_audit_json(v_after));
    return;
  end if;

  insert into pending_changes (
    org_id, type, transaction_id, transaction_title, requested_by,
    requested_at, before, after
  ) values (
    p_org_id, p_type, p_transaction_id,
    case when p_type = 'edit' then p_after ->> 'title' else v_before.title end,
    coalesce(current_email(), 'unknown'), ledger_now_ms(), v_before_json, p_after
  );

  perform write_ledger_audit(p_org_id,
    case when p_type = 'edit' then 'request_edit' else 'request_delete' end,
    p_transaction_id::text, case when p_type = 'edit' then p_after ->> 'title' else v_before.title end,
    v_before_json, case when p_type = 'edit' then p_after else null end);
end;
$$;
