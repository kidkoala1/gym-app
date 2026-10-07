-- Canonical exercise names.
--
-- workout_exercises.exercise_name stays the display name the user logged. A new column,
-- canonical_exercise_name, is the normalised name used for progress grouping and compare.
-- It is derived by a trigger from private.exercise_aliases, so the app never writes it and
-- it cannot drift. Unknown names register themselves on first use (first spelling wins), so
-- case/spacing/punctuation variants of a custom name group automatically.
--
-- To merge or split names later (no app deploy needed):
--   select private.set_exercise_alias('reverse fly', 'Rear Delt Fly');
-- and to recompute everything after editing private.exercise_aliases by hand:
--   select private.recompute_canonical_exercise_names();

-- Same normalisation as toExerciseLookupKey() in defaultExercises.ts.
create or replace function private.exercise_lookup_key(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(normalize(lower(coalesce(raw, '')), nfkd), '[''’]', '', 'g'),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

create table if not exists private.exercise_aliases (
  alias_key text primary key check (alias_key <> ''),
  canonical_name text not null check (btrim(canonical_name) <> '')
);
alter table private.exercise_aliases enable row level security;
revoke all on private.exercise_aliases from anon, authenticated;

-- 1. Built-in exercise names map to themselves.
insert into private.exercise_aliases (alias_key, canonical_name)
select private.exercise_lookup_key(n), c
from (values
  ('Barbell Bench Press', 'Barbell Bench Press'),
  ('Paused Barbell Bench Press', 'Paused Barbell Bench Press'),
  ('Close-Grip Bench Press', 'Close-Grip Bench Press'),
  ('Wide-Grip Bench Press', 'Wide-Grip Bench Press'),
  ('Decline Barbell Bench Press', 'Decline Barbell Bench Press'),
  ('Smith Machine Bench Press', 'Smith Machine Bench Press'),
  ('Machine Chest Press', 'Machine Chest Press'),
  ('Plate-Loaded Chest Press', 'Plate-Loaded Chest Press'),
  ('Single-Arm Machine Chest Press', 'Single-Arm Machine Chest Press'),
  ('Incline Barbell Bench Press', 'Incline Barbell Bench Press'),
  ('Incline Dumbbell Press', 'Incline Dumbbell Press'),
  ('Incline Smith Machine Press', 'Incline Smith Machine Press'),
  ('Incline Machine Chest Press', 'Incline Machine Chest Press'),
  ('Decline Dumbbell Press', 'Decline Dumbbell Press'),
  ('Flat Dumbbell Press', 'Flat Dumbbell Press'),
  ('Neutral-Grip Dumbbell Press', 'Neutral-Grip Dumbbell Press'),
  ('Dumbbell Floor Press', 'Dumbbell Floor Press'),
  ('Guillotine Press', 'Guillotine Press'),
  ('Cable Chest Press', 'Cable Chest Press'),
  ('Standing Cable Chest Press', 'Standing Cable Chest Press'),
  ('Single-Arm Cable Chest Press', 'Single-Arm Cable Chest Press'),
  ('High-to-Low Cable Fly', 'High-to-Low Cable Fly'),
  ('Low-to-High Cable Fly', 'Low-to-High Cable Fly'),
  ('Cable Fly', 'Cable Fly'),
  ('Single-Arm Cable Fly', 'Single-Arm Cable Fly'),
  ('Pec Deck Fly', 'Pec Deck Fly'),
  ('Machine Fly', 'Machine Fly'),
  ('Dumbbell Fly', 'Dumbbell Fly'),
  ('Incline Dumbbell Fly', 'Incline Dumbbell Fly'),
  ('Decline Dumbbell Fly', 'Decline Dumbbell Fly'),
  ('Svend Press', 'Svend Press'),
  ('Push-Up', 'Push-Up'),
  ('Weighted Push-Up', 'Weighted Push-Up'),
  ('Deficit Push-Up', 'Deficit Push-Up'),
  ('Incline Push-Up', 'Incline Push-Up'),
  ('Decline Push-Up', 'Decline Push-Up'),
  ('Chest Dip', 'Chest Dip'),
  ('Weighted Dip', 'Weighted Dip'),
  ('Overhead Press', 'Overhead Press'),
  ('Seated Barbell Overhead Press', 'Seated Barbell Overhead Press'),
  ('Seated Dumbbell Overhead Press', 'Seated Dumbbell Overhead Press'),
  ('Arnold Press', 'Arnold Press'),
  ('Push Press', 'Push Press'),
  ('Behind-the-Neck Press', 'Behind-the-Neck Press'),
  ('Machine Shoulder Press', 'Machine Shoulder Press'),
  ('Smith Machine Overhead Press', 'Smith Machine Overhead Press'),
  ('Landmine Press', 'Landmine Press'),
  ('Single-Arm Landmine Press', 'Single-Arm Landmine Press'),
  ('Cable Shoulder Press', 'Cable Shoulder Press'),
  ('Dumbbell Lateral Raise', 'Dumbbell Lateral Raise'),
  ('Lateral Raise', 'Lateral Raise'),
  ('Seated Lateral Raise', 'Seated Lateral Raise'),
  ('Cable Lateral Raise', 'Cable Lateral Raise'),
  ('Single-Arm Cable Lateral Raise', 'Single-Arm Cable Lateral Raise'),
  ('Machine Lateral Raise', 'Machine Lateral Raise'),
  ('Lean-Away Lateral Raise', 'Lean-Away Lateral Raise'),
  ('Dumbbell Front Raise', 'Dumbbell Front Raise'),
  ('Cable Front Raise', 'Cable Front Raise'),
  ('Plate Front Raise', 'Plate Front Raise'),
  ('Barbell Front Raise', 'Barbell Front Raise'),
  ('Rear Delt Fly', 'Rear Delt Fly'),
  ('Reverse Pec Deck', 'Reverse Pec Deck'),
  ('Bent-Over Dumbbell Rear Delt Fly', 'Bent-Over Dumbbell Rear Delt Fly'),
  ('Cable Rear Delt Fly', 'Cable Rear Delt Fly'),
  ('Face Pull', 'Face Pull'),
  ('Upright Row', 'Upright Row'),
  ('Cable Upright Row', 'Cable Upright Row'),
  ('Barbell Shrug', 'Barbell Shrug'),
  ('Dumbbell Shrug', 'Dumbbell Shrug'),
  ('Machine Shrug', 'Machine Shrug'),
  ('Smith Machine Shrug', 'Smith Machine Shrug'),
  ('Pull-Up', 'Pull-Up'),
  ('Weighted Pull-Up', 'Weighted Pull-Up'),
  ('Assisted Pull-Up', 'Assisted Pull-Up'),
  ('Chin-Up', 'Chin-Up'),
  ('Weighted Chin-Up', 'Weighted Chin-Up'),
  ('Assisted Chin-Up', 'Assisted Chin-Up'),
  ('Neutral-Grip Pull-Up', 'Neutral-Grip Pull-Up'),
  ('Wide-Grip Pull-Up', 'Wide-Grip Pull-Up'),
  ('Close-Grip Pull-Up', 'Close-Grip Pull-Up'),
  ('Lat Pulldown', 'Lat Pulldown'),
  ('Wide-Grip Lat Pulldown', 'Wide-Grip Lat Pulldown'),
  ('Close-Grip Lat Pulldown', 'Close-Grip Lat Pulldown'),
  ('Underhand Lat Pulldown', 'Underhand Lat Pulldown'),
  ('Single-Arm Lat Pulldown', 'Single-Arm Lat Pulldown'),
  ('Machine Pulldown', 'Machine Pulldown'),
  ('Straight-Arm Pulldown', 'Straight-Arm Pulldown'),
  ('Barbell Row', 'Barbell Row'),
  ('Pendlay Row', 'Pendlay Row'),
  ('Yates Row', 'Yates Row'),
  ('Dumbbell Row', 'Dumbbell Row'),
  ('Single-Arm Dumbbell Row', 'Single-Arm Dumbbell Row'),
  ('Chest-Supported Dumbbell Row', 'Chest-Supported Dumbbell Row'),
  ('Chest-Supported T-Bar Row', 'Chest-Supported T-Bar Row'),
  ('T-Bar Row', 'T-Bar Row'),
  ('Landmine Row', 'Landmine Row'),
  ('Meadows Row', 'Meadows Row'),
  ('Seated Cable Row', 'Seated Cable Row'),
  ('Close-Grip Seated Cable Row', 'Close-Grip Seated Cable Row'),
  ('Wide-Grip Seated Cable Row', 'Wide-Grip Seated Cable Row'),
  ('Single-Arm Seated Cable Row', 'Single-Arm Seated Cable Row'),
  ('Machine Row', 'Machine Row'),
  ('Iso-Lateral Row Machine', 'Iso-Lateral Row Machine'),
  ('Hammer Strength Row', 'Hammer Strength Row'),
  ('Inverted Row', 'Inverted Row'),
  ('Rack Pull', 'Rack Pull'),
  ('Snatch-Grip Rack Pull', 'Snatch-Grip Rack Pull'),
  ('Deadlift', 'Deadlift'),
  ('Conventional Deadlift', 'Conventional Deadlift'),
  ('Sumo Deadlift', 'Sumo Deadlift'),
  ('Trap Bar Deadlift', 'Trap Bar Deadlift'),
  ('Deficit Deadlift', 'Deficit Deadlift'),
  ('Romanian Deadlift', 'Romanian Deadlift'),
  ('Dumbbell Romanian Deadlift', 'Dumbbell Romanian Deadlift'),
  ('Stiff-Leg Deadlift', 'Stiff-Leg Deadlift'),
  ('Good Morning', 'Good Morning'),
  ('Back Extension', 'Back Extension'),
  ('45 Degree Back Extension', '45 Degree Back Extension'),
  ('Reverse Hyperextension', 'Reverse Hyperextension'),
  ('Back Squat', 'Back Squat'),
  ('Front Squat', 'Front Squat'),
  ('High-Bar Back Squat', 'High-Bar Back Squat'),
  ('Low-Bar Back Squat', 'Low-Bar Back Squat'),
  ('Paused Back Squat', 'Paused Back Squat'),
  ('Box Squat', 'Box Squat'),
  ('Goblet Squat', 'Goblet Squat'),
  ('Zercher Squat', 'Zercher Squat'),
  ('Hack Squat', 'Hack Squat'),
  ('Machine Hack Squat', 'Machine Hack Squat'),
  ('Belt Squat', 'Belt Squat'),
  ('Smith Machine Squat', 'Smith Machine Squat'),
  ('Smith Machine Front Squat', 'Smith Machine Front Squat'),
  ('Safety Bar Squat', 'Safety Bar Squat'),
  ('Split Squat', 'Split Squat'),
  ('Bulgarian Split Squat', 'Bulgarian Split Squat'),
  ('Front Foot Elevated Split Squat', 'Front Foot Elevated Split Squat'),
  ('Rear Foot Elevated Split Squat', 'Rear Foot Elevated Split Squat'),
  ('Reverse Lunge', 'Reverse Lunge'),
  ('Walking Lunge', 'Walking Lunge'),
  ('Forward Lunge', 'Forward Lunge'),
  ('Lateral Lunge', 'Lateral Lunge'),
  ('Curtsy Lunge', 'Curtsy Lunge'),
  ('Dumbbell Step-Up', 'Dumbbell Step-Up'),
  ('Barbell Step-Up', 'Barbell Step-Up'),
  ('Machine Step-Up', 'Machine Step-Up'),
  ('Leg Press', 'Leg Press'),
  ('Single-Leg Leg Press', 'Single-Leg Leg Press'),
  ('Horizontal Leg Press', 'Horizontal Leg Press'),
  ('45 Degree Leg Press', '45 Degree Leg Press'),
  ('V-Squat Machine', 'V-Squat Machine'),
  ('Pendulum Squat Machine', 'Pendulum Squat Machine'),
  ('Leg Extension', 'Leg Extension'),
  ('Single-Leg Extension', 'Single-Leg Extension'),
  ('Sissy Squat', 'Sissy Squat'),
  ('Romanian Chair Squat', 'Romanian Chair Squat'),
  ('Leg Curl', 'Leg Curl'),
  ('Lying Leg Curl', 'Lying Leg Curl'),
  ('Seated Leg Curl', 'Seated Leg Curl'),
  ('Standing Leg Curl', 'Standing Leg Curl'),
  ('Single-Leg Curl', 'Single-Leg Curl'),
  ('Nordic Hamstring Curl', 'Nordic Hamstring Curl'),
  ('Glute Ham Raise', 'Glute Ham Raise'),
  ('Cable Pull-Through', 'Cable Pull-Through'),
  ('Hip Thrust', 'Hip Thrust'),
  ('Barbell Glute Bridge', 'Barbell Glute Bridge'),
  ('Single-Leg Hip Thrust', 'Single-Leg Hip Thrust'),
  ('Machine Hip Thrust', 'Machine Hip Thrust'),
  ('Smith Machine Hip Thrust', 'Smith Machine Hip Thrust'),
  ('Cable Kickback', 'Cable Kickback'),
  ('Machine Glute Kickback', 'Machine Glute Kickback'),
  ('Cable Hip Abduction', 'Cable Hip Abduction'),
  ('Machine Hip Abduction', 'Machine Hip Abduction'),
  ('Machine Hip Adduction', 'Machine Hip Adduction'),
  ('Frog Pump', 'Frog Pump'),
  ('Standing Calf Raise', 'Standing Calf Raise'),
  ('Seated Calf Raise', 'Seated Calf Raise'),
  ('Leg Press Calf Raise', 'Leg Press Calf Raise'),
  ('Smith Machine Calf Raise', 'Smith Machine Calf Raise'),
  ('Single-Leg Calf Raise', 'Single-Leg Calf Raise'),
  ('Donkey Calf Raise', 'Donkey Calf Raise'),
  ('Tibialis Raise', 'Tibialis Raise'),
  ('Machine Tibialis Raise', 'Machine Tibialis Raise'),
  ('Barbell Curl', 'Barbell Curl'),
  ('EZ Bar Curl', 'EZ Bar Curl'),
  ('Dumbbell Curl', 'Dumbbell Curl'),
  ('Alternating Dumbbell Curl', 'Alternating Dumbbell Curl'),
  ('Incline Dumbbell Curl', 'Incline Dumbbell Curl'),
  ('Spider Curl', 'Spider Curl'),
  ('Preacher Curl', 'Preacher Curl'),
  ('Machine Preacher Curl', 'Machine Preacher Curl'),
  ('Cable Curl', 'Cable Curl'),
  ('Bayesian Cable Curl', 'Bayesian Cable Curl'),
  ('High Cable Curl', 'High Cable Curl'),
  ('Reverse Curl', 'Reverse Curl'),
  ('Cable Reverse Curl', 'Cable Reverse Curl'),
  ('Drag Curl', 'Drag Curl'),
  ('Concentration Curl', 'Concentration Curl'),
  ('Hammer Curl', 'Hammer Curl'),
  ('Cross-Body Hammer Curl', 'Cross-Body Hammer Curl'),
  ('Rope Hammer Curl', 'Rope Hammer Curl'),
  ('Triceps Pushdown', 'Triceps Pushdown'),
  ('Rope Triceps Pushdown', 'Rope Triceps Pushdown'),
  ('Straight Bar Triceps Pushdown', 'Straight Bar Triceps Pushdown'),
  ('Reverse-Grip Triceps Pushdown', 'Reverse-Grip Triceps Pushdown'),
  ('Overhead Cable Triceps Extension', 'Overhead Cable Triceps Extension'),
  ('Single-Arm Cable Triceps Extension', 'Single-Arm Cable Triceps Extension'),
  ('Dumbbell Overhead Triceps Extension', 'Dumbbell Overhead Triceps Extension'),
  ('Barbell Overhead Triceps Extension', 'Barbell Overhead Triceps Extension'),
  ('Skull Crusher', 'Skull Crusher'),
  ('EZ Bar Skull Crusher', 'EZ Bar Skull Crusher'),
  ('Lying Dumbbell Triceps Extension', 'Lying Dumbbell Triceps Extension'),
  ('Close-Grip Push-Up', 'Close-Grip Push-Up'),
  ('Close-Grip Smith Machine Press', 'Close-Grip Smith Machine Press'),
  ('Machine Dip', 'Machine Dip'),
  ('Assisted Dip', 'Assisted Dip'),
  ('Wrist Curl', 'Wrist Curl'),
  ('Reverse Wrist Curl', 'Reverse Wrist Curl'),
  ('Behind-the-Back Wrist Curl', 'Behind-the-Back Wrist Curl'),
  ('Cable Wrist Curl', 'Cable Wrist Curl'),
  ('Farmer Carry', 'Farmer Carry'),
  ('Suitcase Carry', 'Suitcase Carry'),
  ('Plate Pinch Hold', 'Plate Pinch Hold'),
  ('Dead Hang', 'Dead Hang'),
  ('Weighted Dead Hang', 'Weighted Dead Hang'),
  ('Cable Crunch', 'Cable Crunch'),
  ('Machine Crunch', 'Machine Crunch'),
  ('Weighted Crunch', 'Weighted Crunch'),
  ('Decline Sit-Up', 'Decline Sit-Up'),
  ('Roman Chair Sit-Up', 'Roman Chair Sit-Up'),
  ('Ab Wheel Rollout', 'Ab Wheel Rollout'),
  ('Hanging Knee Raise', 'Hanging Knee Raise'),
  ('Hanging Leg Raise', 'Hanging Leg Raise'),
  ('Captain Chair Leg Raise', 'Captain Chair Leg Raise'),
  ('Toes to Bar', 'Toes to Bar'),
  ('Reverse Crunch', 'Reverse Crunch'),
  ('V-Up', 'V-Up'),
  ('Dead Bug', 'Dead Bug'),
  ('Bird Dog', 'Bird Dog'),
  ('Plank', 'Plank'),
  ('Weighted Plank', 'Weighted Plank'),
  ('Side Plank', 'Side Plank'),
  ('RKC Plank', 'RKC Plank'),
  ('Pallof Press', 'Pallof Press'),
  ('Cable Wood Chop', 'Cable Wood Chop'),
  ('Landmine Rotation', 'Landmine Rotation'),
  ('Russian Twist', 'Russian Twist'),
  ('Weighted Russian Twist', 'Weighted Russian Twist'),
  ('Back Extension Hold', 'Back Extension Hold'),
  ('Barbell Clean', 'Barbell Clean'),
  ('Power Clean', 'Power Clean'),
  ('Hang Clean', 'Hang Clean'),
  ('Clean and Press', 'Clean and Press'),
  ('Barbell Snatch', 'Barbell Snatch'),
  ('Kettlebell Swing', 'Kettlebell Swing'),
  ('Single-Arm Kettlebell Swing', 'Single-Arm Kettlebell Swing'),
  ('Thruster', 'Thruster'),
  ('Wall Ball', 'Wall Ball'),
  ('Battle Rope Waves', 'Battle Rope Waves'),
  ('Sled Push', 'Sled Push'),
  ('Sled Pull', 'Sled Pull'),
  ('Prowler Push', 'Prowler Push'),
  ('Rowing Machine', 'Rowing Machine'),
  ('Air Bike', 'Air Bike'),
  ('Ski Erg', 'Ski Erg'),
  ('Stair Climber', 'Stair Climber'),
  ('Treadmill Incline Walk', 'Treadmill Incline Walk'),
  ('Elliptical', 'Elliptical')
) as v(n, c)
on conflict (alias_key) do update set canonical_name = excluded.canonical_name;

-- 2. Built-in aliases (from DEFAULT_EXERCISE_ALIAS_MAP).
insert into private.exercise_aliases (alias_key, canonical_name)
select private.exercise_lookup_key(a), c
from (values
  ('bench press', 'Barbell Bench Press'),
  ('bb bench', 'Barbell Bench Press'),
  ('barbell bench', 'Barbell Bench Press'),
  ('incline bench', 'Incline Barbell Bench Press'),
  ('db incline press', 'Incline Dumbbell Press'),
  ('ohp', 'Overhead Press'),
  ('military press', 'Overhead Press'),
  ('lat raise', 'Lateral Raise'),
  ('side raise', 'Lateral Raise'),
  ('rear delt flyes', 'Rear Delt Fly'),
  ('pull up', 'Pull-Up'),
  ('chin up', 'Chin-Up'),
  ('pullups', 'Pull-Up'),
  ('chinups', 'Chin-Up'),
  ('lat pull down', 'Lat Pulldown'),
  ('pulldown', 'Lat Pulldown'),
  ('cable row', 'Seated Cable Row'),
  ('bb squat', 'Back Squat'),
  ('rdl', 'Romanian Deadlift'),
  ('trap deadlift', 'Trap Bar Deadlift'),
  ('leg ext', 'Leg Extension'),
  ('leg extension machine', 'Leg Extension'),
  ('leg curl machine', 'Leg Curl'),
  ('lunges', 'Walking Lunge'),
  ('hip thrusts', 'Hip Thrust'),
  ('calf raise', 'Standing Calf Raise'),
  ('bb curl', 'Barbell Curl'),
  ('db curl', 'Dumbbell Curl'),
  ('hammer curls', 'Hammer Curl'),
  ('tricep pushdown', 'Triceps Pushdown'),
  ('triceps extension', 'Overhead Cable Triceps Extension'),
  ('skull crushers', 'Skull Crusher'),
  ('crunches', 'Cable Crunch'),
  ('planks', 'Plank'),
  ('pec deck', 'Pec Deck Fly'),
  ('chest press machine', 'Machine Chest Press'),
  ('shoulder press machine', 'Machine Shoulder Press'),
  ('hack squat machine', 'Machine Hack Squat'),
  ('hamstring curl', 'Leg Curl'),
  ('leg press machine', 'Leg Press'),
  ('abductor machine', 'Machine Hip Abduction'),
  ('adductor machine', 'Machine Hip Adduction')
) as v(a, c)
on conflict (alias_key) do update set canonical_name = excluded.canonical_name;

-- 3. Obvious typos found in existing data.
insert into private.exercise_aliases (alias_key, canonical_name)
select private.exercise_lookup_key(a), c
from (values
  ('Machine Rowp', 'Machine Row'),
  ('Overhead Cable Triceps Extension was', 'Overhead Cable Triceps Extension')
) as v(a, c)
on conflict (alias_key) do update set canonical_name = excluded.canonical_name;

-- 4. Existing custom names: one canonical spelling per key. Prefer a spelling with capital
-- letters (nicer in the UI), then the most used, then alphabetical.
insert into private.exercise_aliases (alias_key, canonical_name)
select distinct on (k) k, spelling
from (
  select private.exercise_lookup_key(exercise_name) as k, btrim(exercise_name) as spelling, count(*) as uses
  from public.workout_exercises
  group by 1, 2
) s
where k <> ''
order by k, (spelling <> lower(spelling)) desc, uses desc, spelling
on conflict (alias_key) do nothing;

-- Pure lookup, never writes. Used by read paths.
create or replace function private.lookup_canonical_exercise_name(raw text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.canonical_name
       from private.exercise_aliases a
      where a.alias_key = private.exercise_lookup_key(raw)),
    btrim(coalesce(raw, ''))
  );
