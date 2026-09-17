import { buildLocalStudySession, evaluateRecallLocally, type RecallEvaluation, type StudySession } from './sessionGenerator'
import { findRelevantExcerpts, type StudyMaterial } from './materials'
import { getCachedExplanation, getCachedExplanationEntry, getCachedSession, getCachedSessionEntry, setCachedExplanation, setCachedSession, type AiAttribution } from './aiClientCache'

export type SessionGeneration = {
  session: StudySession
  source: 'local' | 'ai'
  message?: string
  cached?: boolean
  cacheLayer?: 'browser' | 'supabase'
  attribution?: AiAttribution
}

export type ExplanationVariant = 'default' | 'simpler' | 'new-example' | 'deep'

export type ConceptExplanationResult = {
  explanation: StudySession['intuition']
  source: 'local' | 'ai'
  message?: string
  cached?: boolean
  cacheLayer?: 'browser' | 'supabase'
  attribution?: AiAttribution
}

function relatedConcepts(material: StudyMaterial, concept: string) {
  return material.concepts.map(c => c.label).filter(c => c.toLocaleLowerCase('es-MX') !== concept.toLocaleLowerCase('es-MX')).slice(0, 7)
}

export async function explainConceptWithAI(
  material: StudyMaterial,
  concept: string,
  variant: ExplanationVariant = 'default',
  forceRefresh = false,
): Promise<ConceptExplanationResult> {
  const fallback = buildLocalStudySession(material, concept).intuition
  const excerpts = findRelevantExcerpts(material.text, concept, 6)
  if (!forceRefresh) {
    const instant = getCachedExplanationEntry(material, concept, variant)
    if (instant) return { explanation: instant.payload, source: 'ai', cached: true, cacheLayer: 'browser', attribution: instant.attribution }
  }

  try {
    const response = await fetch('/api/explain-concept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concept,
        materialName: material.name,
        excerpts: (excerpts.length ? excerpts : [material.text.slice(0, 1800)]).slice(0, 6),
        relatedConcepts: relatedConcepts(material, concept),
        variant,
        forceRefresh,
      }),
    })

    if (!response.ok) {
      let detail = ''
      try {
        const data = await response.json()
        detail = typeof data?.error === 'string' ? data.error : ''
      } catch {
        detail = await response.text().catch(() => '')
      }
      throw new Error(detail || `AI unavailable (${response.status})`)
    }

    const data = await response.json()
    const explanation = data?.explanation
    if (!explanation?.summary || !explanation?.example || !explanation?.keyIdea) throw new Error('Invalid AI explanation')
    const attribution = data?.attribution as AiAttribution | undefined
    setCachedExplanation(material, concept, variant, explanation as StudySession['intuition'], attribution)
    return { explanation: explanation as StudySession['intuition'], source: 'ai', cached: Boolean(data?.cached), cacheLayer: data?.cached ? 'supabase' : undefined, attribution }
  } catch (error) {
    const detail = error instanceof Error ? error.message : ''
    const missingKey = /OPENAI_API_KEY/i.test(detail)
    return {
      explanation: fallback,
      source: 'local',
      message: missingKey
        ? 'La explicación con IA está lista en el proyecto, pero falta configurar OPENAI_API_KEY.'
        : 'No pude usar la IA en este momento. Dejé una explicación local para que puedas seguir estudiando.',
    }
  }
}

export async function enhanceSessionWithAI(material: StudyMaterial, concept: string, forceRefresh = false): Promise<SessionGeneration> {
  const fallback = buildLocalStudySession(material, concept)
  const excerpts = findRelevantExcerpts(material.text, concept, 6)
  if (!forceRefresh) {
    const instant = getCachedSessionEntry(material, concept)
    if (instant) return { session: instant.payload, source: 'ai', cached: true, cacheLayer: 'browser', attribution: instant.attribution }
  }

  try {
    const response = await fetch('/api/generate-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concept,
        materialName: material.name,
        excerpts: (excerpts.length ? excerpts : [material.text.slice(0, 1800)]).slice(0, 6),
        relatedConcepts: relatedConcepts(material, concept),
        forceRefresh,
      }),
    })

    if (!response.ok) throw new Error(`AI unavailable (${response.status})`)
    const data = await response.json()
    if (!data?.session?.concept) throw new Error('Invalid AI response')
    const attribution = data?.attribution as AiAttribution | undefined
    setCachedSession(material, concept, data.session as StudySession, attribution)
    return { session: data.session as StudySession, source: 'ai', cached: Boolean(data?.cached), cacheLayer: data?.cached ? 'supabase' : undefined, attribution }
  } catch {
    return {
      session: fallback,
      source: 'local',
      message: 'La sesión base sigue disponible. Puedes usar IA específicamente en “Entender” o configurar OPENAI_API_KEY para regenerar la sesión completa.',
    }
  }
}

export async function evaluateRecall(
  answer: string,
  material: StudyMaterial,
  concept: string,
  session: StudySession,
): Promise<{ evaluation: RecallEvaluation; source: 'local' | 'ai' }> {
  const fallback = evaluateRecallLocally(answer, material, concept, session)

  try {
    const response = await fetch('/api/evaluate-explanation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concept,
        answer,
        sourceEvidence: session.formal.sourceEvidence,
        checklist: session.teachBack.checklist,
      }),
    })
    if (!response.ok) throw new Error('AI evaluation unavailable')
    const data = await response.json()
    if (!data?.evaluation || typeof data.evaluation.score !== 'number') throw new Error('Invalid evaluation')
    return { evaluation: data.evaluation as RecallEvaluation, source: 'ai' }
  } catch {
    return { evaluation: fallback, source: 'local' }
  }
}
