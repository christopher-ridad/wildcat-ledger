-- Lets the app owner's personal Gmail sign up alongside
-- @u.northwestern.edu accounts, purely so dual-approval flows (which need
-- two distinct accounts) can be tested without a second Northwestern
-- account. Everyone else is still restricted to @u.northwestern.edu by
-- migration 0027.
create or replace function public.restrict_signup_to_northwestern_email(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_email text;
begin
  v_email := event -> 'user' ->> 'email';
  if v_email is null then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Only @u.northwestern.edu email addresses can sign up.'
      )
    );
  end if;
  if v_email !~* '@u\.northwestern\.edu$' and lower(v_email) != 'christopherridad@gmail.com' then
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
