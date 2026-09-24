export type MemoryEventType = 'practice' | 'teachback' | 'manual' | 'prerequisite' | 'lab'

export type MemoryHistoryItem = {
  at: string
  type: MemoryEventType
  score: number
  detail?: string
}

export type ConceptMemory = {
  id: string
  materialId: string
  materialName: string
  concept: string
  mastery: number
  practiceAccuracy: number | null
  teachBackScore: number | null
  attempts: number
  streak: number
  lapses: number
  intervalDays: number
  stability: number
  lastReviewedAt: string
  nextReviewAt: string
  lastEvent: MemoryEventType
  history: MemoryHistoryItem[]
  completedAt?: string
  completionScore?: number
  completionCount?: number
}

export type LearningMemory = {
  version: 1
  concepts: Record<string, ConceptMemory>
}

export type MemoryEvent = {
  materialId: string
  materialName: string
  concept: string
  type: MemoryEventType
  score: number
  practiceAccuracy?: number
  teachBackScore?: number
  detail?: string
  completed?: boolean
}

const STORAGE_KEY = 'comprende-learning-memory-v1'

function storageKey(userId?: string) {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const keyFor = (materialId: string, concept: string) => `${materialId}::${concept.toLocaleLowerCase('es-MX')}`

export function emptyLearningMemory(): LearningMemory {
  return { version: 1, concepts: {} }
}

export function loadLearningMemory(userId?: string): LearningMemory {
  try {
    const scoped = userId ? localStorage.getItem(storageKey(userId)) : null
    const raw = scoped || localStorage.getItem(STORAGE_KEY) || 'null'
    const parsed = JSON.parse(raw) as LearningMemory | null
    if (!parsed || parsed.version !== 1 || !parsed.concepts) return emptyLearningMemory()
    return parsed
  } catch {
    return emptyLearningMemory()
  }
}

export function saveLearningMemory(memory: LearningMemory, userId?: string) {
  localStorage.setItem(storageKey(userId), JSON.stringify(memory))
}

export function clearLearningMemoryCache(userId?: string) {
  localStorage.removeItem(storageKey(userId))
  if (userId) localStorage.removeItem(STORAGE_KEY)
}

function evidenceWeight(type: MemoryEventType) {
  if (type === 'teachback') return 0.42
  if (type === 'practice') return 0.34
  if (type === 'lab') return 0.38
  if (type === 'prerequisite') return 0.22
  return 0.18
}

function nextInterval(previous: ConceptMemory | undefined, score: number) {
  if (score < 50) return 1
  if (score < 65) return previous?.intervalDays && previous.intervalDays > 1 ? 1 : 2
  if (score < 78) return Math.max(2, Math.min(4, Math.round((previous?.intervalDays || 1) * 1.7)))
  if (score < 90) return Math.max(4, Math.min(10, Math.round((previous?.intervalDays || 2) * 2.0)))
  return Math.max(7, Math.min(30, Math.round((previous?.intervalDays || 3) * 2.35)))
}

export function applyMemoryEvent(memory: LearningMemory, event: MemoryEvent): LearningMemory {
  const now = new Date()
  const id = keyFor(event.materialId, event.concept)
  const previous = memory.concepts[id]
  const score = clamp(Math.round(event.score), 0, 100)
  const weight = evidenceWeight(event.type)
  const previousMastery = previous?.mastery ?? 35
  let mastery = Math.round(previousMastery * (1 - weight) + score * weight)

  // A failed retrieval should matter more than a passive/manual signal.
  if ((event.type === 'teachback' || event.type === 'practice' || event.type === 'lab') && score < 50) mastery = Math.max(15, mastery - 8)
  if (score >= 90 && previous?.mastery && previous.mastery >= 80) mastery = Math.min(100, mastery + 3)

  const intervalDays = nextInterval(previous, score)
  const next = new Date(now)
  next.setDate(next.getDate() + intervalDays)
  const passed = score >= 65

  const record: ConceptMemory = {
    id,
    materialId: event.materialId,
    materialName: event.materialName,
    concept: event.concept,
    mastery,
    practiceAccuracy: event.practiceAccuracy ?? previous?.practiceAccuracy ?? null,
    teachBackScore: event.teachBackScore ?? previous?.teachBackScore ?? null,
    attempts: (previous?.attempts || 0) + 1,
    streak: passed ? (previous?.streak || 0) + 1 : 0,
    lapses: (previous?.lapses || 0) + (passed ? 0 : 1),
    intervalDays,
    stability: clamp(Math.round((previous?.stability || 1) * (passed ? 1.35 : 0.72) + (score / 100)), 1, 30),
    lastReviewedAt: now.toISOString(),
    nextReviewAt: next.toISOString(),
    lastEvent: event.type,
    history: [
      ...(previous?.history || []),
      { at: now.toISOString(), type: event.type, score, detail: event.detail },
    ].slice(-18),
    completedAt: event.completed ? now.toISOString() : previous?.completedAt,
    completionScore: event.completed ? score : previous?.completionScore,
    completionCount: (previous?.completionCount || 0) + (event.completed ? 1 : 0),
  }

  return { ...memory, concepts: { ...memory.concepts, [id]: record } }
}

export function memoryStatus(record: ConceptMemory, now = new Date()): 'due' | 'fragile' | 'learning' | 'solid' {
  if (new Date(record.nextReviewAt).getTime() <= now.getTime()) return 'due'
  if (record.mastery < 58 || record.lapses >= 2) return 'fragile'
  if (record.mastery >= 82 && record.streak >= 2) return 'solid'
  return 'learning'
}

export function getMemoryRecords(memory: LearningMemory) {
  return Object.values(memory.concepts).sort((a, b) => {
    const aStatus = memoryStatus(a)
    const bStatus = memoryStatus(b)
    const rank = { due: 0, fragile: 1, learning: 2, solid: 3 }
    if (rank[aStatus] !== rank[bStatus]) return rank[aStatus] - rank[bStatus]
    return new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()
  })
}

export function dueReviews(memory: LearningMemory, now = new Date()) {
  return getMemoryRecords(memory).filter(record => new Date(record.nextReviewAt).getTime() <= now.getTime())
}

export function fragileConcepts(memory: LearningMemory) {
  return getMemoryRecords(memory).filter(record => memoryStatus(record) === 'fragile')
}

export function solidConcepts(memory: LearningMemory) {
  return getMemoryRecords(memory).filter(record => memoryStatus(record) === 'solid')
}

export function formatReviewDate(iso: string) {
  const target = new Date(iso)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const days = Math.round((startTarget - startToday) / 86400000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  if (days < 7) return `En ${days} días`
  return target.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export function memoryLabel(record: ConceptMemory) {
  const status = memoryStatus(record)
  if (status === 'due') return 'Repasar hoy'
  if (status === 'fragile') return 'Frágil'
  if (status === 'solid') return 'Sólido'
  return 'Aprendiendo'
}

export function conceptIsCompleted(record: ConceptMemory | undefined) {
  return Boolean(record?.completedAt || typeof record?.teachBackScore === 'number')
}

export function conceptCompletionScore(record: ConceptMemory | undefined) {
  return record?.completionScore ?? record?.teachBackScore ?? record?.mastery ?? 0
}
