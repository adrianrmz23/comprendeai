import { createStructuredResponse } from './_openai.js'

const evaluationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['score','verdict','strengths','missing','misconception','nextAction'],
  properties: {
    score: { type: 'number' },
    verdict: { type: 'string' },
    strengths: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
    missing: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
    misconception: { type: 'string' },
    nextAction: { type: 'string' },
  },
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { concept, answer, sourceEvidence, checklist } = req.body || {}
    if (!concept || !answer) return res.status(400).json({ error: 'Missing concept or answer' })

    const prompt = `Evalúa la explicación del estudiante sobre "${concept}". No premies estilo; evalúa comprensión.

RESPUESTA DEL ESTUDIANTE:
${answer}

EVIDENCIA FUENTE:
${Array.isArray(sourceEvidence) ? sourceEvidence.join('\n') : ''}

CRITERIOS ESPERADOS:
${Array.isArray(checklist) ? checklist.join('\n- ') : ''}

Asigna score 0-100. Señala fortalezas concretas, ideas ausentes, una posible confusión (o indica que no observas una confusión importante) y exactamente una siguiente acción breve. No exijas que copie la fuente literalmente.`

    const evaluation = await createStructuredResponse(prompt, 'recall_evaluation', evaluationSchema)
    return res.status(200).json({ evaluation })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Could not evaluate explanation' })
  }
}
