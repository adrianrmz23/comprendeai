import type { LabRecommendation } from './labs/types'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

export type MaterialConcept = {
  label: string
  score: number
  snippet: string
}

export type SemanticConcept = {
  label: string
  description: string
  category: 'principal' | 'subconcept' | 'foundation' | 'application'
  tier: 'essential' | 'deep'
  importance: number
  studyQuestion: string
  parent: string
  prerequisites: string[]
  related: string[]
  pages: number[]
  evidence: string[]
  lab?: LabRecommendation
}

export type SemanticRelation = {
  source: string
  target: string
  type: 'requires' | 'part_of' | 'related_to' | 'applies_to'
}

export type SemanticDocumentAnalysis = {
  engine: 'local' | 'openai' | 'hybrid'
  model: string
  generatedAt: string
  documentSummary: string
  chunksAnalyzed: number
  concepts: SemanticConcept[]
  relations: SemanticRelation[]
  learningOrder: string[]
  warnings: string[]
  labPlannerVersion?: string
}

export type StudyMaterial = {
  id: string
  name: string
  kind: 'pdf' | 'text'
  createdAt: string
  updatedAt?: string
  subject?: string
  text: string
  pages?: number
  pageRanges?: { page: number; start: number; end: number }[]
  concepts: MaterialConcept[]
  semantic?: SemanticDocumentAnalysis
  originalFilePath?: string
  originalFileSize?: number
  originalMimeType?: string
}

const STOPWORDS = new Set(`de la el en y a los las del que se por un una con para es al como más su sus o si no lo le desde sobre entre esta este estos estas son ser fue han hay también puede pueden cada muy sin ya cuando donde cual qué cómo porque pero hacia e esa ese esos esas esto esto mismo misma mediante dentro fuera todo toda todos todas otro otra otros otras tener tiene tienen hace hacen así tanto tan uno dos tres primer primera segundo segunda parte forma manera caso casos tipo tipos ejemplo ejemplos datos dato sistema sistemas concepto conceptos tema temas clase clases`.split(/\s+/))

function cleanToken(token: string) {
  return token
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñáéíóúü]/gi, '')
}

function sentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 45 && s.length < 650)
}

export function extractConcepts(text: string, limit = 12): MaterialConcept[] {
  const rawTokens = text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ-]{2,}/g) || []
  const cleaned = rawTokens.map(raw => ({ raw: raw.replace(/^-+|-+$/g, ''), key: cleanToken(raw) }))
  const unigram = new Map<string, { score: number; label: string }>()
  const phrases = new Map<string, { score: number; label: string }>()

  for (const token of cleaned) {
    if (!token.key || STOPWORDS.has(token.key) || token.key.length < 5) continue
    const current = unigram.get(token.key)
    unigram.set(token.key, { score: (current?.score || 0) + 1, label: current?.label || token.raw })
  }

  // Candidate multi-word concepts. We allow stopwords inside the phrase so names like
  // "teorema de Bayes" or "representación del conocimiento" survive extraction.
  for (let size = 2; size <= 4; size++) {
    for (let i = 0; i <= cleaned.length - size; i++) {
      const slice = cleaned.slice(i, i + size)
      const content = slice.filter(t => t.key && !STOPWORDS.has(t.key) && t.key.length >= 4)
      if (content.length < 2) continue
      if (STOPWORDS.has(slice[0].key) || STOPWORDS.has(slice[slice.length - 1].key)) continue
      const key = slice.map(t => t.key).join(' ')
      const label = slice.map(t => t.raw).join(' ')
      const current = phrases.get(key)
      phrases.set(key, { score: (current?.score || 0) + 1, label: current?.label || label })
    }
  }

  const sourceSentences = sentences(text)
  const candidates = [
    ...[...phrases.entries()].map(([key, value]) => ({ key, label: value.label, score: value.score * 2.3 + key.split(' ').length })),
    ...[...unigram.entries()].map(([key, value]) => ({ key, label: value.label, score: value.score })),
  ]
    .sort((a, b) => b.score - a.score || b.key.split(' ').length - a.key.split(' ').length)

  const selected: typeof candidates = []
  for (const candidate of candidates) {
    if (selected.length >= limit) break
    const words = new Set(candidate.key.split(' ').filter(w => !STOPWORDS.has(w)))
    const tooSimilar = selected.some(other => {
      const otherWords = new Set(other.key.split(' ').filter(w => !STOPWORDS.has(w)))
      const overlap = [...words].filter(w => otherWords.has(w)).length
      const ratio = overlap / Math.max(1, Math.min(words.size, otherWords.size))
      return ratio >= 0.8
    })
    if (!tooSimilar) selected.push(candidate)
  }

  return selected.map(({ key, label, score }) => {
    const searchTerms = key.split(' ').filter(w => !STOPWORDS.has(w))
    const snippet = sourceSentences
      .map(sentence => ({ sentence, hits: searchTerms.reduce((n, term) => n + (cleanToken(sentence).includes(term) ? 1 : 0), 0) }))
      .sort((a, b) => b.hits - a.hits)
      .find(item => item.hits > 0)?.sentence || text.slice(0, 420)
    const display = label
      .toLocaleLowerCase('es-MX')
      .replace(/^./, ch => ch.toLocaleUpperCase('es-MX'))
    return { label: display, score: Math.round(score), snippet }
  })
}

