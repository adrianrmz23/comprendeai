import { extractConcepts, findRelevantExcerpts, type StudyMaterial, type SemanticDocumentAnalysis, type SemanticConcept, type SemanticRelation } from './materials'
import { inferLabRecommendation } from './labs/registry'

export type SemanticChunk = {
  id: string
  page: number | null
  text: string
}

const normalize = (value: string) => value
  .toLocaleLowerCase('es-MX')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9ñ ]/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

function splitLongText(text: string, maxChars = 1250, overlap = 180) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''
  for (const paragraph of paragraphs) {
    if ((current + ' ' + paragraph).length <= maxChars) {
      current = `${current} ${paragraph}`.trim()
      continue
    }
    if (current) chunks.push(current)
    if (paragraph.length <= maxChars) {
      current = paragraph
      continue
    }
    let start = 0
    while (start < paragraph.length) {
      chunks.push(paragraph.slice(start, start + maxChars).trim())
      start += Math.max(300, maxChars - overlap)
    }
    current = ''
  }
  if (current) chunks.push(current)
  return chunks.filter(chunk => chunk.length > 120)
}

export function makeSemanticChunks(material: StudyMaterial, maxChunks = 48): SemanticChunk[] {
  const pages = material.pageRanges?.length
    ? material.pageRanges.map(range => ({ page: range.page, text: material.text.slice(range.start, range.end) }))
    : [{ page: null as number | null, text: material.text }]
  const all: SemanticChunk[] = []
  pages.forEach(({ page, text: pageText }, pageIndex) => {
    splitLongText(pageText).forEach((text, chunkIndex) => {
      all.push({ id: `p${page ?? pageIndex + 1}-c${chunkIndex + 1}`, page, text })
    })
  })

  if (all.length <= maxChunks) return all
  // Muestreo estratificado para no analizar solo las primeras páginas.
  const picked: SemanticChunk[] = []
  const step = (all.length - 1) / (maxChunks - 1)
  for (let i = 0; i < maxChunks; i++) picked.push(all[Math.round(i * step)])
  return [...new Map(picked.map(chunk => [chunk.id, chunk])).values()]
}

