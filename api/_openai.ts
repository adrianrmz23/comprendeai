function getOutputText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text
  const output = Array.isArray(data?.output) ? data.output : []
  for (const item of output) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue
    for (const content of item.content) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return ''
}

export type StructuredProvider = 'openai' | 'cheapinference'

export type StructuredResponseMeta = {
  provider: StructuredProvider
  model: string
  fallbackFrom?: 'openai'
  fallbackReason?: string
}

export type StructuredResponseResult<T = any> = {
  data: T
  meta: StructuredResponseMeta
}

type StructuredResponseOptions = {
  maxOutputTokens?: number
  systemPrompt?: string
  model?: string
  maxAttempts?: number
  /** Disable only for endpoints that must never leave OpenAI. */
  allowCheapInferenceFallback?: boolean
}

type AttemptResult = {
  data: any
  outputText: string
}

class OpenAIRequestError extends Error {
  status: number
  code: string
  body: string

  constructor(status: number, body: string) {
    let code = ''
    try {
      const parsed = JSON.parse(body)
      code = parsed?.error?.code || parsed?.error?.type || ''
    } catch {
      // Keep the raw body for diagnostics.
    }
    super(`OpenAI ${status}: ${body.slice(0, 600)}`)
    this.name = 'OpenAIRequestError'
    this.status = status
    this.code = code
    this.body = body
  }
}

function parseJsonText(raw: string) {
  const trimmed = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()
  return JSON.parse(trimmed)
}

function validateSchemaShape(value: any, schema: any, path = '$'): string | null {
  if (!schema || typeof schema !== 'object') return null

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    return `${path} debe ser uno de: ${schema.enum.join(', ')}`
  }

  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return `${path} debe ser un objeto`
    const required = Array.isArray(schema.required) ? schema.required : []
    for (const key of required) {
      if (!(key in value)) return `${path}.${key} es obligatorio`
    }
    const properties = schema.properties || {}
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) {
        const error = validateSchemaShape(value[key], childSchema, `${path}.${key}`)
        if (error) return error
      }
    }
    return null
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) return `${path} debe ser una lista`
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) return `${path} necesita al menos ${schema.minItems} elementos`
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) return `${path} admite máximo ${schema.maxItems} elementos`
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const error = validateSchemaShape(value[i], schema.items, `${path}[${i}]`)
        if (error) return error
      }
    }
    return null
  }

  if (schema.type === 'string' && typeof value !== 'string') return `${path} debe ser texto`
  if (schema.type === 'number' && typeof value !== 'number') return `${path} debe ser número`
  if (schema.type === 'integer' && (!Number.isInteger(value))) return `${path} debe ser entero`
  if (schema.type === 'boolean' && typeof value !== 'boolean') return `${path} debe ser booleano`
  return null
}

function isFallbackEligible(error: unknown) {
  if (!(error instanceof Error)) return false
  if (error instanceof OpenAIRequestError) {
    const billingCodes = new Set([
      'credit_balance_exhausted',
      'insufficient_quota',
      'project_spend_limit_exceeded',
      'organization_spend_limit_exceeded',
      'organization_usage_limit_exceeded',
    ])
    if (billingCodes.has(error.code)) return true
    if (error.status === 429) return true
    if (error.status >= 500) return true
    return false
  }

  // Network/time-out failures from fetch normally arrive as TypeError/Error without an HTTP status.
  return /fetch|network|timeout|timed out|ECONN|ENOTFOUND|EAI_AGAIN/i.test(error.message)
}

function fallbackReason(error: unknown) {
  if (error instanceof OpenAIRequestError) {
    if (error.code === 'credit_balance_exhausted') return 'saldo de OpenAI agotado'
    if (/spend_limit_exceeded/i.test(error.code)) return 'límite de gasto de OpenAI alcanzado'
    if (/usage_limit_exceeded/i.test(error.code)) return 'límite de uso de OpenAI alcanzado'
    if (error.status === 429) return 'OpenAI devolvió 429'
    if (error.status >= 500) return `OpenAI devolvió ${error.status}`
  }
  return error instanceof Error ? error.message.slice(0, 160) : 'OpenAI no disponible'
}

