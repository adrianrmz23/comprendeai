import type { StudyMaterial } from '../materials'
import { findRelevantExcerpts } from '../materials'
import { buildFallbackGenericPlan, sanitizeGenericLabPlan, validateGenericLabPlan } from './genericEngine'
import type { GenericLabPlan, LabRecommendation } from './types'

function browserKey(materialId: string, concept: string, template: string) {
  return `comprende-generic-lab:v2:${materialId}:${template}:${concept.toLocaleLowerCase('es-MX')}`
}

export async function getGenericLabPlan(material: StudyMaterial, concept: string, recommendation: LabRecommendation, forceRefresh = false): Promise<GenericLabPlan> {
  const template = recommendation.genericTemplate && recommendation.genericTemplate !== 'none' ? recommendation.genericTemplate : 'concept-simulator'
  const fallback = buildFallbackGenericPlan(concept, template)
  const key = browserKey(material.id, concept, template)
  if (!forceRefresh) {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null') as GenericLabPlan | null
      if (cached?.title) {
        const safe = sanitizeGenericLabPlan(cached)
        const validation = validateGenericLabPlan(safe)
        if (validation.valid) return { ...safe, cached: true, validation }
      }
    } catch { /* ignore corrupted local plan */ }
  }
  try {
    const conceptMeta = material.semantic?.concepts.find(item => item.label === concept)
    const excerpts = conceptMeta?.evidence?.length ? conceptMeta.evidence.slice(0, 4) : findRelevantExcerpts(material.text, concept, 4)
    const response = await fetch('/api/generate-generic-lab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concept,
        materialName: material.name,
        excerpts,
        recommendation,
        studyQuestion: conceptMeta?.studyQuestion || '',
        prerequisites: conceptMeta?.prerequisites || [],
        forceRefresh,
      }),
    })
    if (!response.ok) return fallback
    const data = await response.json()
    if (!data?.plan) return fallback
    const safe = sanitizeGenericLabPlan({ ...data.plan, provider: data.provider, model: data.model, cached: Boolean(data.cached) } as GenericLabPlan)
    const validation = validateGenericLabPlan(safe)
    if (!validation.valid) return { ...fallback, validation }
    const output = { ...safe, validation }
    localStorage.setItem(key, JSON.stringify(output))
    return output
  } catch {
    return fallback
  }
}
