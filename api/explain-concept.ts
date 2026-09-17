import { createStructuredResponse } from './_openai'
import { hashObject, readAiCache, writeAiCache } from './_supabase'

const PROMPT_VERSION = 'concept-explanation-v1.4'

const explanationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'purpose', 'example', 'analogy', 'keyIdea', 'misconception', 'context'],
  properties: {
    summary: { type: 'string' },
    purpose: { type: 'string' },
    example: { type: 'string' },
    analogy: { type: 'string' },
    keyIdea: { type: 'string' },
    misconception: { type: 'string' },
    context: { type: 'string' },
  },
}

type Variant = 'default' | 'simpler' | 'new-example' | 'deep'

type Attribution = {
  provider: 'openai'
  model: string
  promptVersion: string
  generatedAt: string
  depth: 'quick' | 'advanced'
  sourceKind: 'document-grounded-with-model-expansion'
}

function variantInstruction(variant: Variant) {
  if (variant === 'simpler') {
    return 'Haz una segunda explicación todavía más simple. Reduce el vocabulario técnico al mínimo y usa frases más cortas. No infantilices al estudiante.'
  }
  if (variant === 'new-example') {
    return 'Conserva la precisión, pero usa un ejemplo cotidiano distinto y muy concreto. El ejemplo debe ser el centro de la explicación.'
  }
  if (variant === 'deep') {
    return `Esta es una explicación avanzada de rescate/profundización. No repitas la versión rápida. Haz explícitas las conexiones causales o lógicas, los prerrequisitos que suelen bloquear la comprensión, por qué el concepto importa dentro del tema y un ejemplo de transferencia. Distingue con claridad qué parte está respaldada por los fragmentos del documento y qué parte es una ampliación pedagógica del tutor. Mantén el texto digerible: profundidad no significa prosa larga.`
  }
  return 'Busca el equilibrio entre sencillez y precisión para una primera explicación.'
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { concept, materialName, excerpts, relatedConcepts, variant = 'default' } = req.body || {}
    if (!concept || !Array.isArray(excerpts) || !excerpts.length) {
      return res.status(400).json({ error: 'Missing concept or excerpts' })
    }

    const safeVariant: Variant = ['simpler', 'new-example', 'deep'].includes(variant) ? variant : 'default'
    const quickModel = process.env.OPENAI_MODEL || 'gpt-5.6-luna'
    const deepModel = process.env.OPENAI_DEEP_MODEL || 'gpt-5.6-sol'
    const modelId = safeVariant === 'deep' ? deepModel : quickModel
    const depth: Attribution['depth'] = safeVariant === 'deep' ? 'advanced' : 'quick'
    const sourceHash = hashObject({ concept, materialName, excerpts: excerpts.slice(0, 6), relatedConcepts, variant: safeVariant })
    const cacheKey = `explain:${PROMPT_VERSION}:${modelId}:${sourceHash}`
    const forceRefresh = Boolean(req.body?.forceRefresh)
    if (!forceRefresh) {
      const cached = await readAiCache<any>(cacheKey)
      if (cached?.explanation) return res.status(200).json({ ...cached, cached: true })
    }

    const prompt = `Explícale el concepto "${concept}" a un estudiante de maestría que acaba de verlo y todavía no logra formar una imagen mental clara.

MATERIAL DE CONTEXTO: ${materialName || 'Documento'}

FRAGMENTOS REALES DEL MATERIAL:
${excerpts.slice(0, 6).map((x: string, i: number) => `[${i + 1}] ${x}`).join('\n\n')}

CONCEPTOS RELACIONADOS DETECTADOS:
${Array.isArray(relatedConcepts) ? relatedConcepts.join(', ') : ''}

OBJETIVO PEDAGÓGICO:
- Explica EL CONCEPTO, no la redacción del PDF.
- Si el término es amplio o ambiguo, infiere el sentido que tiene dentro de los fragmentos y explícalo en ese contexto.
- El documento es la fuente académica primaria. Puedes usar conocimiento general únicamente para volverlo comprensible o conectar ideas, pero NO lo presentes como si estuviera escrito en el documento.
- Si amplías más allá de los fragmentos, haz que context indique claramente que se trata de una ampliación pedagógica.
- No contradigas el material.
- No empieces con frases vacías como "es una idea que necesitas comprender", "en tu material se expresa" o "debes poder describirlo".
- No uses la definición formal como explicación sencilla.
- No menciones que eres una IA ni hables del proceso de generación dentro de los campos.
- Español mexicano claro, natural y universitario.
- ${variantInstruction(safeVariant)}

FORMATO DE CADA CAMPO:
- summary: 2 a 4 frases. Empieza directamente con "${concept}..." o con una definición natural equivalente. Debe responder qué es.
- purpose: 1 a 2 frases. Responde para qué sirve o por qué importa.
- example: un ejemplo cotidiano o académico concreto, de máximo 90 palabras.
- analogy: una analogía corta que cree una imagen mental útil.
- keyIdea: una sola frase que valga la pena recordar al día siguiente.
- misconception: el error conceptual más probable al empezar.
- context: 1 a 3 frases. Primero conecta con lo que sí aparece en los fragmentos. Si agregaste una ampliación general útil, indícalo con una frase como "Ampliación de Comprende: ...".

Evita repetir la misma idea en varios campos.`

    const explanation = await createStructuredResponse(prompt, safeVariant === 'deep' ? 'concept_explanation_advanced' : 'concept_explanation', explanationSchema, {
      maxOutputTokens: safeVariant === 'deep' ? 2200 : 1600,
      model: modelId,
      systemPrompt: safeVariant === 'deep'
        ? 'Eres un tutor universitario senior de IA y ciencia de datos. Tu trabajo es rescatar conceptos que no hicieron clic: diagnosticas el bloqueo, conectas prerrequisitos, explicas mecanismos y transfieres la idea a otro contexto. Mantienes fidelidad estricta a la evidencia y marcas como ampliación cualquier conocimiento externo al documento.'
        : 'Eres un tutor universitario excepcionalmente claro. Explicas conceptos difíciles como en un pizarrón: primero una idea mental simple, luego un ejemplo, después la precisión. Tu prioridad es que el estudiante diga “ah, ya entendí”.',
    })

    const attribution: Attribution = {
      provider: 'openai',
      model: modelId,
      promptVersion: PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
      depth,
      sourceKind: 'document-grounded-with-model-expansion',
    }
    const payload = { explanation, attribution }
    await writeAiCache({
      cacheKey,
      artifactKind: safeVariant === 'deep' ? 'concept_explanation_advanced' : 'concept_explanation',
      sourceHash,
      promptVersion: PROMPT_VERSION,
      modelId,
      payload,
      metadata: { concept, materialName: materialName || '', variant: safeVariant, provider: 'openai', depth },
    })
    return res.status(200).json({ ...payload, cached: false })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Could not explain concept' })
  }
}
