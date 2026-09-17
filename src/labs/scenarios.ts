import type { StudyMaterial } from '../materials'
import { findRelevantExcerpts } from '../materials'
import { localLabNarrative } from './registry'
import type { LabNarrative, LabType } from './types'

function browserKey(materialId: string, concept: string, labType: LabType) {
  return `comprende-lab-scenario:${materialId}:${labType}:${concept.toLocaleLowerCase('es-MX')}`
}

export async function getLabNarrative(material: StudyMaterial, concept: string, labType: LabType, forceRefresh = false): Promise<LabNarrative> {
  const local = localLabNarrative(labType, concept)
  const key = browserKey(material.id, concept, labType)
  if (!forceRefresh) {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null') as LabNarrative | null
      if (cached?.title) return { ...cached, cached: true }
    } catch { /* cache corrupto: usa API/local */ }
  }
  try {
    const excerpts = findRelevantExcerpts(material.text, concept, 4)
    const response = await fetch('/api/generate-lab-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concept, labType, materialName: material.name, excerpts, forceRefresh }),
    })
    if (!response.ok) return local
    const data = await response.json()
    if (!data?.scenario) return local
    const narrative = {
      ...data.scenario,
      provider: data.provider,
      model: data.model,
      cached: Boolean(data.cached),
    } as LabNarrative
    localStorage.setItem(key, JSON.stringify(narrative))
    return narrative
  } catch {
    return local
  }
}
