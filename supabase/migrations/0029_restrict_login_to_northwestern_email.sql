-- migrations 0027/0028's restrict_signup_to_northwestern_email only fires
-- when Supabase is about to INSERT a brand-new auth.users row. Any account
-- that already existed before that restriction went in (leftover from
-- earlier testing, before Google OAuth even existed) never triggers an
-- insert on sign-in, so that hook never runs for it -- it can still sign
-- in, just to an app with nothing to show it (RLS still hides all real
-- org data from it). This closes that gap with Supabase's other hook
-- type, the Custom Access Token Hook, which fires on every sign-in and
-- token refresh rather than only on account creation, so it also blocks
-- pre-existing accounts.

-- Shared predicate so the allowed-email list only lives in one place.
create or replace function public.is_wildcatledger_allowed_email(v_email text)
returns boolean
language sql
immutable
as $$
  select v_email is not null
    and (v_email ~* '@u\.northwestern\.edu$' or lower(v_email) = 'christopherridad@gmail.com');
$$;

create or replace function public.restrict_signup_to_northwestern_email(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_email text;
begin
  v_email := event -> 'user' ->> 'email';
  if not public.is_wildcatledger_allowed_email(v_email) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Only @u.northwestern.edu email addresses can sign up.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

create or replace function public.restrict_login_to_northwestern_email(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_email text;
begin
  v_email := event -> 'claims' ->> 'email';
  if not public.is_wildcatledger_allowed_email(v_email) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Only @u.northwestern.edu email addresses can sign in.'
      )
    );
  end if;
  return jsonb_build_object('claims', event -> 'claims');
end;
$$;

-- Same minimal-exposure pattern as the other auth-hook functions in this
-- project: only supabase_auth_admin can invoke these, so they can't be
-- called through the Data API by an ordinary client.
revoke execute on function public.is_wildcatledger_allowed_email(text) from public, anon, authenticated;
grant execute on function public.is_wildcatledger_allowed_email(text) to supabase_auth_admin;

grant execute on function public.restrict_login_to_northwestern_email(jsonb) to supabase_auth_admin;
revoke execute on function public.restrict_login_to_northwestern_email(jsonb) from public, anon, authenticated;
