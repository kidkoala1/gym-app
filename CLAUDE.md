# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (type-check is part of the build)
- `npm run lint` — ESLint
- `npm run preview` — serve the production build

There is no test suite. Requires `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (read in [src/lib/supabase.ts](src/lib/supabase.ts)).

GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, build, lint and a production `npm audit` on every push to `main` and on pull requests; check the Actions tab if a push shows a red cross.

Bump the `version` in `package.json` (and `package-lock.json`) with each batch of changes; it is shown in Settings via `__APP_VERSION__`.

### Supabase CLI

Use `npx supabase@latest ...` (not a project dependency). Windows PowerShell 5.1 has no `&&`.

- `migration list` — compare local vs remote migrations
- `db query --linked "select ..."` / `-f file.sql` — run SQL against the live DB (use a `do $$ ... raise exception ... $$` block at the end for a rolled-back dry run)
- `db dump --schema public,private,progress -f live_schema.sql` — works without Docker (`db pull` needs Docker); `live_schema.sql` and `backup_*.sql` are gitignored
- `db push` — applies pending migrations to the live DB; the user runs this themselves

## Architecture

Single-page PWA gym tracker: React 19 + TypeScript + Vite, MUI (dark theme defined in [src/main.tsx](src/main.tsx)), TanStack Query, Supabase (auth + Postgres). There is no router — navigation is a `TabView` state (`workout | progress | settings | history`) in [src/App.tsx](src/App.tsx).

- **[src/App.tsx](src/App.tsx)** (~340 lines) is wiring only: it calls the feature hooks and passes their data/handlers as props to the tab components, which are mostly presentational. Progress, History and Settings tabs are lazy-loaded; vendor libraries are split into their own chunks in [vite.config.ts](vite.config.ts).
- **Feature hooks hold the stateful logic:** `useActiveWorkout` (in-progress workout, add-exercise form, weight suggestions, resume), `useWorkoutHistory` (paged history, editing, deleting), `useExerciseLibrary` (custom + built-in exercise names), `useProfileForm`, `useBackgroundSettings` (localStorage only). Shared pure helpers are plain modules and easy to unit test: `workouts/setInput.ts` (validation, parsing), `workouts/insights.ts` (weight suggestions), `lib/css.ts`, `lib/storage.ts`.
- **`src/features/<area>/`** — `auth`, `profile`, `settings`, `workouts`. Each has `api.ts` (Supabase calls) and `components/`. All DB access goes through these `api.ts` files; components don't call Supabase directly.
- **[src/types/db.ts](src/types/db.ts)** holds DB row types; [src/features/workouts/localTypes.ts](src/features/workouts/localTypes.ts) holds client-only UI/draft types.
- **Schema** lives in [supabase/migrations/](supabase/migrations/) (RLS enabled on all tables, one policy per command scoped to `authenticated`; `anon` has no table or RPC access). Progress data is served via the `get_progress_series` RPC, plus `search_public_profiles` for opt-in sharing/compare. Public-progress users' workout rows are readable by all signed-in users.
- **Signup allowlist:** a `BEFORE INSERT` trigger on `auth.users` rejects emails not in `private.allowed_signup_emails`. Invite someone *before* they first sign in: `insert into private.allowed_signup_emails (email) values ('friend@gmail.com');` (lowercase).
- `__APP_VERSION__` is injected by [vite.config.ts](vite.config.ts) from package.json's version (declared in [src/global.d.ts](src/global.d.ts)).

### Things to know

- **Apply migrations before deploying frontend code that depends on them.** [src/features/workouts/api.ts](src/features/workouts/api.ts) assumes the live schema is current (e.g. `workouts.title`, `canonical_exercise_name`) and has no missing-column fallbacks.
- **Exercise names:** `exercise_name` is the display name; `canonical_exercise_name` (set by a DB trigger from `private.exercise_aliases`, never by the client) is what progress, compare and weight suggestions group on. `resolveCanonicalExerciseName` in [src/features/workouts/defaultExercises.ts](src/features/workouts/defaultExercises.ts) is only typing UX. Merge/split names with `select private.set_exercise_alias('alias', 'Canonical Name');`. See [docs/technical-debt.md](docs/technical-debt.md) for open items.
- **Writing exercises and sets:** adding an exercise to a workout (live or from History) and saving a whole history edit both go through the `save_workout_edit` RPC (`saveWorkoutEdit` in `api.ts`): one transaction, positions and set numbers assigned by the database, runs as the caller so RLS applies. Don't reintroduce per-row inserts/updates from the client.
- **Workouts are often never "finished"** (the user forgets the Finish button), so never filter data on `finished_at`; `get_progress_series` and `list_logged_exercise_names` count every workout with sets.
- **Resuming workouts:** an unfinished workout (`finished_at is null`) started within the last 12 hours is restored on load by `getUnfinishedWorkout`; older unfinished ones are treated as abandoned.
- **Pagination:** History loads 20 workouts per page (`useInfiniteQuery` + `listWorkoutHistoryPage`); the Progress exercise dropdown comes from the `list_logged_exercise_names` RPC (distinct names across all workouts); weight suggestions read at most the 60 most recent sessions of one exercise.
