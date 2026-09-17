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

type StructuredResponseOptions = {
  maxOutputTokens?: number
  systemPrompt?: string
  model?: string
  maxAttempts?: number
}

type AttemptResult = {
  data: any
  outputText: string
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
    throw new Error(`OpenAI ${response.status}: ${text.slice(0, 600)}`)
  }
  const data = await response.json()
  return { data, outputText: getOutputText(data) }
}

function describeIncomplete(data: any, outputText: string) {
  const reason = data?.incomplete_details?.reason || data?.status || 'unknown'
  const outputTokens = data?.usage?.output_tokens
  return `OpenAI devolvió una respuesta incompleta (${reason}${outputTokens ? `, ${outputTokens} tokens de salida` : ''}, ${outputText.length} caracteres)`
}

export async function createStructuredResponse(
  prompt: string,
  schemaName: string,
  schema: Record<string, unknown>,
  options: StructuredResponseOptions = {},
) {
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
        return JSON.parse(outputText)
      } catch (error) {
        const parseMessage = error instanceof Error ? error.message : 'JSON inválido'
        lastError = `OpenAI devolvió JSON incompleto o inválido: ${parseMessage} (${outputText.length} caracteres)`
      }
    }

    if (attempt < maxAttempts) {
      // Structured Outputs sigue pudiendo quedar truncado si max_output_tokens se agota.
      // Aumentamos el presupuesto una sola vez y pedimos una respuesta más concisa.
      const nextBudget = Math.min(16000, Math.max(tokenBudget + 3500, Math.ceil(tokenBudget * 1.55)))
      console.warn(`[Comprende OpenAI] ${schemaName}: intento ${attempt} incompleto; reintentando con ${nextBudget} tokens. ${lastError}`)
      tokenBudget = nextBudget
      continue
    }
  }

  throw new Error(`${lastError}. Comprende reintentó automáticamente; vuelve a analizar el mapa si persiste.`)
}
