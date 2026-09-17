import type { StudyMaterial, SemanticConcept } from './materials'
import type { LearningMemory, ConceptMemory } from './memory'
import { getMemoryRecords, memoryStatus } from './memory'

export type GlobalConceptHit = {
  materialId: string
  materialName: string
  subject: string
  concept: string
  description: string
  category: string
  tier: 'essential' | 'deep'
  pages: number[]
  mastery: number | null
}

export type SubjectSummary = {
  subject: string
  materials: number
  concepts: number
  essential: number
  tracked: number
  mastery: number
  due: number
}

export function inferSubjectFromText(text: string, filename = '') {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const explicit = normalized.match(/MATERIA\s*[:\-]?\s*(.{3,120}?)(?=\s+(?:UNIDAD|TEMA|OBJETIVO|CLASE)\b)/i)?.[1]
  if (explicit) return titleCase(explicit.replace(/[|•]+$/g, '').trim())

  const fileGuess = filename
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^\s*\d+(?:\.\d+)*\s*(?:CLASE|TEMA)?\s*/i, '')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .trim()
  if (fileGuess && fileGuess.length <= 90) return titleCase(fileGuess)
  return 'Sin materia'
}

export function subjectFor(material: StudyMaterial) {
  return material.subject?.trim() || inferSubjectFromText(material.text, material.name)
}

export function semanticConcepts(material: StudyMaterial): SemanticConcept[] {
  if (material.semantic?.concepts?.length) return material.semantic.concepts
  return material.concepts.map(c => ({
    label: c.label,
    description: c.snippet,
    category: 'principal' as const,
    tier: 'essential' as const,
    importance: c.score,
    studyQuestion: '',
    parent: '',
    prerequisites: [],
    related: [],
    pages: [],
    evidence: [],
  }))
}

function memoryFor(memory: LearningMemory, materialId: string, concept: string): ConceptMemory | undefined {
  const lower = concept.toLocaleLowerCase('es-MX')
  return Object.values(memory.concepts).find(r => r.materialId === materialId && r.concept.toLocaleLowerCase('es-MX') === lower)
}

export function buildGlobalHits(materials: StudyMaterial[], memory: LearningMemory): GlobalConceptHit[] {
  return materials.flatMap(material => semanticConcepts(material).map(concept => {
    const record = memoryFor(memory, material.id, concept.label)
    return {
      materialId: material.id,
      materialName: material.name,
      subject: subjectFor(material),
      concept: concept.label,
      description: concept.description,
      category: concept.category,
      tier: concept.tier,
      pages: concept.pages || [],
      mastery: record?.mastery ?? null,
    }
  }))
}

export function searchGlobal(materials: StudyMaterial[], memory: LearningMemory, query: string, limit = 12) {
  const q = normalize(query)
  if (!q) return []
  const terms = q.split(' ').filter(Boolean)
  return buildGlobalHits(materials, memory)
    .map(hit => {
      const haystack = normalize(`${hit.concept} ${hit.description} ${hit.materialName} ${hit.subject}`)
      const exact = normalize(hit.concept).includes(q) ? 12 : 0
      const prefix = normalize(hit.concept).startsWith(q) ? 8 : 0
      const termHits = terms.reduce((n, term) => n + (haystack.includes(term) ? 2 : 0), 0)
      const tierBonus = hit.tier === 'essential' ? 2 : 0
      return { hit, score: exact + prefix + termHits + tierBonus }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.hit.mastery ?? -1) - (a.hit.mastery ?? -1))
    .slice(0, limit)
    .map(item => item.hit)
}