async function requestStructuredResponse(args: {
  apiKey: string
  model: string
  prompt: string
  schemaName: string
  schema: Record<string, unknown>
  maxOutputTokens: number
  systemPrompt: string
  attempt: number
}): Promise<AttemptResult> {
  const { apiKey, model, prompt, schemaName, schema, maxOutputTokens, systemPrompt, attempt } = args
  const retryHint = attempt > 1
    ? '\n\nIMPORTANTE: La respuesta anterior quedó incompleta. Sé extremadamente conciso en todos los strings, respeta los límites del schema y termina el JSON completo. No añadas texto fuera del JSON.'
    : ''

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: maxOutputTokens,
      input: [
        {
          role: 'system',
          content: [{
            type: 'input_text',
            text: `${systemPrompt}${retryHint}`,
          }],
        },
        { role: 'user', content: [{ type: 'input_text', text: prompt }] },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new OpenAIRequestError(response.status, text)
  }
  const data = await response.json()
  return { data, outputText: getOutputText(data) }
}

async function requestCheapInferenceStructured<T>(args: {
  prompt: string
  schemaName: string
  schema: Record<string, unknown>
  maxOutputTokens: number
  systemPrompt: string
  maxAttempts: number
}): Promise<{ data: T; model: string }> {
  const apiKey = process.env.CHEAPINFERENCE_API_KEY
  const baseUrl = process.env.CHEAPINFERENCE_BASE_URL || 'https://api.cheaperinference.com/v1'
  const model = process.env.CHEAPINFERENCE_MODEL || 'deepseek-v4-flash-0731'
  if (!apiKey) throw new Error('CHEAPINFERENCE_API_KEY is not configured')

  let tokenBudget = Math.max(1200, args.maxOutputTokens)
  let lastError = ''

  for (let attempt = 1; attempt <= args.maxAttempts; attempt++) {
    const retryHint = attempt > 1
      ? '\n\nLa respuesta anterior no cumplió el JSON solicitado. Devuelve un JSON COMPLETO, conciso y sin Markdown.'
      : ''
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: tokenBudget,
        messages: [
          {
            role: 'system',
            content: `${args.systemPrompt}\n\nDevuelve SOLO JSON válido, sin bloques Markdown. Respeta estrictamente esta estructura JSON Schema para ${args.schemaName}: ${JSON.stringify(args.schema)}${retryHint}`,
          },
          { role: 'user', content: args.prompt },
        ],
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`CheaperInference ${response.status}: ${body.slice(0, 600)}`)
    }

    const payload = await response.json()
    const raw = payload?.choices?.[0]?.message?.content
    if (typeof raw !== 'string' || !raw.trim()) {
      lastError = 'CheaperInference no devolvió contenido JSON'
    } else {
      try {
        const parsed = parseJsonText(raw)
        const shapeError = validateSchemaShape(parsed, args.schema)
        if (shapeError) {
          lastError = `CheaperInference devolvió JSON con forma inválida: ${shapeError}`
        } else {
          return { data: parsed as T, model }
        }
      } catch (error) {
        lastError = `CheaperInference devolvió JSON inválido: ${error instanceof Error ? error.message : 'error de parseo'}`
      }
    }

    if (attempt < args.maxAttempts) {
      const nextBudget = Math.min(16000, Math.max(tokenBudget + 2500, Math.ceil(tokenBudget * 1.4)))
      console.warn(`[Comprende CheaperInference] ${args.schemaName}: intento ${attempt} inválido; reintentando con ${nextBudget} tokens. ${lastError}`)
      tokenBudget = nextBudget
    }
  }

  throw new Error(`${lastError}. CheaperInference reintentó automáticamente.`)
}

function describeIncomplete(data: any, outputText: string) {
  const reason = data?.incomplete_details?.reason || data?.status || 'unknown'
  const outputTokens = data?.usage?.output_tokens
  return `OpenAI devolvió una respuesta incompleta (${reason}${outputTokens ? `, ${outputTokens} tokens de salida` : ''}, ${outputText.length} caracteres)`
}

