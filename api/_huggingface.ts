type EmbeddingResult = {
  vectors: number[][]
  model: string
}

function modelPath(model: string) {
  return model.split('/').map(encodeURIComponent).join('/')
}

function meanVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) return []
  if (typeof value[0] === 'number') return (value as number[]).map(Number)
  const children = (value as unknown[]).map(meanVector).filter(vector => vector.length)
  if (!children.length) return []
  const size = Math.min(...children.map(vector => vector.length))
  const result = new Array(size).fill(0)
  for (const vector of children) for (let i = 0; i < size; i++) result[i] += vector[i]
  return result.map(n => n / children.length)
}

function normalizeVector(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map(value => value / norm)
}

export async function embedWithHuggingFace(texts: string[]): Promise<EmbeddingResult> {
  const token = process.env.HF_TOKEN
  if (!token) throw new Error('HF_TOKEN is not configured')
  const model = process.env.HF_EMBEDDING_MODEL || 'BAAI/bge-m3'
  const endpoint = `https://router.huggingface.co/hf-inference/models/${modelPath(model)}/pipeline/feature-extraction`
  const vectors: number[][] = []

  for (let start = 0; start < texts.length; start += 8) {
    const batch = texts.slice(start, start + 8)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: batch, normalize: true, truncate: true }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Hugging Face ${response.status}: ${detail.slice(0, 280)}`)
    }
    const data = await response.json()
    if (!Array.isArray(data)) throw new Error('Hugging Face returned an invalid embedding payload')

    // Con listas de entrada, normalmente recibimos un vector por texto. Algunos modelos
    // devuelven embeddings por token; meanVector los reduce de forma defensiva.
    if (batch.length === 1) {
      vectors.push(normalizeVector(meanVector(data)))
    } else {
      const rows = data as unknown[]
      for (let i = 0; i < batch.length; i++) vectors.push(normalizeVector(meanVector(rows[i])))
    }
  }

  if (vectors.length !== texts.length || vectors.some(vector => !vector.length)) {
    throw new Error('Hugging Face did not return one usable vector per chunk')
  }
  return { vectors, model }
}

export function cosine(a: number[], b: number[]) {
  const size = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < size; i++) sum += a[i] * b[i]
  return sum
}