$$;

-- Lookup that registers an unseen name as its own canonical (first spelling wins). Used on write.
create or replace function private.resolve_canonical_exercise_name(raw text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  trimmed text := btrim(coalesce(raw, ''));
  k text := private.exercise_lookup_key(raw);
  c text;
begin
  if trimmed = '' or k = '' then
    return trimmed;
  end if;

  select canonical_name into c from private.exercise_aliases where alias_key = k;
  if c is not null then
    return c;
  end if;

  insert into private.exercise_aliases (alias_key, canonical_name)
  values (k, trimmed)
  on conflict (alias_key) do nothing;

  select canonical_name into c from private.exercise_aliases where alias_key = k;
  return c;
end;
$$;

-- Column, backfill, constraint.
alter table public.workout_exercises add column if not exists canonical_exercise_name text;

update public.workout_exercises
set canonical_exercise_name = private.lookup_canonical_exercise_name(exercise_name)
where canonical_exercise_name is null;

alter table public.workout_exercises alter column canonical_exercise_name set not null;

create index if not exists workout_exercises_canonical_name_idx
  on public.workout_exercises (canonical_exercise_name);

-- Always derived from exercise_name, even if a client tries to set it.
create or replace function private.set_workout_exercise_canonical_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.canonical_exercise_name := private.resolve_canonical_exercise_name(new.exercise_name);
  return new;
end;
$$;

drop trigger if exists set_workout_exercise_canonical_name on public.workout_exercises;
create trigger set_workout_exercise_canonical_name
  before insert or update of exercise_name, canonical_exercise_name on public.workout_exercises
  for each row execute function private.set_workout_exercise_canonical_name();

-- Admin helpers (run from the SQL editor).
create or replace function private.recompute_canonical_exercise_names()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.workout_exercises we
     set canonical_exercise_name = private.lookup_canonical_exercise_name(we.exercise_name)
   where we.canonical_exercise_name is distinct from private.lookup_canonical_exercise_name(we.exercise_name);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

create or replace function private.set_exercise_alias(alias text, canonical text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  alias_k text := private.exercise_lookup_key(alias);
  canonical_k text := private.exercise_lookup_key(canonical);
  target_name text := btrim(canonical);
  old_name text;
begin
  if alias_k = '' or canonical_k = '' then
    raise exception 'alias and canonical must contain letters or digits';
  end if;

  select a.canonical_name into old_name from private.exercise_aliases a where a.alias_key = alias_k;

  -- The canonical name must resolve to itself so it is a stable group name.
  insert into private.exercise_aliases (alias_key, canonical_name)
  values (canonical_k, target_name)
  on conflict (alias_key) do nothing;
  select a.canonical_name into target_name from private.exercise_aliases a where a.alias_key = canonical_k;

  insert into private.exercise_aliases (alias_key, canonical_name)
  values (alias_k, target_name)
  on conflict (alias_key) do update set canonical_name = excluded.canonical_name;

  -- Everything that used to point at the old group moves to the new one.
  if old_name is not null and old_name <> target_name then
    update private.exercise_aliases a set canonical_name = target_name where a.canonical_name = old_name;
  end if;

  return private.recompute_canonical_exercise_names();
end;
$$;

revoke all on function
  private.exercise_lookup_key(text),
  private.lookup_canonical_exercise_name(text),
  private.resolve_canonical_exercise_name(text),
  private.set_workout_exercise_canonical_name(),
  private.recompute_canonical_exercise_names(),
  private.set_exercise_alias(text, text)
from public, anon, authenticated;

-- Read path for the app: canonical name for a typed/selected name, without registering anything.
create or replace function public.canonical_exercise_name(name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.lookup_canonical_exercise_name(name);
$$;

revoke all on function public.canonical_exercise_name(text) from public, anon;
grant execute on function public.canonical_exercise_name(text) to authenticated;

-- Progress series now groups by canonical name. Signature and access rules are unchanged.
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
    and w.finished_at is not null
    and we.canonical_exercise_name = private.lookup_canonical_exercise_name(target_exercise)
    and (
      range_days is null
      or w.started_at >= now() - make_interval(days => greatest(range_days, 1))
    )
  group by 1
  order by 1;
$$;
