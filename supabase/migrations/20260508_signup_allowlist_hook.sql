-- Signup allowlist: a "Before User Created" auth hook rejects signups whose email is not listed.
-- Existing users are unaffected (the hook only runs when an account is created).
-- Enable it in the dashboard: Authentication -> Hooks -> Before User Created -> Postgres function
-- -> public.hook_restrict_signup_to_allowlist.

create table if not exists private.allowed_signup_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- Not exposed through the API: private schema, RLS on with no policies.
alter table private.allowed_signup_emails enable row level security;
revoke all on private.allowed_signup_emails from anon, authenticated;

-- Everyone who already has an account stays allowed (e.g. if they ever need to be recreated).
insert into private.allowed_signup_emails (email)
select distinct lower(email) from auth.users where email is not null
on conflict do nothing;

create or replace function public.hook_restrict_signup_to_allowlist(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_email text := lower(event -> 'user' ->> 'email');
begin
  if signup_email is not null
     and exists (select 1 from private.allowed_signup_emails where email = signup_email) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Sign-ups are invite only.',
      'http_code', 403
    )
  );
end;
$$;

-- Only the auth service may run the hook; it must not be callable through the API.
grant execute on function public.hook_restrict_signup_to_allowlist(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_to_allowlist(jsonb) from authenticated, anon, public;

-- To invite a friend, run in the SQL editor:
--   insert into private.allowed_signup_emails (email) values ('friend@gmail.com');
