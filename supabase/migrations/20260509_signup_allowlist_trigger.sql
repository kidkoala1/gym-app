-- Enforce the signup allowlist with a trigger on auth.users instead of an auth hook
-- (the "Before User Created" hook is not available in every dashboard/plan).
-- Rejects creation of any account whose email is not in private.allowed_signup_emails.
-- Existing users are unaffected: the trigger only fires on INSERT.

-- Safe whether or not 20260508 was applied.
create table if not exists private.allowed_signup_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table private.allowed_signup_emails enable row level security;
revoke all on private.allowed_signup_emails from anon, authenticated;

insert into private.allowed_signup_emails (email)
select distinct lower(email) from auth.users where email is not null
on conflict do nothing;

drop function if exists public.hook_restrict_signup_to_allowlist(jsonb);

create or replace function private.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
     or not exists (
       select 1 from private.allowed_signup_emails where email = lower(new.email)
     ) then
    raise exception 'Sign-ups are invite only.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_signup_allowlist() from public, anon, authenticated;

drop trigger if exists enforce_signup_allowlist on auth.users;
create trigger enforce_signup_allowlist
  before insert on auth.users
  for each row execute function private.enforce_signup_allowlist();

-- To invite a friend, BEFORE they first sign in (also required before adding them in the dashboard):
--   insert into private.allowed_signup_emails (email) values ('friend@gmail.com');
