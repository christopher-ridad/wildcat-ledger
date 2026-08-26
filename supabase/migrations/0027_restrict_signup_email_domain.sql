-- Restricts new account creation to @u.northwestern.edu email addresses,
-- via Supabase's "Before User Created" Auth Hook. This only gates NEW
-- signups (the hook fires before a user row is inserted) -- existing
-- accounts, whatever domain they're on, are completely unaffected.
--
-- This is a companion to moving off Supabase's default/shared email
-- service (rate-limited to a couple of emails/hour, explicitly meant for
-- dev/testing only): once a real SMTP provider is configured and that
-- limit goes away, this closes the resulting abuse surface -- anyone could
-- otherwise spam the login form with arbitrary emails and burn through the
-- new provider's quota/reputation. sofo_approvers/officers already gate
-- what an authenticated-but-unlisted user can actually see or do, so this
-- isn't a second permissions layer -- it's specifically about not letting
-- non-Northwestern addresses trigger a real outbound email at all.
--
-- Defining the function alone does not activate it -- it still needs to be
-- selected as the "Before User Created" hook in the Supabase Dashboard
-- under Authentication > Hooks.
create or replace function public.restrict_signup_to_northwestern_email(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_email text;
begin
  v_email := event -> 'user' ->> 'email';
  if v_email is null or v_email !~* '@u\.northwestern\.edu$' then
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

-- The Dashboard's Auth Hooks setting auto-grants supabase_auth_admin
-- execute access once this is selected as the active hook, but doing it
-- explicitly here (and locking everyone else out) means it can't be
-- invoked through the Data API by an ordinary client -- same pattern as
-- the other security-definer functions in this project.
grant execute on function public.restrict_signup_to_northwestern_email(jsonb) to supabase_auth_admin;
revoke execute on function public.restrict_signup_to_northwestern_email(jsonb) from public, anon, authenticated;
