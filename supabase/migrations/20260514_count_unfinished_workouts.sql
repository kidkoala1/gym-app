-- Workouts are often never marked finished (the user forgets to press Finish), but they are real
-- workouts. Progress and the exercise list now count any workout that has sets, finished or not.

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
    and we.canonical_exercise_name <> ''
  order by 1;
$$;

create or replace function public.get_progress_series(
  target_user_id uuid,
  target_exercise text,
  range_days integer default 90
)
returns table(bucket_date date, max_weight numeric, total_volume numeric, total_reps integer)
language sql
security definer
set search_path to 'public'
as $$
  with allowed as (
    select 1
    where auth.uid() = target_user_id
       or exists (
         select 1
         from public.profiles p
         where p.id = target_user_id
           and p.is_progress_public = true
       )
  )
  select
    date_trunc('day', w.started_at)::date as bucket_date,
    max(ws.weight_kg)::numeric as max_weight,
    sum(ws.reps * ws.weight_kg)::numeric as total_volume,
    sum(ws.reps)::int as total_reps
  from public.workouts w
  join public.workout_exercises we on we.workout_id = w.id
  join public.workout_sets ws on ws.workout_exercise_id = we.id
  where exists (select 1 from allowed)
    and w.user_id = target_user_id
    and we.canonical_exercise_name = private.lookup_canonical_exercise_name(target_exercise)
    and (
      range_days is null
      or w.started_at >= now() - make_interval(days => greatest(range_days, 1))
    )
  group by 1
  order by 1;
$$;
