import { createStructuredResponse } from './_openai.js'

type ProviderName = 'openai' | 'deepseek' | 'cheapinference'

type RoutedResult<T> = {
  data: T
  provider: ProviderName
  model: string
}

function parseJsonText(raw: string) {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  return JSON.parse(trimmed)
}

async function createOpenAICompatibleJson<T>(args: {
  baseUrl: string
  apiKey: string
  model: string
  prompt: string
  systemPrompt: string
  schema: Record<string, unknown>
  maxOutputTokens?: number
}) {
  const endpoint = `${args.baseUrl.replace(/\/$/, '')}/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: args.maxOutputTokens || 1800,
      messages: [
        { role: 'system', content: `${args.systemPrompt}\nDevuelve SOLO JSON válido. Debe respetar esta forma: ${JSON.stringify(args.schema)}` },
        { role: 'user', content: args.prompt },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Compatible provider ${response.status}: ${(await response.text()).slice(0, 350)}`)
  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new Error('Compatible provider returned no JSON content')
  return parseJsonText(text) as T
}

function candidates() {
  const preference = (process.env.LAB_AI_PROVIDER || 'auto').toLowerCase()
  const list: ProviderName[] = preference === 'openai' || preference === 'deepseek' || preference === 'cheapinference'
    ? [preference]
    : ['cheapinference', 'deepseek', 'openai']
  return list
}

export async function createRoutedLabJson<T>(args: {
  prompt: string
  schemaName: string
  schema: Record<string, unknown>
  systemPrompt?: string
  maxOutputTokens?: number
}): Promise<RoutedResult<T>> {
  const errors: string[] = []
  const systemPrompt = args.systemPrompt || 'Eres un diseñador pedagógico universitario. Crea escenarios claros, realistas y breves. No hagas cálculos del laboratorio: solo contextualiza la práctica.'

  for (const provider of candidates()) {
    try {
      if (provider === 'cheapinference') {
        const apiKey = process.env.CHEAPINFERENCE_API_KEY
        const baseUrl = process.env.CHEAPINFERENCE_BASE_URL
        const model = process.env.CHEAPINFERENCE_MODEL
        if (!apiKey || !baseUrl || !model) throw new Error('CheapInference env incomplete')
        const data = await createOpenAICompatibleJson<T>({ baseUrl, apiKey, model, prompt: args.prompt, systemPrompt, schema: args.schema, maxOutputTokens: args.maxOutputTokens })
        return { data, provider, model }
      }
      if (provider === 'deepseek') {
        const apiKey = process.env.DEEPSEEK_API_KEY
        const baseUrl = process.env.DEEPSEEK_BASE_URL
        const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
        if (!apiKey || !baseUrl) throw new Error('DeepSeek env incomplete')
        const data = await createOpenAICompatibleJson<T>({ baseUrl, apiKey, model, prompt: args.prompt, systemPrompt, schema: args.schema, maxOutputTokens: args.maxOutputTokens })
        return { data, provider, model }
      }
      const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna'
      const data = await createStructuredResponse(args.prompt, args.schemaName, args.schema, { systemPrompt, maxOutputTokens: args.maxOutputTokens || 1000 }) as T
      return { data, provider: 'openai', model }
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : 'error'}`)
    }
  }
  throw new Error(`No lab scenario provider available. ${errors.join(' | ')}`)
}
