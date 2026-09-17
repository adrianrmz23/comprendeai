import type { StudyMaterial } from './materials'
import { emptyLearningMemory, type ConceptMemory, type LearningMemory } from './memory'
import { getSupabaseBrowser } from './supabaseBrowser'

export type CloudProgress = {
  learningMemory: LearningMemory
  demoMastery: number
  completedSteps: string[]
}

export type CloudState = {
  materials: StudyMaterial[]
  progress: CloudProgress | null
}

export type SyncStatus = 'idle' | 'loading' | 'syncing' | 'synced' | 'error'

export async function loadCloudState(userId: string): Promise<CloudState> {
  const supabase = getSupabaseBrowser()
  if (!supabase) throw new Error('Supabase browser client is not configured')
  const [materialsResult, progressResult] = await Promise.all([
    supabase.from('comprende_v1_user_materials').select('material_data').eq('user_id', userId).order('updated_at', { ascending: true }),
    supabase.from('comprende_v1_user_progress').select('learning_memory,demo_mastery,completed_steps').eq('user_id', userId).maybeSingle(),
  ])
  if (materialsResult.error) throw materialsResult.error
  if (progressResult.error) throw progressResult.error
  return {
    materials: (materialsResult.data || []).map(row => row.material_data as StudyMaterial).filter(Boolean),
    progress: progressResult.data ? {
      learningMemory: (progressResult.data.learning_memory as LearningMemory) || emptyLearningMemory(),
      demoMastery: Number(progressResult.data.demo_mastery || 18),
      completedSteps: Array.isArray(progressResult.data.completed_steps) ? progressResult.data.completed_steps as string[] : [],
    } : null,
  }
}

export async function saveCloudState(userId: string, materials: StudyMaterial[], learningMemory: LearningMemory, demoMastery: number, completedSteps: string[]) {
  const supabase = getSupabaseBrowser()
  if (!supabase) throw new Error('Supabase browser client is not configured')
  const now = new Date().toISOString()

  if (materials.length) {
    const rows = materials.map(material => ({
      user_id: userId,
      material_id: material.id,
      material_name: material.name,
      material_data: material,
      updated_at: now,
    }))
    const { error } = await supabase.from('comprende_v1_user_materials').upsert(rows, { onConflict: 'user_id,material_id' })
    if (error) throw error
  }

  const { data: remoteIds, error: idsError } = await supabase.from('comprende_v1_user_materials').select('material_id').eq('user_id', userId)
  if (idsError) throw idsError
  const localIds = new Set(materials.map(material => material.id))
  const staleIds = (remoteIds || []).map(row => String(row.material_id)).filter(id => !localIds.has(id))
  if (staleIds.length) {
    const { error } = await supabase.from('comprende_v1_user_materials').delete().eq('user_id', userId).in('material_id', staleIds)
    if (error) throw error
  }

  const { error: progressError } = await supabase.from('comprende_v1_user_progress').upsert({
    user_id: userId,
    learning_memory: learningMemory,
    demo_mastery: demoMastery,
    completed_steps: completedSteps,
    updated_at: now,
  }, { onConflict: 'user_id' })
  if (progressError) throw progressError
}

function newerMemory(a: ConceptMemory | undefined, b: ConceptMemory | undefined) {
  if (!a) return b
  if (!b) return a
  return new Date(a.lastReviewedAt).getTime() >= new Date(b.lastReviewedAt).getTime() ? a : b
}

export function mergeLearningMemory(local: LearningMemory, remote: LearningMemory | null | undefined): LearningMemory {
  if (!remote?.concepts) return local
  const keys = new Set([...Object.keys(local.concepts || {}), ...Object.keys(remote.concepts || {})])
  const concepts: Record<string, ConceptMemory> = {}
  keys.forEach(key => {
    const record = newerMemory(local.concepts?.[key], remote.concepts?.[key])
    if (record) concepts[key] = record
  })
  return { version: 1, concepts }
}

export function mergeMaterials(local: StudyMaterial[], remote: StudyMaterial[]) {
  const map = new Map<string, StudyMaterial>()
  remote.forEach(material => map.set(material.id, material))
  local.forEach(material => {
    const existing = map.get(material.id)
    // Local wins when it contains a newer semantic analysis; otherwise keep the cloud copy.
    if (!existing) map.set(material.id, material)
    else {
      const localTime = new Date(material.semantic?.generatedAt || material.createdAt).getTime()
      const remoteTime = new Date(existing.semantic?.generatedAt || existing.createdAt).getTime()
      if (localTime >= remoteTime) map.set(material.id, material)
    }
  })
  return [...map.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}
