# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (type-check is part of the build)
- `npm run lint` — ESLint
- `npm run preview` — serve the production build

There is no test suite. Requires `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (read in [src/lib/supabase.ts](src/lib/supabase.ts)).

## Architecture

Single-page PWA gym tracker: React 19 + TypeScript + Vite, MUI (dark theme defined in [src/main.tsx](src/main.tsx)), TanStack Query, Supabase (auth + Postgres). No router is used in practice — navigation is a `TabView` state (`workout | progress | settings | history`) in [src/App.tsx](src/App.tsx).

- **[src/App.tsx](src/App.tsx)** (~1200 lines) is the orchestrator: it owns the active workout state, all React Query queries/mutations, profile and background-customization settings (persisted in `localStorage`), and passes data/handlers down as props to the tab components. Tab components are mostly presentational.
- **`src/features/<area>/`** — `auth`, `profile`, `settings`, `workouts`. Each has `api.ts` (Supabase calls) and `components/`. All DB access goes through these `api.ts` files; components don't call Supabase directly.
- **[src/types/db.ts](src/types/db.ts)** holds DB row types; [src/features/workouts/localTypes.ts](src/features/workouts/localTypes.ts) holds client-only UI/draft types.
- **Schema** lives in [supabase/migrations/](supabase/migrations/) (RLS enabled on all tables; progress data is served via the `get_progress_series` RPC and an `aggregated_workout_progress` view, plus `search_public_profiles` for opt-in sharing/compare).
- `__APP_VERSION__` is injected by [vite.config.ts](vite.config.ts) from package.json's version (declared in [src/global.d.ts](src/global.d.ts)).

### Things to know

- **Schema-drift fallbacks:** [src/features/workouts/api.ts](src/features/workouts/api.ts) tolerates a DB that hasn't had newer migrations applied (e.g. missing `workouts.title`, missing aggregation view/RPC) by catching specific Postgres/PostgREST errors and retrying with a reduced query. When adding a column/migration, follow this pattern or ensure the migration is applied first.
- **Exercise name canonicalization:** progress/compare grouping depends on `resolveCanonicalExerciseName` in [src/features/workouts/defaultExercises.ts](src/features/workouts/defaultExercises.ts) (frontend alias rules), because the DB only stores the raw `exercise_name`. See [docs/technical-debt.md](docs/technical-debt.md) — the planned fix is a `canonical_exercise_name` column; do this before adding more Progress/Compare features.
