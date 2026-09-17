import type { StudyMaterial } from './materials'
import type { StudySession } from './sessionGenerator'

const KEY = 'comprende-ai-client-cache-v2'
const LEGACY_KEY = 'comprende-ai-client-cache-v1'

export type AiAttribution = {
  provider: string
  model: string
  promptVersion?: string
  generatedAt?: string
  depth?: 'quick' | 'advanced'
  sourceKind?: string
}

type CacheShape = {
  explanations: Record<string, { savedAt: string; payload: StudySession['intuition']; attribution?: AiAttribution }>
  sessions: Record<string, { savedAt: string; payload: StudySession; attribution?: AiAttribution }>
}

function load(): CacheShape {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || '{}'
    const parsed = JSON.parse(raw) as Partial<CacheShape>
    const normalized = { explanations: parsed.explanations || {}, sessions: parsed.sessions || {} }
    if (!localStorage.getItem(KEY) && raw !== '{}') {
      try { localStorage.setItem(KEY, JSON.stringify(normalized)) } catch { /* noop */ }
    }
    return normalized
  } catch {
    return { explanations: {}, sessions: {} }
  }
}

function save(value: CacheShape) {
  try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* quota/private mode */ }
}

function materialKey(material: StudyMaterial) {
  return `${material.id}:${material.createdAt}:${material.text.length}`
}

function normalizeConcept(concept: string) {
  return concept.trim().toLocaleLowerCase('es-MX')
}

function explanationKey(material: StudyMaterial, concept: string, variant: string) {
  return `${materialKey(material)}::explain::${normalizeConcept(concept)}::${variant}`
}

function sessionKey(material: StudyMaterial, concept: string) {
  return `${materialKey(material)}::session::${normalizeConcept(concept)}`
}

export function getCachedExplanationEntry(material: StudyMaterial, concept: string, variant = 'default') {
  return load().explanations[explanationKey(material, concept, variant)] || null
}

export function getCachedExplanation(material: StudyMaterial, concept: string, variant = 'default') {
  return getCachedExplanationEntry(material, concept, variant)?.payload || null
}

export function setCachedExplanation(material: StudyMaterial, concept: string, variant: string, payload: StudySession['intuition'], attribution?: AiAttribution) {
  const cache = load()
  cache.explanations[explanationKey(material, concept, variant)] = { savedAt: new Date().toISOString(), payload, attribution }
  save(cache)
}

export function getCachedSessionEntry(material: StudyMaterial, concept: string) {
  return load().sessions[sessionKey(material, concept)] || null
}

export function getCachedSession(material: StudyMaterial, concept: string) {
  return getCachedSessionEntry(material, concept)?.payload || null
}

export function setCachedSession(material: StudyMaterial, concept: string, payload: StudySession, attribution?: AiAttribution) {
  const cache = load()
  cache.sessions[sessionKey(material, concept)] = { savedAt: new Date().toISOString(), payload, attribution }
  save(cache)
}

export function clearAiClientCache() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY_KEY) } catch { /* noop */ }
}
