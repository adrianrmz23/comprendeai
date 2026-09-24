import type { StudyMaterial } from './materials'
import { emptyLearningMemory, type ConceptMemory, type LearningMemory, type MemoryEvent } from './memory'
import { getSupabaseBrowser } from './supabaseBrowser'

const MATERIAL_BUCKET = 'comprende-v1-materials'
const MATERIAL_CACHE_PREFIX = 'comprende-materials:'
const MIGRATION_CACHE_PREFIX = 'comprende-cloud-migrated-v207:'

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

function materialContentTime(material: StudyMaterial) {
  return new Date(material.updatedAt || material.semantic?.generatedAt || material.createdAt).getTime()
}

function memoryRichness(record: ConceptMemory | undefined) {
  if (!record) return -1
  return (
    (record.history?.length || 0) * 1000 +
    (record.attempts || 0) * 100 +
    (record.completionCount || 0) * 75 +
    (record.completedAt ? 50 : 0) +
    (record.teachBackScore != null ? 25 : 0) +
    (record.practiceAccuracy != null ? 20 : 0) +
    record.mastery
  )
}

function richerMemory(a: ConceptMemory | undefined, b: ConceptMemory | undefined) {
  if (!a) return b
  if (!b) return a
  const ar = memoryRichness(a)
  const br = memoryRichness(b)
  if (ar !== br) return ar > br ? a : b
  const at = new Date(a.lastReviewedAt || 0).getTime()
  const bt = new Date(b.lastReviewedAt || 0).getTime()
  if (at !== bt) return at > bt ? a : b
  return a.mastery >= b.mastery ? a : b
}

export function mergeLearningMemoryForMigration(local: LearningMemory, remote: LearningMemory | null | undefined): LearningMemory {
  const keys = new Set([...Object.keys(local.concepts || {}), ...Object.keys(remote?.concepts || {})])
  const concepts: Record<string, ConceptMemory> = {}
  keys.forEach(key => {
    const record = richerMemory(local.concepts?.[key], remote?.concepts?.[key])
    if (record) concepts[key] = record
  })
  return { version: 1, concepts }
}

export function mergeMaterialsForMigration(local: StudyMaterial[], remote: StudyMaterial[]) {
  const map = new Map<string, StudyMaterial>()
  remote.forEach(material => map.set(material.id, material))
  local.forEach(material => {
    const existing = map.get(material.id)
    if (!existing || materialContentTime(material) > materialContentTime(existing)) map.set(material.id, material)
  })
  return [...map.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function loadLocalMaterialCache(userId: string): StudyMaterial[] {
  try {
    const scoped = localStorage.getItem(`${MATERIAL_CACHE_PREFIX}${userId}`)
    if (scoped) return JSON.parse(scoped) as StudyMaterial[]
    const legacy = localStorage.getItem('comprende-materials')
    return legacy ? JSON.parse(legacy) as StudyMaterial[] : []
  } catch {
    return []
  }
}

export function saveLocalMaterialCache(userId: string, materials: StudyMaterial[]) {
  localStorage.setItem(`${MATERIAL_CACHE_PREFIX}${userId}`, JSON.stringify(materials))
}

export function clearLocalMaterialCache(userId: string) {
  localStorage.removeItem(`${MATERIAL_CACHE_PREFIX}${userId}`)
  localStorage.removeItem('comprende-materials')
}

export function hasCompletedCloudMigration(userId: string) {
  return localStorage.getItem(`${MIGRATION_CACHE_PREFIX}${userId}`) === '1'
}

export function markCloudMigrationComplete(userId: string) {
  localStorage.setItem(`${MIGRATION_CACHE_PREFIX}${userId}`, '1')
}

function normalizeCloudMaterial(row: any): StudyMaterial | null {
  const material = row?.material_data as StudyMaterial | null
  if (!material) return null
  return {
    ...material,
    updatedAt: material.updatedAt || row.content_updated_at || row.updated_at || material.semantic?.generatedAt || material.createdAt,
    originalFilePath: material.originalFilePath || row.file_path || undefined,
    originalFileSize: material.originalFileSize ?? (row.file_size == null ? undefined : Number(row.file_size)),
    originalMimeType: material.originalMimeType || row.mime_type || undefined,
  }
}

export async function loadCloudState(userId: string): Promise<CloudState> {
  const supabase = getSupabaseBrowser()
  if (!supabase) throw new Error('Supabase browser client is not configured')
  const [materialsResult, conceptProgressResult, progressResult] = await Promise.all([
    supabase
      .from('comprende_v1_user_materials')
      .select('material_data,file_path,file_size,mime_type,content_updated_at,updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('comprende_v1_concept_progress')
      .select('memory_data')
      .eq('user_id', userId),
    supabase
      .from('comprende_v1_user_progress')
      .select('learning_memory,demo_mastery,completed_steps')
      .eq('user_id', userId)
      .maybeSingle(),
  ])
  if (materialsResult.error) throw materialsResult.error
  if (conceptProgressResult.error) throw conceptProgressResult.error
  if (progressResult.error) throw progressResult.error

  const conceptRows = conceptProgressResult.data || []
  const conceptMemory: LearningMemory = conceptRows.length
    ? {
        version: 1,
        concepts: Object.fromEntries(
          conceptRows
            .map(row => row.memory_data as ConceptMemory)
            .filter(Boolean)
            .map(record => [record.id, record]),
        ),
      }
    : ((progressResult.data?.learning_memory as LearningMemory) || emptyLearningMemory())

  return {
    materials: (materialsResult.data || []).map(normalizeCloudMaterial).filter(Boolean) as StudyMaterial[],
    progress: progressResult.data || conceptRows.length ? {
      learningMemory: conceptMemory,
      demoMastery: Number(progressResult.data?.demo_mastery || 18),
      completedSteps: Array.isArray(progressResult.data?.completed_steps) ? progressResult.data.completed_steps as string[] : [],
    } : null,
  }
}

export async function saveCloudMaterial(userId: string, material: StudyMaterial) {
  const supabase = getSupabaseBrowser()
  if (!supabase) throw new Error('Supabase browser client is not configured')
  const now = new Date().toISOString()
  const contentUpdatedAt = material.updatedAt || material.semantic?.generatedAt || material.createdAt
  const { error } = await supabase.from('comprende_v1_user_materials').upsert({
    user_id: userId,
    material_id: material.id,
    material_name: material.name,
    material_data: material,
    file_path: material.originalFilePath || null,
    file_size: material.originalFileSize ?? null,
    mime_type: material.originalMimeType || null,
    content_updated_at: contentUpdatedAt,
    updated_at: now,
  }, { onConflict: 'user_id,material_id' })
  if (error) throw error
}

export async function saveCloudMaterials(userId: string, materials: StudyMaterial[]) {
  for (const material of materials) await saveCloudMaterial(userId, material)
}

export async function uploadMaterialOriginal(userId: string, materialId: string, file: File) {
  const supabase = getSupabaseBrowser()
  if (!supabase) throw new Error('Supabase browser client is not configured')
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : ''
  const path = `${userId}/${materialId}/original${extension}`
  const { error } = await supabase.storage.from(MATERIAL_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
  })
  if (error) throw error
  return path
}

export async function deleteCloudMaterial(userId: string, material: StudyMaterial) {
  const supabase = getSupabaseBrowser()
  if (!supabase) throw new Error('Supabase browser client is not configured')
  if (material.originalFilePath) {
    const { error: storageError } = await supabase.storage.from(MATERIAL_BUCKET).remove([material.originalFilePath])
    if (storageError) throw storageError
  }
  const tables = [
    ['comprende_v1_learning_events', 'material_id'],
    ['comprende_v1_concept_progress', 'material_id'],
    ['comprende_v1_lab_attempts', 'material_id'],
    ['comprende_v1_lab_progress', 'material_id'],
  ] as const
  for (const [table, column] of tables) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId).eq(column, material.id)
    if (error) throw error
  }
  const { error } = await supabase.from('comprende_v1_user_materials').delete().eq('user_id', userId).eq('material_id', material.id)
  if (error) throw error
}

