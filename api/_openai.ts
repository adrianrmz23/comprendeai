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
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: options.maxOutputTokens || 3600,
      input: [
        {
          role: 'system',
          content: [{
            type: 'input_text',
            text: options.systemPrompt || 'Eres un tutor universitario en español. Tu prioridad es comprensión rápida, claridad conceptual y fidelidad a la evidencia suministrada. Nunca inventes información que contradiga la evidencia.',
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
    throw new Error(`OpenAI ${response.status}: ${text.slice(0, 400)}`)
  }
  const data = await response.json()
  const outputText = getOutputText(data)
  if (!outputText) throw new Error('OpenAI returned no output text')
  return JSON.parse(outputText)
}
