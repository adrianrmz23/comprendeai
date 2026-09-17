import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

async function readJsonBody(req: any) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw)
}

function localApiPlugin() {
  return {
    name: 'comprende-local-api',
    configureServer(server: any) {
      const routes: Record<string, () => Promise<{ default: (req: any, res: any) => Promise<any> }>> = {
        '/api/explain-concept': () => import('./api/explain-concept'),
        '/api/generate-session': () => import('./api/generate-session'),
        '/api/evaluate-explanation': () => import('./api/evaluate-explanation'),
        '/api/analyze-material': () => import('./api/analyze-material'),
        '/api/microaudio': () => import('./api/microaudio'),
        '/api/generate-lab-scenario': () => import('./api/generate-lab-scenario'),
        '/api/generate-generic-lab': () => import('./api/generate-generic-lab'),
      }

      for (const [route, loader] of Object.entries(routes)) {
        server.middlewares.use(route, async (req: any, res: any) => {
          try {
            const mod = await loader()
            const body = req.method === 'POST' ? await readJsonBody(req) : {}
            let statusCode = 200
            const mockRes = {
              status(code: number) {
                statusCode = code
                return this
              },
              json(payload: unknown) {
                res.statusCode = statusCode
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.end(JSON.stringify(payload))
                return this
              },
            }
            await mod.default({ method: req.method, body }, mockRes)
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Local API error' }))
          }
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
  if (env.OPENAI_MODEL) process.env.OPENAI_MODEL = env.OPENAI_MODEL
  if (env.OPENAI_DEEP_MODEL) process.env.OPENAI_DEEP_MODEL = env.OPENAI_DEEP_MODEL
  if (env.HF_TOKEN) process.env.HF_TOKEN = env.HF_TOKEN
  if (env.HF_EMBEDDING_MODEL) process.env.HF_EMBEDDING_MODEL = env.HF_EMBEDDING_MODEL
  if (env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL
  else if (env.NEXT_PUBLIC_SUPABASE_URL) process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
  if (env.SUPABASE_SECRET_KEY) process.env.SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY
  if (env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
  if (env.ELEVENLABS_API_KEY) process.env.ELEVENLABS_API_KEY = env.ELEVENLABS_API_KEY
  if (env.ELEVENLABS_VOICE_ID) process.env.ELEVENLABS_VOICE_ID = env.ELEVENLABS_VOICE_ID
  if (env.ELEVENLABS_MODEL_ID) process.env.ELEVENLABS_MODEL_ID = env.ELEVENLABS_MODEL_ID
  if (env.ELEVENLABS_OUTPUT_FORMAT) process.env.ELEVENLABS_OUTPUT_FORMAT = env.ELEVENLABS_OUTPUT_FORMAT
  if (env.LAB_AI_PROVIDER) process.env.LAB_AI_PROVIDER = env.LAB_AI_PROVIDER
  if (env.DEEPSEEK_API_KEY) process.env.DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY
  if (env.DEEPSEEK_BASE_URL) process.env.DEEPSEEK_BASE_URL = env.DEEPSEEK_BASE_URL
  if (env.DEEPSEEK_MODEL) process.env.DEEPSEEK_MODEL = env.DEEPSEEK_MODEL
  if (env.CHEAPINFERENCE_API_KEY) process.env.CHEAPINFERENCE_API_KEY = env.CHEAPINFERENCE_API_KEY
  if (env.CHEAPINFERENCE_BASE_URL) process.env.CHEAPINFERENCE_BASE_URL = env.CHEAPINFERENCE_BASE_URL
  if (env.CHEAPINFERENCE_MODEL) process.env.CHEAPINFERENCE_MODEL = env.CHEAPINFERENCE_MODEL

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react(), localApiPlugin()],
  }
})