export function findRelevantExcerpts(text: string, query: string, limit = 3) {
  const terms = query.toLocaleLowerCase('es-MX').split(/\s+/).map(cleanToken).filter(Boolean)
  return sentences(text)
    .map(sentence => ({
      sentence,
      score: terms.reduce((n, term) => n + (cleanToken(sentence).includes(term) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score || b.sentence.length - a.sentence.length)
    .filter(item => item.score > 0)
    .slice(0, limit)
    .map(item => item.sentence)
}

export function scoreExplanation(answer: string, source: string, concept: string) {
  const answerTokens = new Set((answer.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,}/g) || []).map(cleanToken).filter(w => !STOPWORDS.has(w)))
  const sourceTokens = (source.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,}/g) || []).map(cleanToken).filter(w => !STOPWORDS.has(w))
  const important = [...new Set([cleanToken(concept), ...sourceTokens])].filter(Boolean).slice(0, 35)
  const overlap = important.filter(t => answerTokens.has(t)).length
  const length = answer.trim().split(/\s+/).filter(Boolean).length
  return Math.min(100, Math.round(22 + overlap * 7 + Math.min(length, 45) * 0.8))
}

export async function readStudyFile(file: File): Promise<StudyMaterial> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  let text = ''
  let pages: number | undefined
  let kind: StudyMaterial['kind'] = 'text'
  let pageRanges: { page: number; start: number; end: number }[] | undefined

  if (ext === 'pdf' || file.type === 'application/pdf') {
    kind = 'pdf'
    const data = new Uint8Array(await file.arrayBuffer())
    const pdf = await getDocument({ data }).promise
    pages = pdf.numPages
    const chunks: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map(item => ('str' in item ? item.str || '' : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      chunks.push(pageText)
    }
    let cursor = 0
    pageRanges = []
    text = chunks.map((chunk, index) => {
      const prefix = index === 0 ? '' : '\n\n'
      cursor += prefix.length
      const start = cursor
      cursor += chunk.length
      pageRanges!.push({ page: index + 1, start, end: cursor })
      return `${prefix}${chunk}`
    }).join('')
  } else {
    text = (await file.text()).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  }

  if (text.length < 80) throw new Error('No pude extraer suficiente texto de este archivo. Si es un PDF escaneado, necesitaremos OCR en un bloque posterior.')

  return {
    id: crypto.randomUUID(),
    name: file.name,
    kind,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    text,
    pages,
    pageRanges,
    originalFileSize: file.size,
    originalMimeType: file.type || (kind === 'pdf' ? 'application/pdf' : 'text/plain'),
    concepts: extractConcepts(text, 18),
  }
}
