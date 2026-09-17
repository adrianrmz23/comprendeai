import { AUDIO_BUCKET, createAudioSignedUrl, getStoredAudio, hashObject, sha256, storeAudioAsset } from './_supabase.js'

const DEFAULT_MODEL = 'eleven_multilingual_v2'
const DEFAULT_FORMAT = 'mp3_44100_128'

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 4200)
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const text = cleanText(req.body?.text)
  if (!text) return res.status(400).json({ error: 'Missing text' })

  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || DEFAULT_FORMAT
  if (!apiKey) return res.status(503).json({ error: 'ELEVENLABS_API_KEY is not configured' })
  if (!voiceId) return res.status(503).json({ error: 'ELEVENLABS_VOICE_ID is not configured' })
  const supabaseServerKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || !supabaseServerKey) {
    return res.status(503).json({ error: 'Supabase server credentials are required to cache microaudio. Configure SUPABASE_URL + SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY).' })
  }

  const textHash = sha256(text)
  const audioKey = hashObject({ textHash, voiceId, modelId, outputFormat, version: 'microaudio-v1' })

  const existing = await getStoredAudio(audioKey)
  if (existing) {
    const url = await createAudioSignedUrl(existing.storage_bucket, existing.storage_path)
    if (url) return res.status(200).json({ url, cached: true, audioKey })
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    return res.status(response.status).json({ error: `ElevenLabs ${response.status}: ${detail.slice(0, 260)}` })
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  const stored = await storeAudioAsset({ audioKey, textHash, voiceId, modelId, outputFormat, bytes })
  const url = await createAudioSignedUrl(stored.bucket || AUDIO_BUCKET, stored.path)
  if (!url) return res.status(500).json({ error: 'Audio was stored but a signed URL could not be created.' })

  return res.status(200).json({ url, cached: false, audioKey })
}
