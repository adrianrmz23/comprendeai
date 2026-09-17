import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const AI_CACHE_TABLE = 'comprende_v1_ai_artifacts'
export const AUDIO_TABLE = 'comprende_v1_audio_assets'
export const AUDIO_BUCKET = 'comprende-v1-elevenlabs-audio'

let serverClient: SupabaseClient | null | undefined

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj).sort().map(key => `${JSON.stringify(key)}:${stableJson(obj[key])}`).join(',')}}`
}

export function hashObject(value: unknown) {
  return sha256(stableJson(value))
}

export function getSupabaseServer(): SupabaseClient | null {
  if (serverClient !== undefined) return serverClient
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serverKey) {
    serverClient = null
    return null
  }

  // Fail loudly when a browser/public key was accidentally configured on the server.
  // A real Supabase secret/service-role key bypasses RLS; a publishable/anon key does not.
  if (serverKey.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_SECRET_KEY is using a publishable key. Use an sb_secret_ key from Supabase Settings > API Keys (server only).')
  }
  if (serverKey.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(serverKey.split('.')[1], 'base64url').toString('utf8')) as { role?: string }
      if (payload.role === 'anon' || payload.role === 'authenticated') {
        throw new Error('The configured Supabase server key is an anon/authenticated JWT. Use the legacy service_role key or, preferably, a new sb_secret_ key.')
      }
    } catch (error) {
      if (error instanceof Error && /anon|authenticated JWT/.test(error.message)) throw error
    }
  }

  serverClient = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return serverClient
}

type CacheWrite = {
  cacheKey: string
  artifactKind: string
  sourceHash: string
  promptVersion: string
  modelId?: string
  payload: unknown
  metadata?: Record<string, unknown>
}

export async function readAiCache<T>(cacheKey: string): Promise<T | null> {
  const supabase = getSupabaseServer()
  if (!supabase) return null
  const { data, error } = await supabase
    .from(AI_CACHE_TABLE)
    .select('payload')
    .eq('cache_key', cacheKey)
    .maybeSingle()
  if (error) {
    console.warn('Comprende cache read failed:', error.message)
    return null
  }
  if (!data) return null
  void supabase.from(AI_CACHE_TABLE).update({ last_accessed_at: new Date().toISOString() }).eq('cache_key', cacheKey)
  return data.payload as T
}

export async function writeAiCache(input: CacheWrite) {
  const supabase = getSupabaseServer()
  if (!supabase) return false
  const now = new Date().toISOString()
  const { error } = await supabase.from(AI_CACHE_TABLE).upsert({
    cache_key: input.cacheKey,
    artifact_kind: input.artifactKind,
    source_hash: input.sourceHash,
    prompt_version: input.promptVersion,
    model_id: input.modelId || null,
    payload: input.payload,
    metadata: input.metadata || {},
    updated_at: now,
    last_accessed_at: now,
  }, { onConflict: 'cache_key' })
  if (error) {
    console.warn('Comprende cache write failed:', error.message)
    return false
  }
  return true
}

export async function getStoredAudio(audioKey: string) {
  const supabase = getSupabaseServer()
  if (!supabase) return null
  const { data, error } = await supabase
    .from(AUDIO_TABLE)
    .select('storage_bucket,storage_path,content_type,byte_size')
    .eq('audio_key', audioKey)
    .maybeSingle()
  if (error || !data) return null
  void supabase.from(AUDIO_TABLE).update({ last_accessed_at: new Date().toISOString() }).eq('audio_key', audioKey)
  return data as { storage_bucket: string; storage_path: string; content_type: string; byte_size: number | null }
}

export async function createAudioSignedUrl(bucket: string, path: string, expiresIn = 60 * 60 * 6) {
  const supabase = getSupabaseServer()
  if (!supabase) return null
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) {
    console.warn('Comprende signed audio URL failed:', error.message)
    return null
  }
  return data.signedUrl
}

export async function storeAudioAsset(input: {
  audioKey: string
  textHash: string
  voiceId: string
  modelId: string
  outputFormat: string
  bytes: Uint8Array
}) {
  const supabase = getSupabaseServer()
  if (!supabase) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY are not configured')
  const path = `${input.voiceId}/${input.audioKey}.mp3`
  const upload = await supabase.storage.from(AUDIO_BUCKET).upload(path, Buffer.from(input.bytes), {
    contentType: 'audio/mpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw upload.error

  const now = new Date().toISOString()
  const { error } = await supabase.from(AUDIO_TABLE).upsert({
    audio_key: input.audioKey,
    text_hash: input.textHash,
    voice_id: input.voiceId,
    model_id: input.modelId,
    output_format: input.outputFormat,
    storage_bucket: AUDIO_BUCKET,
    storage_path: path,
    content_type: 'audio/mpeg',
    byte_size: input.bytes.byteLength,
    last_accessed_at: now,
  }, { onConflict: 'audio_key' })
  if (error) throw error
  return { bucket: AUDIO_BUCKET, path }
}
