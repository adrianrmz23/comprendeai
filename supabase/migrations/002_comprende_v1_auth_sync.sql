-- Comprende 1.2 · Auth y sincronización entre dispositivos
-- Nombres específicos para convivir con otros proyectos en el mismo Supabase.
-- Ejecuta esta migración DESPUÉS de 001_comprende_v1_cache_and_audio.sql.

create table if not exists public.comprende_v1_user_materials (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id text not null,
  material_name text not null,
  material_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, material_id)
);

create index if not exists comprende_v1_user_materials_user_idx
  on public.comprende_v1_user_materials (user_id, updated_at desc);

alter table public.comprende_v1_user_materials enable row level security;

drop policy if exists "comprende_v1_user_materials_select_own" on public.comprende_v1_user_materials;

create policy "comprende_v1_user_materials_select_own"
  on public.comprende_v1_user_materials
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "comprende_v1_user_materials_insert_own" on public.comprende_v1_user_materials;

create policy "comprende_v1_user_materials_insert_own"
  on public.comprende_v1_user_materials
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "comprende_v1_user_materials_update_own" on public.comprende_v1_user_materials;

create policy "comprende_v1_user_materials_update_own"
  on public.comprende_v1_user_materials
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "comprende_v1_user_materials_delete_own" on public.comprende_v1_user_materials;

create policy "comprende_v1_user_materials_delete_own"
  on public.comprende_v1_user_materials
  for delete
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.comprende_v1_user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  learning_memory jsonb not null default '{"version":1,"concepts":{}}'::jsonb,
  demo_mastery integer not null default 18 check (demo_mastery between 0 and 100),
  completed_steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comprende_v1_user_progress enable row level security;

drop policy if exists "comprende_v1_user_progress_select_own" on public.comprende_v1_user_progress;

create policy "comprende_v1_user_progress_select_own"
  on public.comprende_v1_user_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "comprende_v1_user_progress_insert_own" on public.comprende_v1_user_progress;

create policy "comprende_v1_user_progress_insert_own"
  on public.comprende_v1_user_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "comprende_v1_user_progress_update_own" on public.comprende_v1_user_progress;

create policy "comprende_v1_user_progress_update_own"
  on public.comprende_v1_user_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Las tablas comprende_v1_ai_artifacts y comprende_v1_audio_assets siguen cerradas
-- para el navegador. Solo las funciones server-side acceden a ellas con sb_secret_.
