-- Indexes on foreign keys / hot filters. RLS policies join through these tables on every row.
create index if not exists workouts_user_id_started_at_idx
  on public.workouts (user_id, started_at desc);

create index if not exists workout_exercises_workout_id_idx
  on public.workout_exercises (workout_id);

create index if not exists workout_sets_workout_exercise_id_idx
  on public.workout_sets (workout_exercise_id);

-- Input limits. NOT VALID enforces them for new/updated rows without failing on existing data;
-- run `alter table ... validate constraint ...` once existing rows are known to comply.
alter table public.exercises
  drop constraint if exists exercises_name_length,
  add constraint exercises_name_length check (char_length(name) between 1 and 100) not valid;

alter table public.workouts
  drop constraint if exists workouts_title_length,
  add constraint workouts_title_length check (title is null or char_length(title) <= 100) not valid;

alter table public.workout_exercises
  drop constraint if exists workout_exercises_name_length,
  add constraint workout_exercises_name_length check (char_length(exercise_name) between 1 and 100) not valid;

alter table public.workout_sets
  drop constraint if exists workout_sets_reps_max,
  add constraint workout_sets_reps_max check (reps <= 1000) not valid,
  drop constraint if exists workout_sets_weight_max,
  add constraint workout_sets_weight_max check (weight_kg <= 2000) not valid;

alter table public.profiles
  drop constraint if exists profiles_display_name_length,
  add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 50) not valid,
  drop constraint if exists profiles_avatar_url_https,
  add constraint profiles_avatar_url_https check (
    avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~* '^https://')
  ) not valid;

-- Lock down the anon role. The app requires sign-in, so anonymous callers need no access.
-- Previously anon could call get_progress_series / search_public_profiles and read every
-- public user's progress without logging in, and had write grants on the data tables.
revoke execute on function public.get_progress_series(uuid, text, integer) from anon;
revoke execute on function public.search_public_profiles(text) from anon;
revoke execute on function public.handle_new_user_profile() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
revoke all on table public.workouts, public.workout_exercises, public.workout_sets,
  public.exercises, public.profiles from anon;

-- Pin search_path on the SECURITY DEFINER helper used by RLS policies.
alter function private.user_allows_public_progress(uuid) set search_path = public;

-- RLS cleanup. The live DB had overlapping permissive policies (a catch-all "crud" policy
-- plus per-command ones, plus duplicate select policies). They are OR-ed together, so the
-- extras only cost performance. Keep one policy per command, scoped to `authenticated`,
-- and evaluate auth.uid() once per query via (select auth.uid()).

-- exercises
drop policy if exists "exercises_crud_own" on public.exercises;
drop policy if exists "exercises_select_own" on public.exercises;
drop policy if exists "exercises_insert_own" on public.exercises;
drop policy if exists "exercises_update_own" on public.exercises;
drop policy if exists "exercises_delete_own" on public.exercises;
create policy "exercises_select_own" on public.exercises for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "exercises_insert_own" on public.exercises for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "exercises_update_own" on public.exercises for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "exercises_delete_own" on public.exercises for delete to authenticated
  using ((select auth.uid()) = user_id);

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_public_or_self" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_public_or_self" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or is_progress_public = true);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- workouts
drop policy if exists "workouts_crud_own" on public.workouts;
drop policy if exists "workouts_select_own" on public.workouts;
drop policy if exists "workouts_select_policy" on public.workouts;
drop policy if exists "workouts_insert_own" on public.workouts;
drop policy if exists "workouts_update_own" on public.workouts;
drop policy if exists "workouts_delete_own" on public.workouts;
create policy "workouts_select_policy" on public.workouts for select to authenticated
  using ((select auth.uid()) = user_id or private.user_allows_public_progress(user_id));
create policy "workouts_insert_own" on public.workouts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "workouts_update_own" on public.workouts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workouts_delete_own" on public.workouts for delete to authenticated
  using ((select auth.uid()) = user_id);

-- workout_exercises
drop policy if exists "workout_exercises_crud_by_parent_workout" on public.workout_exercises;
drop policy if exists "workout_exercises_select_by_parent_workout_owner" on public.workout_exercises;
drop policy if exists "workout_exercises_select_policy" on public.workout_exercises;
drop policy if exists "workout_exercises_insert_by_parent_workout_owner" on public.workout_exercises;
drop policy if exists "workout_exercises_update_by_parent_workout_owner" on public.workout_exercises;
drop policy if exists "workout_exercises_delete_by_parent_workout_owner" on public.workout_exercises;
create policy "workout_exercises_select_policy" on public.workout_exercises for select to authenticated
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_id
      and ((select auth.uid()) = w.user_id or private.user_allows_public_progress(w.user_id))
  ));
create policy "workout_exercises_insert_by_parent_workout_owner" on public.workout_exercises
  for insert to authenticated
  with check (exists (
    select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())
  ));
create policy "workout_exercises_update_by_parent_workout_owner" on public.workout_exercises
  for update to authenticated
  using (exists (
    select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())
  ));
create policy "workout_exercises_delete_by_parent_workout_owner" on public.workout_exercises
  for delete to authenticated
  using (exists (
    select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())
  ));

-- workout_sets
drop policy if exists "workout_sets_crud_by_parent_workout" on public.workout_sets;
drop policy if exists "workout_sets_select_by_parent_workout_owner" on public.workout_sets;
drop policy if exists "workout_sets_select_policy" on public.workout_sets;
drop policy if exists "workout_sets_insert_by_parent_workout_owner" on public.workout_sets;
drop policy if exists "workout_sets_update_by_parent_workout_owner" on public.workout_sets;
drop policy if exists "workout_sets_delete_by_parent_workout_owner" on public.workout_sets;
create policy "workout_sets_select_policy" on public.workout_sets for select to authenticated
  using (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id
      and ((select auth.uid()) = w.user_id or private.user_allows_public_progress(w.user_id))
  ));
create policy "workout_sets_insert_by_parent_workout_owner" on public.workout_sets
  for insert to authenticated
  with check (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())
  ));
create policy "workout_sets_update_by_parent_workout_owner" on public.workout_sets
  for update to authenticated
  using (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())
  ));
create policy "workout_sets_delete_by_parent_workout_owner" on public.workout_sets
  for delete to authenticated
  using (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())
  ));
