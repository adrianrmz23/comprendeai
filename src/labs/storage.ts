import { getSupabaseBrowser } from '../supabaseBrowser'
import type { LabProgress, LabResult, LabType } from './types'

const localKey = (userId: string, materialId: string, concept: string, labType: LabType) =>
  `comprende-lab-progress:${userId}:${materialId}:${labType}:${concept.toLocaleLowerCase('es-MX')}`

export async function loadLabProgress(userId: string, materialId: string, concept: string, labType: LabType): Promise<LabProgress | null> {
  try {
    const local = JSON.parse(localStorage.getItem(localKey(userId, materialId, concept, labType)) || 'null') as LabProgress | null
    const supabase = getSupabaseBrowser()
    if (!supabase) return local
    const { data, error } = await supabase
      .from('comprende_v1_lab_progress')
      .select('best_score,attempts,completed,updated_at')
      .eq('user_id', userId)
      .eq('material_id', materialId)
      .eq('concept', concept)
      .eq('lab_type', labType)
      .maybeSingle()
    if (error) return local
    if (!data) return local
    const remote: LabProgress = {
      bestScore: Number(data.best_score || 0),
      attempts: Number(data.attempts || 0),
      completed: Boolean(data.completed),
      updatedAt: String(data.updated_at || new Date().toISOString()),
    }
    localStorage.setItem(localKey(userId, materialId, concept, labType), JSON.stringify(remote))
    return !local || remote.bestScore >= local.bestScore ? remote : local
  } catch {
    return null
  }
}

export async function saveLabResult(args: {
  userId: string
  materialId: string
  materialName: string
  concept: string
  labType: LabType
  scenarioId: string
  result: LabResult
}) {
  const { userId, materialId, materialName, concept, labType, scenarioId, result } = args
  const previous = await loadLabProgress(userId, materialId, concept, labType)
  const next: LabProgress = {
    bestScore: Math.max(previous?.bestScore || 0, Math.round(result.score)),
    attempts: (previous?.attempts || 0) + 1,
    completed: Boolean(previous?.completed || result.completed),
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(localKey(userId, materialId, concept, labType), JSON.stringify(next))

  const supabase = getSupabaseBrowser()
  if (!supabase) return next

  const { error: attemptError } = await supabase.from('comprende_v1_lab_attempts').insert({
    user_id: userId,
    material_id: materialId,
    material_name: materialName,
    concept,
    lab_type: labType,
    scenario_id: scenarioId,
    score: Math.round(result.score),
    completed: result.completed,
    result_data: { interactions: result.interactions, detail: result.detail, state: result.state || {} },
  })
  if (attemptError) console.warn('Comprende lab attempt sync failed:', attemptError.message)

  const { error: progressError } = await supabase.from('comprende_v1_lab_progress').upsert({
    user_id: userId,
    material_id: materialId,
    material_name: materialName,
    concept,
    lab_type: labType,
    best_score: next.bestScore,
    attempts: next.attempts,
    completed: next.completed,
    last_state: result.state || {},
    updated_at: next.updatedAt,
  }, { onConflict: 'user_id,material_id,concept,lab_type' })
  if (progressError) console.warn('Comprende lab progress sync failed:', progressError.message)
  return next
}
