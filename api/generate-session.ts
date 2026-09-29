import { createStructuredResponseWithMeta } from './_openai.js'
import { hashObject, readAiCache, writeAiCache } from './_supabase.js'

const PROMPT_VERSION = 'study-session-v2.0.9-lean-exam'

const termSchema = {
  type: 'object', additionalProperties: false, required: ['term', 'meaning'],
  properties: { term: { type: 'string' }, meaning: { type: 'string' } },
}

const choiceCheckSchema = {
  type: 'object', additionalProperties: false, required: ['question', 'choices', 'correctIndex', 'explanation'],
  properties: {
    question: { type: 'string' },
    choices: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'string' } },
    correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
    explanation: { type: 'string' },
  },
}

const sessionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['concept','objective','estimatedMinutes','hook','intuition','visual','formal','guided','solo','finalExam','teachBack','rescue'],
  properties: {
    concept: { type: 'string' },
    objective: { type: 'string' },
    estimatedMinutes: { type: 'number' },
    hook: {
      type: 'object', additionalProperties: false, required: ['scenario','question','reveal'],
      properties: { scenario: { type: 'string' }, question: { type: 'string' }, reveal: { type: 'string' } },
    },
    intuition: {
      type: 'object', additionalProperties: false, required: ['summary','purpose','example','analogy','keyIdea','misconception','context'],
      properties: { summary: { type: 'string' }, purpose: { type: 'string' }, example: { type: 'string' }, analogy: { type: 'string' }, keyIdea: { type: 'string' }, misconception: { type: 'string' }, context: { type: 'string' } },
    },
    visual: {
      type: 'object', additionalProperties: false, required: ['title','purpose','worldExample','items','check'],
      properties: {
        title: { type: 'string' },
        purpose: { type: 'string' },
        worldExample: {
          type: 'object', additionalProperties: false, required: ['title','context','decision'],
          properties: { title: { type: 'string' }, context: { type: 'string' }, decision: { type: 'string' } },
        },
        items: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['label','detail'], properties: { label: { type: 'string' }, detail: { type: 'string' } } } },
        check: choiceCheckSchema,
      },
    },
    formal: {
      type: 'object', additionalProperties: false, required: ['definition','terms','sourceEvidence'],
      properties: {
        definition: { type: 'string' },
        terms: { type: 'array', minItems: 2, maxItems: 5, items: termSchema },
        sourceEvidence: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } },
      },
    },
    guided: {
      type: 'object', additionalProperties: false, required: ['prompt','scenario','goal','steps','takeaway'],
      properties: {
        prompt: { type: 'string' }, scenario: { type: 'string' }, goal: { type: 'string' },
        steps: { type: 'array', minItems: 3, maxItems: 4, items: {
          type: 'object', additionalProperties: false, required: ['prompt','choices','correctIndex','hint','explanation'],
          properties: {
            prompt: { type: 'string' }, choices: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'string' } },
            correctIndex: { type: 'integer', minimum: 0, maximum: 3 }, hint: { type: 'string' }, explanation: { type: 'string' },
          },
        } },
        takeaway: { type: 'string' },
      },
    },
    solo: {
      type: 'object', additionalProperties: false, required: ['intro','startIndex','exercises'],
      properties: {
        intro: { type: 'string' }, startIndex: { type: 'integer', minimum: 0, maximum: 3 },
        exercises: { type: 'array', minItems: 4, maxItems: 5, items: {
          type: 'object', additionalProperties: false, required: ['id','level','scenario','question','choices','correctIndex','explanation'],
          properties: {
            id: { type: 'string' }, level: { type: 'string', enum: ['refuerzo','aplicacion','examen','transferencia'] },
            scenario: { type: 'string' }, question: { type: 'string' },
            choices: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
            correctIndex: { type: 'integer', minimum: 0, maximum: 3 }, explanation: { type: 'string' },
          },
        } },
      },
    },
    finalExam: {
      type: 'object', additionalProperties: false, required: ['intro','passScore','questions'],
      properties: {
        intro: { type: 'string' },
        passScore: { type: 'integer', minimum: 60, maximum: 80 },
        questions: { type: 'array', minItems: 6, maxItems: 6, items: {
          type: 'object', additionalProperties: false, required: ['id','kind','context','formula','prompt','choices','correctIndex','explanation'],
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: ['concepto','aplicacion','formula','interpretacion','transferencia','error_comun'] },
            context: { type: 'string' },
            formula: { type: 'string' },
            prompt: { type: 'string' },
            choices: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
            correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
            explanation: { type: 'string' },
          },
        } },
      },
    },
    teachBack: {
      type: 'object', additionalProperties: false, required: ['prompt','checklist'],
      properties: { prompt: { type: 'string' }, checklist: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string' } } },
    },
    rescue: {
      type: 'object', additionalProperties: false, required: ['terms','formula','use','prereq'],
      properties: { terms: { type: 'string' }, formula: { type: 'string' }, use: { type: 'string' }, prereq: { type: 'string' } },
    },
  },
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { concept, materialName, excerpts, previousConcepts } = req.body || {}
    if (!concept || !Array.isArray(excerpts) || !excerpts.length) return res.status(400).json({ error: 'Missing concept or excerpts' })

    const modelId = process.env.OPENAI_MODEL || 'gpt-5.6-luna'
    const sourceHash = hashObject({ concept, materialName, excerpts: excerpts.slice(0, 6), previousConcepts })
    const cacheKey = `session:${PROMPT_VERSION}:${modelId}:${sourceHash}`
    if (!req.body?.forceRefresh) {
      const cached = await readAiCache<any>(cacheKey)
      if (cached?.session) return res.status(200).json({ ...cached, cached: true })
    }

    const prompt = `Crea una sesión de aprendizaje interactiva de 15 a 22 minutos para el concepto "${concept}" a partir del material "${materialName || 'Documento'}".

EVIDENCIA DEL MATERIAL:
${excerpts.map((x: string, i: number) => `[${i + 1}] ${x}`).join('\n\n')}

TEMAS ANTERIORES YA DISPONIBLES PARA CONEXIONES:
${Array.isArray(previousConcepts) && previousConcepts.length ? previousConcepts.join(', ') : 'Ninguno: este concepto no debe depender de temas posteriores.'}

OBJETIVO DE LA SESIÓN
La ruta visible será: ENTENDER → CASO REAL → LABORATORIO (si aplica) → GUIADO → PRÁCTICA → EXAMEN FINAL. "Problema" y "Formal" ya no aparecen como pasos separados; sus ideas útiles deben integrarse de manera natural en las secciones activas y en el examen final.

Reglas generales:
- Español mexicano claro, universitario, concreto y breve.
- No conviertas la sesión en un resumen largo.
- La explicación intuitiva debe ser autosuficiente y poder leerse antes del problema.
- formal.definition y formal.sourceEvidence deben ser fieles al material. No inventes afirmaciones académicas ni datos como si vinieran del PDF.
- Puedes crear escenarios ilustrativos realistas fuera del documento para enseñar; cuando uses números inventados, que sean simples y obviamente pedagógicos, no atribuidos al documento.
- Evita frases vacías como “es una idea que necesitas comprender”.
- Ningún campo de prosa debe superar ~90 palabras.

VERLO EN ACCIÓN:
- visual.purpose explica en una frase PARA QUÉ existe ese paso.
- visual.worldExample debe ser un caso realista y reconocible: salud, fraude, spam, conducción autónoma, sensores, recomendadores, finanzas, robótica, lenguaje, industria, etc., eligiendo el dominio que mejor encaje con el concepto.
- visual.items deben mostrar cómo fluye el concepto dentro del caso, no repetir una definición.
- visual.check debe ser una pregunta conceptual breve de 3-4 opciones para comprobar que el estudiante entendió lo que acaba de ver.

RESUÉLVELO CONMIGO:
- guided.scenario debe reutilizar o profundizar un caso real.
- guided.goal debe decir qué habilidad concreta se practicará.
- Cada guided.step debe ser una microdecisión con 3-4 opciones, correctIndex, una pista útil y explicación de por qué la respuesta es correcta.
- Los pasos deben avanzar: identificar información → elegir relación/método → interpretar resultado. No pidas copiar frases del material.

PRACTICA TÚ (ADAPTATIVO):
- Crea exactamente 4 ejercicios, uno por nivel: refuerzo, aplicacion, examen y transferencia.
- startIndex debe ser 1 para empezar en aplicación.
- Cada ejercicio debe tener un escenario realista distinto o progresivamente más difícil.
- Las 4 opciones deben ser plausibles; evita que la correcta sea obvia por longitud o redacción.
- “transferencia” debe aplicar la misma idea en un dominio distinto al ejemplo principal.
- explanation debe enseñar el razonamiento, no solo decir “correcto”.

OTRAS REGLAS:
- intuition.summary: qué es en 2-4 frases.
- intuition.purpose: para qué sirve.
- intuition.example: ejemplo concreto corto.
- intuition.context: conecta con el sentido de los fragmentos.
- formal.sourceEvidence debe reutilizar literalmente 1-3 fragmentos proporcionados.
EXAMEN FINAL:
- finalExam debe tener exactamente 6 preguntas de opción múltiple con 4 opciones plausibles cada una.
- passScore debe ser 70.
- No repitas literalmente las preguntas de guided o solo: evalúa la misma idea con situaciones nuevas.
- Cubre, en conjunto: significado del concepto, cuándo usarlo, aplicación, interpretación, un error común y transferencia.
- Si la evidencia contiene una fórmula o cálculo central, incluye 1 o 2 preguntas kind="formula". En formula escribe la expresión necesaria y pregunta por significado de variables, sustitución simple o interpretación del resultado.
- Si la evidencia NO contiene una fórmula central, NO inventes una: sustituye esas preguntas por interpretación o error_comun y deja formula="".
- Las preguntas solo pueden usar el concepto actual, la evidencia proporcionada y, opcionalmente, los TEMAS ANTERIORES listados arriba. Nunca exijas un concepto posterior del documento.
- explanation debe explicar por qué la opción correcta lo es y por qué el error típico falla, sin revelar la respuesta antes de enviar el examen.
- context debe ser breve; puede ser "" si la pregunta no necesita escenario.
- ids únicos y estables, por ejemplo final-1 ... final-6.

COMPATIBILIDAD INTERNA:
- formal y hook siguen presentes en el objeto porque apoyan rescates, trazabilidad y compatibilidad con sesiones guardadas, pero NO diseñes esos campos como pasos de estudio independientes. Sé breve.
- teachBack se conserva solo por compatibilidad histórica; mantenlo breve porque la interfaz nueva usa finalExam.
- rescates cambian de estrategia según términos, fórmula, cuándo usarlo y prerrequisitos.`

    const routed = await createStructuredResponseWithMeta<any>(prompt, 'study_session_v8', sessionSchema, {
      maxOutputTokens: 5600,
      model: modelId,
      systemPrompt: 'Eres un tutor universitario de IA experto en aprendizaje activo. Diseñas una ruta corta: comprender, ver un caso real, practicar con apoyo, practicar solo y cerrar con un examen de opción múltiple. Las fórmulas solo se evalúan cuando la evidencia realmente las contiene. Nunca adelantas conceptos posteriores del documento. Las definiciones formales se mantienen fieles a la evidencia; los ejemplos externos se presentan como escenarios pedagógicos, no como contenido del documento.',
    })
    const session = routed.data
    const attribution = {
      provider: routed.meta.provider,
      model: routed.meta.model,
      promptVersion: PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
      depth: 'quick',
      sourceKind: 'document-grounded-with-model-expansion',
      ...(routed.meta.fallbackFrom ? { fallbackFrom: routed.meta.fallbackFrom } : {}),
      ...(routed.meta.fallbackReason ? { fallbackReason: routed.meta.fallbackReason } : {}),
    }
    const payload = { session, attribution }
    await writeAiCache({
      cacheKey,
      artifactKind: 'study_session',
      sourceHash,
      promptVersion: PROMPT_VERSION,
      modelId: `${routed.meta.provider}:${routed.meta.model}`,
      payload,
      metadata: { concept, materialName: materialName || '', provider: routed.meta.provider, depth: 'quick', fallbackReason: routed.meta.fallbackReason || '' },
    })
    return res.status(200).json({ ...payload, cached: false })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Could not generate session' })
  }
}
