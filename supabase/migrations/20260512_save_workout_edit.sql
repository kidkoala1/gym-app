-- Apply a whole history edit atomically. Everything in this function runs in one transaction:
-- if any step fails the workout is left exactly as it was.
--
-- p_exercises is a json array of:
--   { "id": uuid|null, "deleted": bool, "name": text|null,
--     "sets": [ { "id": uuid|null, "reps": int, "weight_kg": number } ] }
--   - existing exercise (id set): optionally renamed (name), its sets updated by id
--   - deleted existing exercise: { "id": ..., "deleted": true }
--   - new exercise (id null): inserted after the current last position, sets numbered 1..n
--
-- SECURITY INVOKER: row level security still applies as the calling user.
create or replace function public.save_workout_edit(p_workout_id uuid, p_exercises jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ex jsonb;
  st jsonb;
  ex_id uuid;
  new_id uuid;
  next_pos integer;
  set_no integer;
  reps_v integer;
  weight_v numeric;
  name_v text;
begin
  if jsonb_typeof(p_exercises) is distinct from 'array' then
    raise exception 'Exercises must be a list';
  end if;

  if not exists (
    select 1 from public.workouts w
    where w.id = p_workout_id and w.user_id = (select auth.uid())
  ) then
    raise exception 'Workout not found';
  end if;

  select coalesce(max(we.position), 0) + 1 into next_pos
  from public.workout_exercises we
  where we.workout_id = p_workout_id;

  for ex in select value from jsonb_array_elements(p_exercises) loop
    ex_id := nullif(ex ->> 'id', '')::uuid;

    if coalesce((ex ->> 'deleted')::boolean, false) then
      if ex_id is not null then
        delete from public.workout_exercises
        where id = ex_id and workout_id = p_workout_id;
      end if;
      continue;
    end if;

    name_v := nullif(btrim(coalesce(ex ->> 'name', '')), '');

    if ex_id is null then
      if name_v is null then
        raise exception 'Exercise title cannot be empty.';
      end if;

      insert into public.workout_exercises (workout_id, exercise_name, position)
      values (p_workout_id, name_v, next_pos)
      returning id into new_id;
      next_pos := next_pos + 1;
      set_no := 0;

      for st in select value from jsonb_array_elements(coalesce(ex -> 'sets', '[]'::jsonb)) loop
        reps_v := (st ->> 'reps')::integer;
        weight_v := (st ->> 'weight_kg')::numeric;
        if reps_v is null or reps_v < 1 or reps_v > 1000 then
          raise exception 'Reps must be between 1 and 1000.';
        end if;
        if weight_v is null or weight_v < 0 or weight_v > 2000 then
          raise exception 'Weight must be between 0 and 2000 kg.';
        end if;

        set_no := set_no + 1;
        insert into public.workout_sets (workout_exercise_id, set_number, reps, weight_kg)
        values (new_id, set_no, reps_v, weight_v);
      end loop;
    else
      if name_v is not null then
        update public.workout_exercises
        set exercise_name = name_v
        where id = ex_id and workout_id = p_workout_id;
        if not found then
          raise exception 'Exercise not found';
        end if;
      end if;

      for st in select value from jsonb_array_elements(coalesce(ex -> 'sets', '[]'::jsonb)) loop
        reps_v := (st ->> 'reps')::integer;
        weight_v := (st ->> 'weight_kg')::numeric;
        if reps_v is null or reps_v < 1 or reps_v > 1000 then
          raise exception 'Reps must be between 1 and 1000.';
        end if;
        if weight_v is null or weight_v < 0 or weight_v > 2000 then
          raise exception 'Weight must be between 0 and 2000 kg.';
        end if;

        update public.workout_sets
        set reps = reps_v, weight_kg = weight_v
        where id = (st ->> 'id')::uuid and workout_exercise_id = ex_id;
        if not found then
          raise exception 'Set not found';
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

revoke all on function public.save_workout_edit(uuid, jsonb) from public, anon;
grant execute on function public.save_workout_edit(uuid, jsonb) to authenticated;
