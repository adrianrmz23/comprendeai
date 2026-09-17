-- Comprende 1.3 · Interactive Labs
-- Ejecuta después de 001 y 002. Nombres específicos para convivir con otros proyectos.

create table if not exists public.comprende_v1_lab_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id text not null,
  material_name text not null,
  concept text not null,
  lab_type text not null,
  scenario_id text not null,
  score integer not null check (score between 0 and 100),
  completed boolean not null default false,
  result_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists comprende_v1_lab_attempts_user_idx
  on public.comprende_v1_lab_attempts (user_id, created_at desc);
create index if not exists comprende_v1_lab_attempts_concept_idx
  on public.comprende_v1_lab_attempts (user_id, material_id, concept, lab_type);

alter table public.comprende_v1_lab_attempts enable row level security;

drop policy if exists "comprende_v1_lab_attempts_select_own" on public.comprende_v1_lab_attempts;
create policy "comprende_v1_lab_attempts_select_own"
  on public.comprende_v1_lab_attempts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "comprende_v1_lab_attempts_insert_own" on public.comprende_v1_lab_attempts;
create policy "comprende_v1_lab_attempts_insert_own"
  on public.comprende_v1_lab_attempts for insert to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.comprende_v1_lab_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id text not null,
  material_name text not null,
  concept text not null,
  lab_type text not null,
  best_score integer not null default 0 check (best_score between 0 and 100),
  attempts integer not null default 0 check (attempts >= 0),
  completed boolean not null default false,
  last_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, material_id, concept, lab_type)
);

create index if not exists comprende_v1_lab_progress_user_idx
  on public.comprende_v1_lab_progress (user_id, updated_at desc);

alter table public.comprende_v1_lab_progress enable row level security;

drop policy if exists "comprende_v1_lab_progress_select_own" on public.comprende_v1_lab_progress;
create policy "comprende_v1_lab_progress_select_own"
  on public.comprende_v1_lab_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "comprende_v1_lab_progress_insert_own" on public.comprende_v1_lab_progress;
create policy "comprende_v1_lab_progress_insert_own"
  on public.comprende_v1_lab_progress for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "comprende_v1_lab_progress_update_own" on public.comprende_v1_lab_progress;
create policy "comprende_v1_lab_progress_update_own"
  on public.comprende_v1_lab_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "comprende_v1_lab_progress_delete_own" on public.comprende_v1_lab_progress;
create policy "comprende_v1_lab_progress_delete_own"
  on public.comprende_v1_lab_progress for delete to authenticated
  using (auth.uid() = user_id);
