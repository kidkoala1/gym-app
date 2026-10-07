# Technical Debt

## Canonical Exercise Names (done in 0.6.0)

`workout_exercises.exercise_name` is the display name the user logged. `canonical_exercise_name` is derived by a trigger from `private.exercise_aliases` and is what progress and compare group on. Unseen names register themselves on first use (first spelling wins; a spelling with capital letters is preferred during the initial backfill).

Merge or split names without a deploy, from the SQL editor:

```sql
select private.set_exercise_alias('reverse fly', 'Rear Delt Fly');   -- merge
select private.recompute_canonical_exercise_names();                  -- after hand-editing aliases
```

The first seed was deliberately conservative: only case/spacing variants, the built-in alias map and two typos were merged. Gym-specific names (`... sloterdijk`, `... Gordel`, `Pendulum Squat 2`) and judgement calls (`reverse fly` vs `Rear Delt Fly` vs `Reverse Pec Deck`, `pull ups` vs `Pull-Up`, tricep extension variants) are still separate groups.

Remaining:

- The built-in names and aliases exist in two places: `defaultExercises.ts` (typing UX) and the seed in `20260510_canonical_exercise_names.sql`. New built-in aliases need a `set_exercise_alias` call as well.
- The frontend still resolves typed names with `resolveCanonicalExerciseName` before saving, which can change the stored display name (for example `ohp` becomes `Overhead Press`).

## Other open items

- **`finished_at` is unreliable.** ~40% of workouts are never marked finished (the user forgets to press Finish), so nothing may filter on it for data; progress and the exercise list count any workout with sets. Only `getUnfinishedWorkout` (resume within 12 hours) uses it. Consider removing the Finish button or auto-finishing stale workouts.
- **No Content-Security-Policy.** Needs to be set as a hosting header (a meta tag breaks the Vite dev server).
- **Raw workout rows of public users are readable by every signed-in user** (select policies use `private.user_allows_public_progress`). Accepted for a small trusted group. Tightening it means Compare using only `get_progress_series`.
- **No automated tests.**
