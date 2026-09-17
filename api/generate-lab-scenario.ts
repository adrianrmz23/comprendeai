import { createRoutedLabJson } from './_modelRouter'
import { hashObject, readAiCache, writeAiCache } from './_supabase'

const PROMPT_VERSION = 'lab-narrative-v1.0'

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['id','title','context','mission','transferPrompt'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    context: { type: 'string' },
    mission: { type: 'string' },
    transferPrompt: { type: 'string' },
  },
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { concept, labType, materialName, excerpts, forceRefresh } = req.body || {}
    if (!concept || !labType) return res.status(400).json({ error: 'Missing concept or labType' })
    const sourceHash = hashObject({ concept, labType, materialName, excerpts: Array.isArray(excerpts) ? excerpts.slice(0, 4) : [] })
    const cacheKey = `lab-scenario:${PROMPT_VERSION}:${sourceHash}`
    if (!forceRefresh) {
      const cached = await readAiCache<any>(cacheKey)
      if (cached?.scenario) return res.status(200).json({ ...cached, cached: true })
    }

    const prompt = `Genera únicamente la NARRATIVA de un laboratorio interactivo universitario.
Concepto: ${concept}
Tipo de laboratorio: ${labType}
Material: ${materialName || 'Documento'}

EVIDENCIA DEL MATERIAL (úsala para respetar el tema, no para copiarla):
${Array.isArray(excerpts) ? excerpts.map((x: string, i: number) => `[${i + 1}] ${x}`).join('\n') : ''}

Reglas:
- Español mexicano, claro y breve.
- No programes, no calcules probabilidades ni inventes resultados numéricos.
- El laboratorio ya existe y sus matemáticas se ejecutan en TypeScript.
- Solo crea un caso del mundo real que haga intuitivo el concepto.
- title: máximo 14 palabras.
- context: 45-75 palabras.
- mission: una instrucción concreta para experimentar.
- transferPrompt: una pregunta final para llevar la idea a otra situación.
- id: slug corto y estable, sin espacios.

Dominios sugeridos según encaje: salud, fraude, spam, sensores, conducción autónoma, control industrial, clima, robótica, lenguaje.`

    const routed = await createRoutedLabJson<any>({ prompt, schemaName: 'comprende_lab_narrative', schema })
    const payload = { scenario: routed.data, provider: routed.provider, model: routed.model }
    await writeAiCache({ cacheKey, artifactKind: 'lab_scenario', sourceHash, promptVersion: PROMPT_VERSION, modelId: `${routed.provider}:${routed.model}`, payload, metadata: { concept, labType } })
    return res.status(200).json({ ...payload, cached: false })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Lab scenario error' })
  }
}