export function subjectSummaries(materials: StudyMaterial[], memory: LearningMemory): SubjectSummary[] {
  const groups = new Map<string, StudyMaterial[]>()
  materials.forEach(material => {
    const subject = subjectFor(material)
    groups.set(subject, [...(groups.get(subject) || []), material])
  })
  return [...groups.entries()].map(([subject, subjectMaterials]) => {
    const hits = subjectMaterials.flatMap(m => semanticConcepts(m).map(c => ({ m, c })))
    const essential = hits.filter(x => x.c.tier === 'essential')
    const records = getMemoryRecords(memory).filter(r => subjectMaterials.some(m => m.id === r.materialId))
    const due = records.filter(r => memoryStatus(r) === 'due').length
    const mastery = records.length ? Math.round(records.reduce((sum, r) => sum + r.mastery, 0) / records.length) : 0
    return {
      subject,
      materials: subjectMaterials.length,
      concepts: hits.length,
      essential: essential.length,
      tracked: records.length,
      mastery,
      due,
    }
  }).sort((a, b) => b.due - a.due || b.materials - a.materials || a.subject.localeCompare(b.subject, 'es'))
}

export function documentProgress(material: StudyMaterial, memory: LearningMemory) {
  const essentials = semanticConcepts(material).filter(c => c.tier === 'essential')
  const records = getMemoryRecords(memory).filter(r => r.materialId === material.id)
  const essentialRecords = records.filter(r => essentials.some(c => c.label.toLocaleLowerCase('es-MX') === r.concept.toLocaleLowerCase('es-MX')))
  const mastered = essentialRecords.filter(r => r.mastery >= 82).length
  const average = essentialRecords.length ? Math.round(essentialRecords.reduce((sum, r) => sum + r.mastery, 0) / essentialRecords.length) : 0
  return {
    total: essentials.length,
    tracked: essentialRecords.length,
    mastered,
    average,
    percent: essentials.length ? Math.round((mastered / essentials.length) * 100) : 0,
  }
}

export function nextRecommendedConcept(materials: StudyMaterial[], memory: LearningMemory) {
  const records = getMemoryRecords(memory)
  const due = records.find(r => memoryStatus(r) === 'due')
  if (due) return { materialId: due.materialId, concept: due.concept, reason: 'Repaso vencido', kind: 'review' as const }
  const fragile = records.find(r => memoryStatus(r) === 'fragile')
  if (fragile) return { materialId: fragile.materialId, concept: fragile.concept, reason: 'Concepto frágil', kind: 'review' as const }

  for (const material of materials) {
    const essentials = semanticConcepts(material).filter(c => c.tier === 'essential')
    for (const concept of essentials) {
      if (!memoryFor(memory, material.id, concept.label)) {
        return { materialId: material.id, concept: concept.label, reason: 'Siguiente concepto esencial', kind: 'new' as const }
      }
    }
  }
  const recent = records.sort((a, b) => new Date(b.lastReviewedAt).getTime() - new Date(a.lastReviewedAt).getTime())[0]
  if (recent) return { materialId: recent.materialId, concept: recent.concept, reason: 'Continuar fortaleciendo', kind: 'continue' as const }
  return null
}

export function recentActivity(memory: LearningMemory, limit = 6) {
  return getMemoryRecords(memory)
    .slice()
    .sort((a, b) => new Date(b.lastReviewedAt).getTime() - new Date(a.lastReviewedAt).getTime())
    .slice(0, limit)
}

export function exportPayload(materials: StudyMaterial[], memory: LearningMemory) {
  return {
    app: 'Comprende',
    version: 1,
    exportedAt: new Date().toISOString(),
    materials,
    learningMemory: memory,
  }
}

export function validateImportPayload(value: unknown): { materials: StudyMaterial[]; learningMemory: LearningMemory } {
  if (!value || typeof value !== 'object') throw new Error('El respaldo no tiene un formato válido.')
  const payload = value as { materials?: StudyMaterial[]; learningMemory?: LearningMemory }
  if (!Array.isArray(payload.materials)) throw new Error('El respaldo no contiene materiales válidos.')
  if (!payload.learningMemory || payload.learningMemory.version !== 1 || !payload.learningMemory.concepts) throw new Error('El respaldo no contiene memoria de aprendizaje válida.')
  return { materials: payload.materials, learningMemory: payload.learningMemory }
}

function normalize(value: string) {
  return value.toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim()
}

function titleCase(value: string) {
  return value.toLocaleLowerCase('es-MX').replace(/(^|\s)([a-záéíóúüñ])/g, (_, p1, p2) => `${p1}${p2.toLocaleUpperCase('es-MX')}`)
}
