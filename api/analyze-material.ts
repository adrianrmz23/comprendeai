import { createStructuredResponse } from './_openai.js'
import { cosine, embedWithHuggingFace } from './_huggingface.js'
import { hashObject, readAiCache, writeAiCache } from './_supabase.js'

const PROMPT_VERSION = 'semantic-map-v2.0.3-bounded-json'

type Chunk = { id: string; page: number | null; text: string }
type LocalCandidate = { label: string; score: number; snippet: string }

function selectByClusters(chunks: Chunk[], vectors: number[][]) {
  const clusters: { centroid: number[]; members: number[] }[] = []
  vectors.forEach((vector, index) => {
    let best = -1
    let bestScore = -1
    clusters.forEach((cluster, clusterIndex) => {
      const score = cosine(vector, cluster.centroid)
      if (score > bestScore) { bestScore = score; best = clusterIndex }
    })
    if (best >= 0 && bestScore >= 0.72) {
      const cluster = clusters[best]
      cluster.members.push(index)
      const count = cluster.members.length
      cluster.centroid = cluster.centroid.map((value, i) => ((value * (count - 1)) + vector[i]) / count)
    } else {
      clusters.push({ centroid: [...vector], members: [index] })
    }
  })

  const ranked = clusters
    .map((cluster, clusterIndex) => ({ clusterIndex, members: cluster.members, size: cluster.members.length }))
    .sort((a, b) => b.size - a.size)

  const selected: { cluster: number; chunk: Chunk }[] = []
  for (const cluster of ranked.slice(0, 14)) {
    // Primer elemento + uno adicional en clusters grandes para conservar matices.
    const memberIndexes = cluster.members.length > 4
      ? [cluster.members[0], cluster.members[Math.floor(cluster.members.length / 2)]]
      : [cluster.members[0]]
    memberIndexes.forEach(index => selected.push({ cluster: cluster.clusterIndex + 1, chunk: chunks[index] }))
  }
  return { clusters, selected: selected.slice(0, 22) }
}

const conceptSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['documentSummary', 'concepts', 'relations', 'learningOrder'],
  properties: {
    documentSummary: { type: 'string' },
    concepts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['label', 'description', 'category', 'tier', 'importance', 'studyQuestion', 'parent', 'prerequisites', 'related', 'pages', 'evidence', 'lab'],
        properties: {
          label: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string', enum: ['principal', 'subconcept', 'foundation', 'application'] },
          tier: { type: 'string', enum: ['essential', 'deep'] },
          importance: { type: 'integer', minimum: 1, maximum: 100 },
          studyQuestion: { type: 'string' },
          parent: { type: 'string' },
          prerequisites: { type: 'array', items: { type: 'string' } },
          related: { type: 'array', items: { type: 'string' } },
          pages: { type: 'array', items: { type: 'integer', minimum: 1 } },
          evidence: { type: 'array', items: { type: 'string' } },
          lab: {
            type: 'object', additionalProperties: false,
            required: ['recommended', 'engine', 'labType', 'genericTemplate', 'practiceMode', 'priority', 'reason', 'confidence'],
            properties: {
              recommended: { type: 'boolean' },
              engine: { type: 'string', enum: ['none','specialized','composed'] },
              labType: { type: 'string', enum: ['none','generic','bayes','bayesian-network','hmm','fuzzy','conditional-probability','distribution','monte-carlo','naive-bayes','dempster-shafer','regression','classification'] },
              genericTemplate: { type: 'string', enum: ['none','parameter-explorer','process-stepper','relationship-map','classification-sort','sequence-builder','comparison','matrix-explorer','truth-table','concept-simulator'] },
              practiceMode: { type: 'string', enum: ['none','simulation','visualization','builder','experiment','step_by_step','case'] },
              priority: { type: 'string', enum: ['none','high','medium','low'] },
              reason: { type: 'string' },
              confidence: { type: 'integer', minimum: 0, maximum: 100 },
            },
          },
        },
      },
    },
    relations: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['source', 'target', 'type'],
        properties: {
          source: { type: 'string' }, target: { type: 'string' },
          type: { type: 'string', enum: ['requires', 'part_of', 'related_to', 'applies_to'] },
        },
      },
    },
    learningOrder: { type: 'array', items: { type: 'string' } },
  },
} as const

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const body = req.body || {}
  const chunks = (Array.isArray(body.chunks) ? body.chunks : [])
    .filter((chunk: any) => typeof chunk?.text === 'string' && chunk.text.trim().length > 80)
    .slice(0, 42) as Chunk[]
  const localCandidates = (Array.isArray(body.localCandidates) ? body.localCandidates : []).slice(0, 24) as LocalCandidate[]
  if (!chunks.length) return res.status(400).json({ error: 'No semantic chunks supplied' })
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured; local semantic map remains available.' })

  const modelId = process.env.OPENAI_MODEL || 'gpt-5.6-luna'
  const hfModelConfigured = process.env.HF_EMBEDDING_MODEL || 'BAAI/bge-m3'
  const sourceHash = hashObject({ materialName: body.materialName || '', chunks, localCandidates, hfModelConfigured, hfEnabled: Boolean(process.env.HF_TOKEN) })
  const cacheKey = `semantic:${PROMPT_VERSION}:${modelId}:${sourceHash}`
  if (!body.forceRefresh) {
    const cached = await readAiCache<any>(cacheKey)
    if (cached?.analysis) return res.status(200).json({ ...cached, cached: true })
  }

  let selected = chunks.slice(0, 22).map((chunk, index) => ({ cluster: index + 1, chunk }))
  let hfModel = ''
  let hfWarning = ''
  let clusterCount = 0

  if (process.env.HF_TOKEN) {
    try {
      const embedded = await embedWithHuggingFace(chunks.map(chunk => chunk.text.slice(0, 1800)))
      hfModel = embedded.model
      const clustered = selectByClusters(chunks, embedded.vectors)
      selected = clustered.selected
      clusterCount = clustered.clusters.length
    } catch (error) {
      hfWarning = error instanceof Error ? `Hugging Face no estuvo disponible: ${error.message}` : 'Hugging Face no estuvo disponible.'
    }
  } else {
    hfWarning = 'HF_TOKEN no está configurado; el mapa usa OpenAI sobre una muestra estratificada de chunks.'
  }

  // Cobertura del Bloque 7: además de los representantes semánticos, conservamos
  // anclas de página para evitar que se pierdan secciones menos repetidas pero
  // pedagógicamente explícitas (glosarios, apartados finales, algoritmos, etc.).
  const seen = new Set(selected.map(item => item.chunk.id))
  const pageAnchors: { cluster: number; chunk: Chunk }[] = []
  const seenPages = new Set<number | null>()
  chunks.forEach((chunk, index) => {
    if (seenPages.has(chunk.page)) return
    seenPages.add(chunk.page)
    if (!seen.has(chunk.id)) pageAnchors.push({ cluster: 100 + index, chunk })
  })
  selected = [...selected, ...pageAnchors].slice(0, 32)

  const evidence = selected.map(({ cluster, chunk }) =>
    `[CLUSTER ${cluster} · ${chunk.page ? `PÁGINA ${chunk.page}` : 'SIN PÁGINA'} · ${chunk.id}]\n${chunk.text.slice(0, 1500)}`,
  ).join('\n\n')
  const candidates = localCandidates.map(c => `- ${c.label} (${c.score}): ${c.snippet.slice(0, 180)}`).join('\n')

  const prompt = `Analiza pedagógicamente el documento "${String(body.materialName || 'material')}" para una maestría en IA y Ciencia de Datos.

OBJETIVO
Construye un mapa de conocimiento de dos niveles para APRENDER, no un resumen ni un índice copiado. El primer nivel debe conservar una ruta esencial corta; el segundo puede guardar detalles útiles dentro de conceptos mayores.

REGLAS DE COBERTURA
- Usa exclusivamente la evidencia incluida. No inventes conceptos solo porque sean comunes en la materia.
- Haz una auditoría explícita de cobertura: presta especial atención a títulos/secciones, objetivos, fórmulas definidas, glosarios, tablas de componentes, algoritmos nombrados y ejercicios. Si una idea tiene un apartado propio o se define como requisito de otra, no la omitas solo por aparecer pocas veces.
- Devuelve entre 12 y 20 conceptos cuando la evidencia lo sostenga. Debe haber aproximadamente 9–14 conceptos tier="essential" y el resto tier="deep". Mantén las descripciones muy concisas: 1–2 frases por concepto.
- "essential" = necesario para recorrer el tema sin huecos conceptuales. "deep" = detalle interno, algoritmo, componente o extensión que conviene descubrir al abrir un concepto mayor.
- Prefiere términos específicos (p. ej. "probabilidad condicional", "independencia condicional") frente a palabras genéricas (p. ej. "probabilidad") cuando la evidencia lo sostenga.
- Fusiona variantes y duplicados del mismo concepto. No unas conceptos distintos solo porque comparten una palabra.

CLASIFICACIÓN PEDAGÓGICA
- "foundation" = base previa o idea que conviene dominar antes.
- "principal" = idea troncal del documento.
- "subconcept" = componente, mecanismo, algoritmo o parte interna de otra idea.
- "application" = uso, caso práctico o consecuencia.
- parent debe ser el nombre exacto de un concepto incluido o cadena vacía. Usa parent de forma activa para construir submapas: por ejemplo, algoritmos de HMM pueden colgar de "Modelos Ocultos de Markov" si la evidencia lo sostiene.
- prerequisites debe expresar dependencias reales de comprensión. No confundas "se relaciona con" con "requiere".
- related debe contener conexiones útiles no jerárquicas.
- DIRECCIÓN DE RELACIONES: requires significa source="concepto que depende" y target="prerrequisito". part_of se renderiza como "contiene / agrupa", por lo que source DEBE ser el concepto amplio/padre y target el componente/hijo. Ejemplo correcto: "Métodos de Monte Carlo" part_of "MCMC", nunca al revés.
- No modeles Naive Bayes como parte de Redes Bayesianas: si ambos aparecen, normalmente son conceptos relacionados que comparten Bayes e independencia condicional, salvo que la evidencia del documento establezca explícitamente una jerarquía distinta.
- studyQuestion debe ser una pregunta breve que compruebe comprensión conceptual, no memoria literal.
- pages solo puede contener números de página visibles en la evidencia. Si no hay página, usa [].
- evidence: exactamente 1 fragmento corto (máximo una o dos frases) para justificar el concepto; no copies párrafos largos.

LABORATORIOS AUTOMÁTICOS
Para CADA concepto decide si un laboratorio realmente mejora la comprensión. El usuario no elegirá manualmente el tipo: tu recomendación se convierte directamente en la experiencia de Comprende.
- recommended=true SOLO si el concepto implica variables manipulables, simulación, un proceso paso a paso, una estructura editable, clasificación/ordenamiento, comparación significativa o un trade-off que se entienda mejor experimentando.
- Si recommended=false usa engine="none", labType="none", genericTemplate="none", practiceMode="none", priority="none".
- NIVEL 1: si existe uno de los motores especializados siguientes y encaja de forma clara, usa engine="specialized", genericTemplate="none" y ese labType. NO inventes nombres ni código:
  * bayes: Teorema de Bayes, posterior/prior, actualización bayesiana.
  * conditional-probability: probabilidad condicional e independencia condicional básica.
  * bayesian-network: redes bayesianas, CPT, propagación de evidencia.
  * naive-bayes: clasificador Naive Bayes.
  * hmm: Modelos Ocultos de Markov, Viterbi, transición/emisión.
  * fuzzy: lógica difusa, funciones de pertenencia, fuzzificación/defuzzificación.
  * monte-carlo: Monte Carlo y simulación estocástica por muestreo repetido.
  * dempster-shafer: teoría de la evidencia, Dempster-Shafer, ignorancia/conflicto.
  * distribution: distribución normal, distribuciones de probabilidad, desviación estándar, z-score.
  * regression: regresión lineal, mínimos cuadrados, residuos, R²/outliers.
  * classification: matriz de confusión, precision, recall, F1, sensibilidad/especificidad, umbral.
- NIVEL 2: si el concepto sí necesita interacción pero NO encaja con un motor especializado, usa engine="composed", labType="generic" y selecciona UNA genericTemplate:
  * parameter-explorer: variables/coeficientes/umbrales con relaciones cuantitativas respaldadas.
  * process-stepper: algoritmos, pipelines, procedimientos o transformaciones por etapas.
  * relationship-map: ontologías, redes semánticas, jerarquías, componentes y relaciones.
  * classification-sort: taxonomías, tipos, criterios de clasificación o diagnóstico conceptual.
  * sequence-builder: ciclos, estados, fases, orden temporal/causal.
  * comparison: métodos/arquitecturas/alternativas con condiciones de uso diferentes.
  * matrix-explorer: matrices, vectores, transformaciones o estructuras tabulares.
  * truth-table: lógica proposicional y operadores booleanos.
  * concept-simulator: último recurso cuando una combinación simple de representación + reto aporta valor.
- El Generic Lab Composer NO ejecuta código de IA: la IA solo producirá configuración declarativa validada. Por eso puedes recomendar generic para temas nuevos siempre que exista una interacción pedagógica real.
- Si un tema es principalmente histórico, definicional o discursivo y un laboratorio no mejora la comprensión, NO lo fuerces.
- Un concepto teórico general como "Historia de la IA" o "Naturaleza de la incertidumbre" normalmente NO necesita laboratorio.
- priority="high" cuando experimentar es central para comprender; "medium" cuando ayuda pero no es imprescindible; "low" cuando es complementario.
- reason debe explicar en una frase qué intuición construirá el laboratorio. No uses razones genéricas.
- confidence refleja qué tan claro es el encaje entre el concepto y uno de los motores disponibles.
- No elijas un laboratorio solo por coincidencia de una palabra. Por ejemplo "sensibilidad" dentro de una definición clínica no implica necesariamente classification si no se estudian métricas de clasificación.

ORDEN
- learningOrder debe contener SOLO conceptos tier="essential", con nombres exactos, y representar una secuencia pedagógica de dependencias: bases → ideas troncales → extensiones/aplicaciones.
- No fuerces una única cadena cuando existen ramas independientes. Aun así, entrega un orden lineal razonable para estudiar.
- importance mide relevancia para comprender ESTE documento, no popularidad general.

CONTROL DE CALIDAD
Antes de responder, revisa silenciosamente: (1) ¿quedó fuera alguna sección conceptual explícita?, (2) ¿hay un concepto que aparece como prerequisito pero no fue incluido?, (3) ¿algún detalle profundo está ocupando indebidamente un lugar en la ruta esencial?, (4) ¿las relaciones "requires" son realmente dependencias?, (5) ¿cada laboratorio recomendado aporta interacción real y usa un motor especializado o una plantilla componible válida?, (6) ¿evitaste forzar laboratorios en temas puramente expositivos?

CANDIDATOS HEURÍSTICOS (solo pistas, puedes corregirlos o descartarlos):
${candidates || '(sin candidatos)'}

EVIDENCIA REPRESENTATIVA + ANCLAS DE COBERTURA DEL DOCUMENTO:
${evidence}`

  try {
    const result = await createStructuredResponse(prompt, 'semantic_document_map', conceptSchema as any, {
      maxOutputTokens: 9000,
      systemPrompt: 'Eres un arquitecto de conocimiento y tutor universitario. Extraes estructura conceptual de documentos en español con extrema fidelidad a la evidencia. Construyes mapas de dos niveles: ruta esencial y detalles profundos. Priorizas conceptos enseñables, relaciones útiles y prerrequisitos reales; haces auditoría de cobertura y evitas palabras genéricas o taxonomías inventadas. Además eliges entre laboratorios especializados y plantillas componibles seguras. Para conceptos futuros puedes recomendar un Auto-Lab genérico, pero nunca código arbitrario ni una interacción sin valor pedagógico.',
    })

    const conceptNames = new Set((result.concepts || []).map((concept: any) => concept.label))
    const concepts = (result.concepts || []).filter((concept: any) => concept?.label && concept?.description)
    const relations = (result.relations || []).filter((relation: any) => conceptNames.has(relation.source) && conceptNames.has(relation.target) && relation.source !== relation.target)
    const learningOrder = (result.learningOrder || []).filter((label: string) => conceptNames.has(label))

    const payload = {
      analysis: {
        engine: hfModel ? 'hybrid' : 'openai',
        model: hfModel ? `${hfModel} + ${modelId}` : modelId,
        generatedAt: new Date().toISOString(),
        documentSummary: result.documentSummary,
        chunksAnalyzed: chunks.length,
        concepts,
        relations,
        learningOrder: learningOrder.length ? learningOrder : concepts.filter((concept: any) => concept.tier === 'essential').map((concept: any) => concept.label),
        warnings: [hfWarning, hfModel ? `BGE-M3 agrupó ${chunks.length} chunks en ${clusterCount} grupos semánticos antes del análisis pedagógico.` : ''].filter(Boolean),
        labPlannerVersion: '2.0.3',
      },
    }
    await writeAiCache({
      cacheKey,
      artifactKind: 'semantic_document_map',
      sourceHash,
      promptVersion: PROMPT_VERSION,
      modelId,
      payload,
      metadata: { materialName: String(body.materialName || ''), hfModel: hfModel || hfModelConfigured },
    })
    return res.status(200).json({ ...payload, cached: false })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Semantic analysis failed' })
  }
}