async function createOpenAIStructured<T>(
  prompt: string,
  schemaName: string,
  schema: Record<string, unknown>,
  options: StructuredResponseOptions,
): Promise<{ data: T; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const model = options.model || process.env.OPENAI_MODEL || 'gpt-5.6-luna'
  const systemPrompt = options.systemPrompt || 'Eres un tutor universitario en español. Tu prioridad es comprensión rápida, claridad conceptual y fidelidad a la evidencia suministrada. Nunca inventes información que contradiga la evidencia.'
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts || 2, 3))
  let tokenBudget = Math.max(1200, options.maxOutputTokens || 3600)
  let lastError = ''

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, outputText } = await requestStructuredResponse({
      apiKey,
      model,
      prompt,
      schemaName,
      schema,
      maxOutputTokens: tokenBudget,
      systemPrompt,
      attempt,
    })

    if (!outputText) {
      lastError = data?.status === 'incomplete'
        ? describeIncomplete(data, outputText)
        : 'OpenAI returned no output text'
    } else if (data?.status === 'incomplete') {
      lastError = describeIncomplete(data, outputText)
    } else {
      try {
        const parsed = JSON.parse(outputText)
        const shapeError = validateSchemaShape(parsed, schema)
        if (shapeError) {
          lastError = `OpenAI devolvió JSON con forma inválida: ${shapeError}`
        } else {
          return { data: parsed as T, model }
        }
      } catch (error) {
        const parseMessage = error instanceof Error ? error.message : 'JSON inválido'
        lastError = `OpenAI devolvió JSON incompleto o inválido: ${parseMessage} (${outputText.length} caracteres)`
      }
    }

    if (attempt < maxAttempts) {
      const nextBudget = Math.min(16000, Math.max(tokenBudget + 3500, Math.ceil(tokenBudget * 1.55)))
      console.warn(`[Comprende OpenAI] ${schemaName}: intento ${attempt} incompleto; reintentando con ${nextBudget} tokens. ${lastError}`)
      tokenBudget = nextBudget
      continue
    }
  }

  throw new Error(`${lastError}. Comprende reintentó automáticamente; vuelve a intentarlo si persiste.`)
}

export async function createStructuredResponseWithMeta<T = any>(
  prompt: string,
  schemaName: string,
  schema: Record<string, unknown>,
  options: StructuredResponseOptions = {},
): Promise<StructuredResponseResult<T>> {
  const systemPrompt = options.systemPrompt || 'Eres un tutor universitario en español. Tu prioridad es comprensión rápida, claridad conceptual y fidelidad a la evidencia suministrada. Nunca inventes información que contradiga la evidencia.'
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts || 2, 3))
  const tokenBudget = Math.max(1200, options.maxOutputTokens || 3600)
  const allowFallback = options.allowCheapInferenceFallback !== false

  let openAIError: unknown
  try {
    const primary = await createOpenAIStructured<T>(prompt, schemaName, schema, options)
    return { data: primary.data, meta: { provider: 'openai', model: primary.model } }
  } catch (error) {
    openAIError = error
    if (!allowFallback || !isFallbackEligible(error) && !/OPENAI_API_KEY is not configured/i.test(error instanceof Error ? error.message : '')) {
      throw error
    }
  }

  const reason = fallbackReason(openAIError)
  console.warn(`[Comprende AI Router] ${schemaName}: ${reason}. Activando CheaperInference.`)

  try {
    const fallback = await requestCheapInferenceStructured<T>({
      prompt,
      schemaName,
      schema,
      maxOutputTokens: tokenBudget,
      systemPrompt,
      maxAttempts,
    })
    return {
      data: fallback.data,
      meta: {
        provider: 'cheapinference',
        model: fallback.model,
        fallbackFrom: 'openai',
        fallbackReason: reason,
      },
    }
  } catch (cheapError) {
    const openMessage = openAIError instanceof Error ? openAIError.message : 'OpenAI unavailable'
    const cheapMessage = cheapError instanceof Error ? cheapError.message : 'CheaperInference unavailable'
    throw new Error(`OpenAI no disponible (${reason}) y el respaldo CheaperInference también falló. OpenAI: ${openMessage.slice(0, 260)} | CheaperInference: ${cheapMessage.slice(0, 260)}`)
  }
}

export async function createStructuredResponse<T = any>(
  prompt: string,
  schemaName: string,
  schema: Record<string, unknown>,
  options: StructuredResponseOptions = {},
) {
  const result = await createStructuredResponseWithMeta<T>(prompt, schemaName, schema, options)
  return result.data
}
