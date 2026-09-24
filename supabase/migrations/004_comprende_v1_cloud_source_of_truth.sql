-- Comprende 2.0.7 · Cloud Source of Truth
-- Ejecuta después de 001, 002 y 003.
-- Supabase pasa a ser la fuente oficial de biblioteca y progreso entre dispositivos.

alter table public.comprende_v1_user_materials
  add column if not exists file_path text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists content_updated_at timestamptz;

update public.comprende_v1_user_materials
set content_updated_at = coalesce(content_updated_at, updated_at, created_at)
where content_updated_at is null;

create table if not exists public.comprende_v1_concept_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id text not null,
  material_name text not null,
  concept text not null,
  concept_key text not null,
  memory_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, concept_key)
);

create index if not exists comprende_v1_concept_progress_user_idx
  on public.comprende_v1_concept_progress (user_id, updated_at desc);
create index if not exists comprende_v1_concept_progress_material_idx
  on public.comprende_v1_concept_progress (user_id, material_id);

alter table public.comprende_v1_concept_progress enable row level security;

drop policy if exists "comprende_v1_concept_progress_select_own" on public.comprende_v1_concept_progress;
create policy "comprende_v1_concept_progress_select_own"
  on public.comprende_v1_concept_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "comprende_v1_concept_progress_insert_own" on public.comprende_v1_concept_progress;
create policy "comprende_v1_concept_progress_insert_own"
  on public.comprende_v1_concept_progress for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "comprende_v1_concept_progress_update_own" on public.comprende_v1_concept_progress;
create policy "comprende_v1_concept_progress_update_own"
  on public.comprende_v1_concept_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "comprende_v1_concept_progress_delete_own" on public.comprende_v1_concept_progress;
create policy "comprende_v1_concept_progress_delete_own"
  on public.comprende_v1_concept_progress for delete to authenticated
  using (auth.uid() = user_id);

create table if not exists public.comprende_v1_learning_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id text not null,
  material_name text not null,
  concept text not null,
  event_type text not null,
  score integer not null check (score between 0 and 100),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists comprende_v1_learning_events_user_idx
  on public.comprende_v1_learning_events (user_id, created_at desc);
create index if not exists comprende_v1_learning_events_concept_idx
  on public.comprende_v1_learning_events (user_id, material_id, concept, created_at desc);

alter table public.comprende_v1_learning_events enable row level security;

drop policy if exists "comprende_v1_learning_events_select_own" on public.comprende_v1_learning_events;
create policy "comprende_v1_learning_events_select_own"
  on public.comprende_v1_learning_events for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "comprende_v1_learning_events_insert_own" on public.comprende_v1_learning_events;
create policy "comprende_v1_learning_events_insert_own"
  on public.comprende_v1_learning_events for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "comprende_v1_learning_events_delete_own" on public.comprende_v1_learning_events;
create policy "comprende_v1_learning_events_delete_own"
  on public.comprende_v1_learning_events for delete to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprende-v1-materials',
  'comprende-v1-materials',
  false,
  52428800,
  array['application/pdf','text/plain','text/markdown','application/octet-stream']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Cada archivo vive en: <auth.uid()>/<material_id>/original.ext
-- storage.foldername(name)[1] es el primer segmento del path.
drop policy if exists "comprende_v1_materials_storage_select_own" on storage.objects;
create policy "comprende_v1_materials_storage_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'comprende-v1-materials' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "comprende_v1_materials_storage_insert_own" on storage.objects;
create policy "comprende_v1_materials_storage_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'comprende-v1-materials' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "comprende_v1_materials_storage_update_own" on storage.objects;
create policy "comprende_v1_materials_storage_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'comprende-v1-materials' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'comprende-v1-materials' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "comprende_v1_materials_storage_delete_own" on storage.objects;
create policy "comprende_v1_materials_storage_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'comprende-v1-materials' and (storage.foldername(name))[1] = auth.uid()::text);
