# Technical Debt

## Canonical Exercise Names

Progress and compare charts still depend on matching exercise names that users typed or selected in the past. The app has frontend alias handling, but the database currently stores only the display/raw exercise name on `workout_exercises`.

This can cause related names to drift apart, for example:

- `Reverse Fly`
- `Rear Delt Fly`
- `Reverse Pec Deck`

The current frontend fallback handles many of these cases, but it is a bridge rather than the long-term model.

### Proposed Fix

Add a `canonical_exercise_name` column to `workout_exercises`.

New rows should store both:

- `exercise_name`: the display name saved for the workout.
- `canonical_exercise_name`: the normalized name used for progress grouping and compare queries.

Existing rows need a one-time backfill so old workouts participate in progress charts consistently.

### Implementation Checklist

- Add a database migration for `workout_exercises.canonical_exercise_name`.
- Backfill existing rows using the same alias rules as `resolveCanonicalExerciseName`.
- Update workout insert and history-edit paths to write both names.
- Update progress RPCs/queries to filter by `canonical_exercise_name`.
- Remove or simplify frontend fallback logic once the database is the source of truth.

### When To Do This

Prioritize this before adding more Progress or Compare features, especially leaderboards, personal records, more chart types, or broader multi-user sharing.
