# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (type-check is part of the build)
- `npm run lint` — ESLint
- `npm test` — Vitest (unit tests for the pure modules: `*.test.ts` next to the code in `src/`); run one file with `npx vitest run src/lib/css.test.ts`
- `npm run preview` — serve the production build

Tests cover the plain TypeScript modules only (no component or database tests). Requires `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (read in [src/lib/supabase.ts](src/lib/supabase.ts)).

GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, build, lint, tests and a production `npm audit` on every push to `main` and on pull requests; check the Actions tab if a push shows a red cross.

Bump the `version` in `package.json` (and `package-lock.json`) with each batch of changes; it is shown in Settings via `__APP_VERSION__`.

### Supabase CLI

Use `npx supabase@latest ...` (not a project dependency). Windows PowerShell 5.1 has no `&&`.

- `migration list` — compare local vs remote migrations
- `db query --linked "select ..."` / `-f file.sql` — run SQL against the live DB (use a `do $$ ... raise exception ... $$` block at the end for a rolled-back dry run)
- `db dump --schema public,private,progress -f live_schema.sql` — works without Docker (`db pull` needs Docker); `live_schema.sql` and `backup_*.sql` are gitignored
- `db push` — applies pending migrations to the live DB; the user runs this themselves

## Architecture

Single-page PWA gym tracker, used mostly as an iPhone home-screen app: React 19 + TypeScript + Vite, MUI, TanStack Query, Supabase (auth + Postgres). There is no router — navigation is a `TabView` state (`workout | progress | history | settings`) in [src/App.tsx](src/App.tsx), switched by a bottom tab bar.

- **Look:** iOS-style dark UI. Styling is mostly plain CSS classes in [src/App.css](src/App.css) on tokens from [src/index.css](src/index.css); MUI is used for behaviour (sheets via `SwipeableDrawer`, dialogs, toasts). The accent colour is a per-device preference; [src/theme.ts](src/theme.ts) builds the MUI theme from it and exposes `--accent`, `--on-accent` and `--accent-2` to CSS. The document itself never scrolls: a fixed `.shell` holds a `.scroller` and the tab bar below it, because on iOS home-screen apps a bar fixed over a scrolling page jumps up after tab switches (scroll the `.scroller`, not `window`). Full-screen frames use `height: var(--app-height)`, not `inset: 0` / `100%` / `dvh`: in standalone mode those stop above the home-indicator strip and leave a black bar under the tab bar, while `100vh` reaches the screen edge (set only under `display-mode: standalone`). Shared iOS pieces live in [src/components/](src/components/) (`BottomNav`, `BottomSheet`, `ActionSheet`, `ConfirmDialog`, `SwipeRow`, `Controls`, `Icon` — inline SVGs, no icon library).
- **[src/App.tsx](src/App.tsx)** is wiring only: it calls the feature hooks and passes their data/handlers as props to the tab components, which are mostly presentational. Progress, History and Settings tabs are lazy-loaded; vendor libraries are split into their own chunks in [vite.config.ts](vite.config.ts).
- **Feature hooks hold the stateful logic:** `useActiveWorkout` (live workout, set-by-set saving, rest clock, resume), `useWorkoutHistory` (paged history, detail sheet, editing, deleting), `useExerciseLibrary` (custom + built-in exercise names), `useProfileForm`, `useBackgroundSettings` and `usePreferences` (accent colour, rest clock; localStorage only). Shared pure helpers are plain modules and easy to unit test: `workouts/workoutDraft.ts` (draft rows and the save requests built from them), `workouts/liveWorkoutStore.ts` (save queue), `workouts/setInput.ts` (validation, parsing), `workouts/insights.ts` (last session / best in 60 days), `workouts/workoutStats.ts`, `workouts/chartScale.ts`, `lib/color.ts`, `lib/time.ts`, `lib/css.ts`, `lib/storage.ts`.
- **`src/features/<area>/`** — `auth`, `profile`, `settings`, `workouts`. Each has `api.ts` (Supabase calls) and `components/`. All DB access goes through these `api.ts` files; components don't call Supabase directly.
- **[src/types/db.ts](src/types/db.ts)** holds DB row types; [src/features/workouts/localTypes.ts](src/features/workouts/localTypes.ts) holds client-only UI/draft types.
- **Schema** lives in [supabase/migrations/](supabase/migrations/) (RLS enabled on all tables, one policy per command scoped to `authenticated`; `anon` has no table or RPC access). Progress data is served via the `get_progress_series` RPC, plus `search_public_profiles` for opt-in sharing/compare. Public-progress users' workout rows are readable by all signed-in users.
- **Signup allowlist:** a `BEFORE INSERT` trigger on `auth.users` rejects emails not in `private.allowed_signup_emails`. Invite someone *before* they first sign in: `insert into private.allowed_signup_emails (email) values ('friend@gmail.com');` (lowercase).
- `__APP_VERSION__` is injected by [vite.config.ts](vite.config.ts) from package.json's version (declared in [src/global.d.ts](src/global.d.ts)).

### Things to know

- **Apply migrations before deploying frontend code that depends on them.** [src/features/workouts/api.ts](src/features/workouts/api.ts) assumes the live schema is current (e.g. `workouts.title`, `canonical_exercise_name`, `save_workout_edit` returning ids) and has no missing-column fallbacks. Live logging in particular needs `20261007_save_workout_edit_sets.sql`: against the old `void` version, sets would never get their ids and would be saved again on every edit.
- **Exercise names:** `exercise_name` is the display name; `canonical_exercise_name` (set by a DB trigger from `private.exercise_aliases`, never by the client) is what progress, compare and weight suggestions group on. `resolveCanonicalExerciseName` in [src/features/workouts/defaultExercises.ts](src/features/workouts/defaultExercises.ts) is only typing UX. Merge/split names with `select private.set_exercise_alias('alias', 'Canonical Name');`. See [docs/technical-debt.md](docs/technical-debt.md) for open items.
- **Writing exercises and sets:** everything goes through the `save_workout_edit` RPC (`saveWorkoutEdit` in `api.ts`): one transaction, positions and set numbers assigned by the database, runs as the caller so RLS applies. It can create exercises, append/update/delete single sets, and returns the ids it created. Don't reintroduce per-row inserts/updates from the client.
- **Live logging:** there is no "save exercise" or tick button. A set row saves itself once it has a valid weight and reps (about 1 s after typing stops, immediately on blur or when the app goes to the background), and a new empty row with the same weight appears. A saved row that is emptied or swiped away is deleted. The request is worked out from the draft by `buildSyncRequest` and confirmed with `applySyncResult` ([workoutDraft.ts](src/features/workouts/workoutDraft.ts)); `liveWorkoutStore` runs saves one at a time so nothing is sent twice. History editing uses the same draft model but saves everything at once on Save.
- **Workouts are often never "finished"** (the user forgets the Finish button), so never filter data on `finished_at`; `get_progress_series` and `list_logged_exercise_names` count every workout with sets.
- **Resuming workouts:** an unfinished workout (`finished_at is null`) started within the last 12 hours is restored on load by `getUnfinishedWorkout`; older unfinished ones are treated as abandoned. The live draft is also kept in localStorage (`liveWorkout:<userId>`), so rows typed but not yet saved survive the app being closed.
- **Weight hints:** each exercise card shows "Last time" (top set of the most recent session) and "Best · 60 days", leaving the live workout out (`exerciseInsightsQuery`). A new exercise's first row starts at last time's weight.
- **Pagination:** History loads 20 workouts per page (`useInfiniteQuery` + `listWorkoutHistoryPage`); the Progress exercise dropdown comes from the `list_logged_exercise_names` RPC (distinct names across all workouts); weight suggestions read at most the 60 most recent sessions of one exercise.
