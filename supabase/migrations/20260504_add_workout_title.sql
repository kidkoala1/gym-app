-- Add title column to workouts table
alter table public.workouts add column title text;

-- Index on title for faster autocomplete queries
create index if not exists workouts_user_id_title_idx on public.workouts(user_id, title) where title is not null;
