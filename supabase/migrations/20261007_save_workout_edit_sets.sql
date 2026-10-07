-- Live set-by-set logging. save_workout_edit can now add and delete single sets on an exercise
-- that already exists, and it returns the ids it created so the client can keep editing them.
-- Everything still runs in one transaction: if any step fails the workout is left as it was.
--
-- p_exercises is a json array of:
--   { "id": uuid|null, "deleted": bool, "name": text|null,
--     "sets": [ { "id": uuid|null, "deleted": bool, "reps": int, "weight_kg": number } ] }
--   - new exercise (id null): inserted after the current last position, its sets numbered 1..n
--   - existing exercise (id set): optionally renamed (name); a set with an id is updated, or
--     deleted with "deleted": true; a set without an id is appended after the last set.
--     Set numbers are then renumbered 1..n, keeping their order.
--   - deleted existing exercise: { "id": ..., "deleted": true }
--
-- Returns a json array with one element per input exercise, in input order:
--   { "id": exercise id, "set_ids": [ the id of each input set, null for deleted sets ] }
--   or { "id": exercise id, "deleted": true }
--
-- The payload is a superset of the previous version's, so older clients keep working. The return
-- type changes from void to jsonb, which needs a drop and create instead of create or replace.
--
-- SECURITY INVOKER: row level security still applies as the calling user.
drop function if exists public.save_workout_edit(uuid, jsonb);

create function public.save_workout_edit(p_workout_id uuid, p_exercises jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ex jsonb;
  st jsonb;
  ex_id uuid;
  set_id uuid;
  next_pos integer;
  set_no integer;
  reps_v integer;
  weight_v numeric;
  name_v text;
  set_ids jsonb;
  result jsonb := '[]'::jsonb;
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
      result := result || jsonb_build_array(jsonb_build_object('id', ex_id, 'deleted', true));
      continue;
    end if;

    name_v := nullif(btrim(coalesce(ex ->> 'name', '')), '');

    if ex_id is null then
      if name_v is null then
        raise exception 'Exercise title cannot be empty.';
      end if;

      insert into public.workout_exercises (workout_id, exercise_name, position)
      values (p_workout_id, name_v, next_pos)
      returning id into ex_id;
      next_pos := next_pos + 1;
      set_no := 0;
    else
      if name_v is not null then
        update public.workout_exercises
        set exercise_name = name_v
        where id = ex_id and workout_id = p_workout_id;
      else
        perform 1 from public.workout_exercises
        where id = ex_id and workout_id = p_workout_id;
      end if;
      if not found then
        raise exception 'Exercise not found';
      end if;

      select coalesce(max(ws.set_number), 0) into set_no
      from public.workout_sets ws
      where ws.workout_exercise_id = ex_id;
    end if;

    set_ids := '[]'::jsonb;

    for st in select value from jsonb_array_elements(coalesce(ex -> 'sets', '[]'::jsonb)) loop
      set_id := nullif(st ->> 'id', '')::uuid;

      if coalesce((st ->> 'deleted')::boolean, false) then
        if set_id is not null then
          delete from public.workout_sets
          where id = set_id and workout_exercise_id = ex_id;
        end if;
        set_ids := set_ids || jsonb_build_array(null::uuid);
        continue;
      end if;

      reps_v := (st ->> 'reps')::integer;
      weight_v := (st ->> 'weight_kg')::numeric;
      if reps_v is null or reps_v < 1 or reps_v > 1000 then
        raise exception 'Reps must be between 1 and 1000.';
      end if;
      if weight_v is null or weight_v < 0 or weight_v > 2000 then
        raise exception 'Weight must be between 0 and 2000 kg.';
      end if;

      if set_id is null then
        set_no := set_no + 1;
        insert into public.workout_sets (workout_exercise_id, set_number, reps, weight_kg)
        values (ex_id, set_no, reps_v, weight_v)
        returning id into set_id;
      else
        update public.workout_sets
        set reps = reps_v, weight_kg = weight_v
        where id = set_id and workout_exercise_id = ex_id;
        if not found then
          raise exception 'Set not found';
        end if;
      end if;

      set_ids := set_ids || jsonb_build_array(set_id);
    end loop;

    -- Close the gaps deleted sets leave behind. unique (workout_exercise_id, set_number) is
    -- checked per row, so move every set out of the way before numbering them 1..n.
    update public.workout_sets
    set set_number = set_number + 100000
    where workout_exercise_id = ex_id;

    update public.workout_sets ws
    set set_number = ordered.rn
    from (
      select id, row_number() over (order by set_number) as rn
      from public.workout_sets
      where workout_exercise_id = ex_id
    ) ordered
    where ws.id = ordered.id;

    result := result || jsonb_build_array(jsonb_build_object('id', ex_id, 'set_ids', set_ids));
  end loop;

  return result;
end;
$$;

revoke all on function public.save_workout_edit(uuid, jsonb) from public, anon;
grant execute on function public.save_workout_edit(uuid, jsonb) to authenticated;
