-- Distinct canonical exercise names the caller has logged in finished workouts.
-- Replaces downloading every workout with nested exercise rows just to build a dropdown.
-- SECURITY INVOKER: row level security still applies as the calling user.
create or replace function public.list_logged_exercise_names()
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct we.canonical_exercise_name
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id
  where w.user_id = (select auth.uid())
    and w.finished_at is not null
    and we.canonical_exercise_name <> ''
  order by 1;
$$;

revoke all on function public.list_logged_exercise_names() from public, anon;
grant execute on function public.list_logged_exercise_names() to authenticated;