export async function saveConceptProgress(userId: string, record: ConceptMemory, event?: MemoryEvent) {
  const supabase = getSupabaseBrowser()
  if (!supabase) throw new Error('Supabase browser client is not configured')
  const now = new Date().toISOString()
  const { error } = await supabase.from('comprende_v1_concept_progress').upsert({
    user_id: userId,
    material_id: record.materialId,
    material_name: record.materialName,
    concept: record.concept,
    concept_key: record.id,
    memory_data: record,
    updated_at: now,
  }, { onConflict: 'user_id,concept_key' })
  if (error) throw error

  if (event) {
    const { error: eventError } = await supabase.from('comprende_v1_learning_events').insert({
      user_id: userId,
      material_id: event.materialId,
      material_name: event.materialName,
      concept: event.concept,
      event_type: event.type,
      score: Math.max(0, Math.min(100, Math.round(event.score))),
      event_data: event,
      created_at: record.lastReviewedAt || now,
    })
    if (eventError) throw eventError
  }
}

export async function saveAllConceptProgress(userId: string, memory: LearningMemory) {
  const records = Object.values(memory.concepts || {})
  for (const record of records) await saveConceptProgress(userId, record)
}

export async function saveCloudShellState(userId: string, learningMemory: LearningMemory, demoMastery: number, completedSteps: string[]) {
  const supabase = getSupabaseBrowser()
  if (!supabase) throw new Error('Supabase browser client is not configured')
  const { error } = await supabase.from('comprende_v1_user_progress').upsert({
    user_id: userId,
    learning_memory: learningMemory,
    demo_mastery: demoMastery,
    completed_steps: completedSteps,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function migrateLocalStateToCloud(userId: string, localMaterials: StudyMaterial[], localMemory: LearningMemory, cloud: CloudState) {
  const mergedMaterials = mergeMaterialsForMigration(localMaterials, cloud.materials)
  const mergedMemory = mergeLearningMemoryForMigration(localMemory, cloud.progress?.learningMemory)
  await saveCloudMaterials(userId, mergedMaterials)
  await saveAllConceptProgress(userId, mergedMemory)
  await saveCloudShellState(
    userId,
    mergedMemory,
    cloud.progress?.demoMastery ?? 18,
    cloud.progress?.completedSteps ?? [],
  )
  markCloudMigrationComplete(userId)
  return {
    materials: mergedMaterials,
    progress: {
      learningMemory: mergedMemory,
      demoMastery: cloud.progress?.demoMastery ?? 18,
      completedSteps: cloud.progress?.completedSteps ?? [],
    },
  } satisfies CloudState
}
