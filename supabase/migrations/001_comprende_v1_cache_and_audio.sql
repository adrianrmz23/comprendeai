-- Comprende 1.1
-- Tablas y bucket con nombres únicos para convivir con otros proyectos en el mismo Supabase.
-- Todo se accede desde funciones server-side con SUPABASE_SERVICE_ROLE_KEY.

create table if not exists public.comprende_v1_ai_artifacts (
  id bigint generated always as identity primary key,
  cache_key text not null unique,
  artifact_kind text not null,
  source_hash text not null,
  prompt_version text not null,
  model_id text,
  payload jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);

create index if not exists comprende_v1_ai_artifacts_kind_idx
  on public.comprende_v1_ai_artifacts (artifact_kind);
create index if not exists comprende_v1_ai_artifacts_updated_idx
  on public.comprende_v1_ai_artifacts (updated_at desc);

alter table public.comprende_v1_ai_artifacts enable row level security;

create table if not exists public.comprende_v1_audio_assets (
  id bigint generated always as identity primary key,
  audio_key text not null unique,
  text_hash text not null,
  voice_id text not null,
  model_id text not null,
  output_format text not null,
  storage_bucket text not null,
  storage_path text not null,
  content_type text not null default 'audio/mpeg',
  byte_size bigint,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);

create index if not exists comprende_v1_audio_assets_text_hash_idx
  on public.comprende_v1_audio_assets (text_hash);
create index if not exists comprende_v1_audio_assets_accessed_idx
  on public.comprende_v1_audio_assets (last_accessed_at desc);

alter table public.comprende_v1_audio_assets enable row level security;

-- Bucket privado. El cliente recibe URLs firmadas temporales desde el backend.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprende-v1-elevenlabs-audio',
  'comprende-v1-elevenlabs-audio',
  false,
  15728640,
  array['audio/mpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No se crean policies para anon/authenticated a propósito.
-- La service role usada por /api/* puede saltar RLS y mantiene las tablas/bucket privados.