function pagesFor(material: StudyMaterial, label: string) {
  if (!material.pageRanges?.length) return []
  const needle = normalize(label)
  const terms = needle.split(' ').filter(term => term.length > 3)
  return material.pageRanges
    .map(range => ({ page: range.page, text: material.text.slice(range.start, range.end) }))
    .map(({ page, text }) => ({ page, score: terms.reduce((sum, term) => sum + (normalize(text).includes(term) ? 1 : 0), 0) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.page)
}


function sourcePositionFor(material: StudyMaterial, label: string) {
  const normalizedLabel = normalize(label)
  const fullText = normalize(material.text)
  const exact = normalizedLabel ? fullText.indexOf(normalizedLabel) : -1
  if (exact >= 0) return exact
  const terms = normalizedLabel.split(' ').filter(term => term.length >= 4)
  if (!terms.length) return Number.POSITIVE_INFINITY
  let best = Number.POSITIVE_INFINITY
  for (const term of terms) {
    const index = fullText.indexOf(term)
    if (index >= 0) best = Math.min(best, index)
  }
  return best
}

function primaryPage(concept: SemanticConcept) {
  return concept.pages?.length && Number.isFinite(concept.pages[0]) ? concept.pages[0] : Number.POSITIVE_INFINITY
}

export function sortConceptsByDocumentOrder(concepts: SemanticConcept[], preferredOrder: string[] = []) {
  const preferred = new Map(preferredOrder.map((label, index) => [label, index]))
  return concepts.slice().sort((a, b) => {
    const pageDiff = primaryPage(a) - primaryPage(b)
    if (pageDiff !== 0) return pageDiff
    const aiA = preferred.get(a.label) ?? Number.POSITIVE_INFINITY
    const aiB = preferred.get(b.label) ?? Number.POSITIVE_INFINITY
    if (aiA !== aiB) return aiA - aiB
    return b.importance - a.importance
  })
}

function conceptCategory(index: number, label: string, labels: string[]): SemanticConcept['category'] {
  const normalized = normalize(label)
  const hasBroader = labels.some(other => other !== label && normalized.includes(normalize(other)) && normalize(other).split(' ').length < normalized.split(' ').length)
  if (hasBroader) return 'subconcept'
  if (index < 5) return 'principal'
  if (/teorema|probabilidad|logica|estadistica|variable|conocimiento|conjunto|grafo/.test(normalized)) return 'foundation'
  return index < 11 ? 'subconcept' : 'application'
}

export function buildLocalSemanticAnalysis(material: StudyMaterial): SemanticDocumentAnalysis {
  const candidates = extractConcepts(material.text, 18)
  const labels = candidates.map(c => c.label)
  const concepts: SemanticConcept[] = candidates.map((candidate, index) => {
    const key = normalize(candidate.label)
    const broader = labels.find(other => {
      const otherKey = normalize(other)
      return other !== candidate.label && key.includes(otherKey) && otherKey.split(' ').length < key.split(' ').length
    })
    const excerpts = findRelevantExcerpts(material.text, candidate.label, 2)
    const importance = Math.max(35, Math.min(96, 92 - index * 3 + Math.min(8, candidate.score)))
    return {
      label: candidate.label,
      description: excerpts[0]?.slice(0, 330) || candidate.snippet.slice(0, 330),
      category: conceptCategory(index, candidate.label, labels),
      tier: index < 12 ? 'essential' : 'deep',
      importance,
      studyQuestion: `¿Qué problema resuelve ${candidate.label} y cómo se conecta con las ideas que lo rodean?`,
      parent: broader || '',
      prerequisites: broader ? [broader] : [],
      related: [],
      pages: pagesFor(material, candidate.label),
      evidence: excerpts.length ? excerpts : [candidate.snippet],
      lab: inferLabRecommendation(candidate.label, excerpts[0] || candidate.snippet),
    }
  })

  const relations: SemanticRelation[] = []
  for (let i = 0; i < concepts.length; i++) {
    const source = concepts[i]
    const sourceTerms = normalize(source.label).split(' ').filter(term => term.length > 3)
    const scored = concepts
      .filter((_, j) => i !== j)
      .map(target => {
        const evidence = `${source.evidence.join(' ')} ${target.evidence.join(' ')}`
        const targetTerms = normalize(target.label).split(' ').filter(term => term.length > 3)
        const overlap = sourceTerms.filter(term => targetTerms.includes(term)).length
        const co = [...sourceTerms, ...targetTerms].reduce((sum, term) => sum + (normalize(evidence).includes(term) ? 1 : 0), 0)
        return { target, score: overlap * 4 + co }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)

    source.related = scored.filter(item => item.score > 1).map(item => item.target.label)
    if (source.parent) relations.push({ source: source.parent, target: source.label, type: 'part_of' })
    scored.filter(item => item.score > 2).forEach(item => {
      if (!relations.some(r => (r.source === source.label && r.target === item.target.label) || (r.source === item.target.label && r.target === source.label))) {
        relations.push({ source: source.label, target: item.target.label, type: 'related_to' })
      }
    })
  }

  const learningOrder = concepts
    .filter(concept => concept.tier === 'essential')
    .slice()
    .sort((a, b) => primaryPage(a) - primaryPage(b) || sourcePositionFor(material, a.label) - sourcePositionFor(material, b.label) || b.importance - a.importance)
    .map(c => c.label)

  return {
    engine: 'local',
    model: 'heurística semántica local',
    generatedAt: new Date().toISOString(),
    documentSummary: `Mapa preliminar generado localmente con ${concepts.length} conceptos y una ruta que conserva el orden de aparición del documento.`,
    chunksAnalyzed: makeSemanticChunks(material).length,
    concepts,
    relations: relations.slice(0, 28),
    learningOrder,
    warnings: ['Mapa preliminar: la ruta respeta el orden del documento; Hugging Face + OpenAI pueden depurar nombres, relaciones y cobertura sin reordenar el temario.'],
    labPlannerVersion: '2.0.4-local-document-order',
  }
}

export async function analyzeMaterialSemantically(material: StudyMaterial, forceRefresh = false): Promise<SemanticDocumentAnalysis> {
  const fallback = buildLocalSemanticAnalysis(material)
  const chunks = makeSemanticChunks(material, 42)
  try {
    const response = await fetch('/api/analyze-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialName: material.name,
        pages: material.pages || null,
        chunks,
        localCandidates: material.concepts.slice(0, 24).map(c => ({ label: c.label, score: c.score, snippet: c.snippet })),
        forceRefresh,
      }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body?.error || `Semantic API unavailable (${response.status})`)
    }
    const data = await response.json()
    if (!data?.analysis?.concepts?.length) throw new Error('Semantic API returned no concepts')
    return normalizeSemanticAnalysis(data.analysis as SemanticDocumentAnalysis)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido del motor semántico remoto'
    console.warn('[Comprende semantic] Se usó mapa local porque falló /api/analyze-material:', message)
    return {
      ...fallback,
      warnings: [
        `Motor remoto no disponible: ${message}`,
        ...fallback.warnings,
      ],
    }
  }
}


export function normalizeSemanticAnalysis(analysis: SemanticDocumentAnalysis): SemanticDocumentAnalysis {
  const ordered = new Set(analysis.learningOrder || [])
  const concepts = (analysis.concepts || []).map((concept, index) => {
    let parent = concept.parent || ''
    // Naive Bayes comparte fundamentos con redes bayesianas, pero no es un componente
    // interno de una red bayesiana. Evitamos esa jerarquía cuando llega de un mapa viejo.
    if (/naive bayes/i.test(concept.label) && /red(es)? bayesian/i.test(parent)) parent = ''
    return {
      ...concept,
      parent,
      tier: concept.tier || (ordered.has(concept.label) || concept.category === 'foundation' || (concept.category === 'principal' && index < 12) ? 'essential' : 'deep'),
      studyQuestion: concept.studyQuestion || `¿Qué problema resuelve ${concept.label} y qué cambia cuando lo entiendes?`,
      prerequisites: concept.prerequisites || [],
      related: concept.related || [],
      pages: Array.isArray(concept.pages) ? [...new Set(concept.pages.filter(page => Number.isFinite(page)))].map(Number) : [],
      evidence: concept.evidence || [],
      lab: (() => {
        const inferred = inferLabRecommendation(concept.label, concept.description || concept.evidence?.[0] || '')
        if (!concept.lab) return inferred
        const current = concept.lab
        // Los mapas anteriores a 2.0 nunca pudieron recomendar laboratorios componibles.
        // Si el heurístico universal detecta uno útil, lo activamos sin obligar al usuario a reanalizar.
        if (!analysis.labPlannerVersion && !current.recommended && inferred.recommended && inferred.engine === 'composed') return inferred
        const engine = current.engine || (current.recommended ? (current.labType === 'generic' ? 'composed' : 'specialized') : 'none')
        const genericTemplate = current.genericTemplate || (engine === 'composed' ? inferred.genericTemplate || 'concept-simulator' : 'none')
        return { ...inferred, ...current, engine, genericTemplate }
      })(),
    }
  }) as SemanticConcept[]

  const conceptByName = new Map(concepts.map(concept => [concept.label, concept]))
  const relationMap = new Map<string, SemanticRelation>()
  const addRelation = (relation: SemanticRelation) => {
    if (!conceptByName.has(relation.source) || !conceptByName.has(relation.target) || relation.source === relation.target) return
    const key = `${relation.source}::${relation.type}::${relation.target}`
    relationMap.set(key, relation)
  }

  ;(analysis.relations || []).forEach(relation => {
    const source = conceptByName.get(relation.source)
    const target = conceptByName.get(relation.target)
    if (!source || !target || relation.source === relation.target) return

    if (relation.type === 'part_of') {
      // La UI lee part_of como "source contiene/agrupa target".
      if (target.parent === source.label) addRelation(relation)
      else if (source.parent === target.label) addRelation({ source: target.label, target: source.label, type: 'part_of' })
      else addRelation({ source: source.label, target: target.label, type: 'related_to' })
      return
    }

    if (relation.type === 'requires') {
      if (source.prerequisites.includes(target.label)) addRelation(relation)
      else if (target.prerequisites.includes(source.label)) addRelation({ source: target.label, target: source.label, type: 'requires' })
      else addRelation(relation)
      return
    }

    // Evita mapas antiguos que dibujaban Naive Bayes como contenedor/parte de una red.
    if (/naive bayes/i.test(source.label) && /red(es)? bayesian/i.test(target.label)) {
      addRelation({ source: source.label, target: target.label, type: 'related_to' })
      return
    }
    addRelation(relation)
  })

  // Parent y prerequisites son la fuente más estable para reconstruir relaciones.
  concepts.forEach(concept => {
    if (concept.parent && conceptByName.has(concept.parent)) addRelation({ source: concept.parent, target: concept.label, type: 'part_of' })
    concept.prerequisites.forEach(prerequisite => {
      if (conceptByName.has(prerequisite)) addRelation({ source: concept.label, target: prerequisite, type: 'requires' })
    })
  })

  const suppliedOrder = (analysis.learningOrder || []).filter(label => conceptByName.get(label)?.tier === 'essential')
  const essentialConcepts = concepts.filter(concept => concept.tier === 'essential')
  const documentOrdered = sortConceptsByDocumentOrder(essentialConcepts, suppliedOrder).map(concept => concept.label)

  return { ...analysis, concepts, relations: [...relationMap.values()], learningOrder: documentOrdered }
}

export function conceptsFromSemantic(analysis: SemanticDocumentAnalysis) {
  return normalizeSemanticAnalysis(analysis).concepts
    .slice()
    .sort((a, b) => b.importance - a.importance)
    .map(concept => ({
      label: concept.label,
      score: concept.importance,
      snippet: concept.description || concept.evidence[0] || '',
    }))
}
