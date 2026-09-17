import { createRoutedLabJson } from './_modelRouter'
import { hashObject, readAiCache, writeAiCache } from './_supabase'
import { sanitizeGenericLabPlan, validateGenericLabPlan } from '../src/labs/genericEngine'
import type { GenericLabPlan, GenericLabTemplate, LabRecommendation } from '../src/labs/types'

const PROMPT_VERSION = 'generic-lab-composer-v2.0'

const schema = {
  type: 'object', additionalProperties: false,
  required: ['id','concept','template','title','description','objective','estimatedMinutes','context','mission','controls','metrics','visualizations','challenge','transferPrompt','sourceGrounding'],
  properties: {
    id:{type:'string'}, concept:{type:'string'}, template:{type:'string',enum:['parameter-explorer','process-stepper','relationship-map','classification-sort','sequence-builder','comparison','matrix-explorer','truth-table','concept-simulator']},
    title:{type:'string'}, description:{type:'string'}, objective:{type:'string'}, estimatedMinutes:{type:'integer',minimum:5,maximum:15}, context:{type:'string'}, mission:{type:'string'},
    controls:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,required:['id','label','type','min','max','step','defaultNumber','defaultBoolean','defaultString','unit','options','help'],properties:{id:{type:'string'},label:{type:'string'},type:{type:'string',enum:['slider','toggle','select']},min:{type:'number'},max:{type:'number'},step:{type:'number'},defaultNumber:{type:'number'},defaultBoolean:{type:'boolean'},defaultString:{type:'string'},unit:{type:'string'},options:{type:'array',items:{type:'string'}},help:{type:'string'}}}},
    metrics:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,required:['id','label','expression','format','precision','help'],properties:{id:{type:'string'},label:{type:'string'},expression:{type:'string'},format:{type:'string',enum:['number','percent','boolean']},precision:{type:'integer',minimum:0,maximum:4},help:{type:'string'}}}},
    visualizations:{type:'array',maxItems:4,items:{type:'object',additionalProperties:false,required:['type','title','items','xControlId','yExpression','xMin','xMax','points','steps','nodes','edges','columns','rows'],properties:{type:{type:'string',enum:['bars','curve','process','relation','table']},title:{type:'string'},items:{type:'array',items:{type:'object',additionalProperties:false,required:['label','expression'],properties:{label:{type:'string'},expression:{type:'string'}}}},xControlId:{type:'string'},yExpression:{type:'string'},xMin:{type:'number'},xMax:{type:'number'},points:{type:'integer',minimum:16,maximum:80},steps:{type:'array',items:{type:'string'}},nodes:{type:'array',items:{type:'string'}},edges:{type:'array',items:{type:'object',additionalProperties:false,required:['from','to','label'],properties:{from:{type:'string'},to:{type:'string'},label:{type:'string'}}}},columns:{type:'array',items:{type:'string'}},rows:{type:'array',items:{type:'array',items:{type:'string'}}}}}},
    challenge:{type:'object',additionalProperties:false,required:['type','prompt','options','correctIndex','items','categories','classifyItems','pairs','explanation'],properties:{type:{type:'string',enum:['choice','order','classify','match']},prompt:{type:'string'},options:{type:'array',items:{type:'string'}},correctIndex:{type:'integer',minimum:0,maximum:8},items:{type:'array',items:{type:'string'}},categories:{type:'array',items:{type:'string'}},classifyItems:{type:'array',items:{type:'object',additionalProperties:false,required:['label','category'],properties:{label:{type:'string'},category:{type:'string'}}}},pairs:{type:'array',items:{type:'object',additionalProperties:false,required:['left','right'],properties:{left:{type:'string'},right:{type:'string'}}}},explanation:{type:'string'}}},
    transferPrompt:{type:'string'}, sourceGrounding:{type:'string'},
  },
} as const

function normalize(raw: any): GenericLabPlan {
  const controls = (raw.controls || []).map((control: any) => ({
    id: String(control.id || '').replace(/[^A-Za-z0-9_]/g, '_'), label: String(control.label || ''), type: control.type,
    min: Number(control.min || 0), max: Number(control.max || 100), step: Number(control.step || 1),
    defaultValue: control.type === 'toggle' ? Boolean(control.defaultBoolean) : control.type === 'select' ? String(control.defaultString || control.options?.[0] || '') : Number(control.defaultNumber || 0),
    unit: String(control.unit || ''), options: Array.isArray(control.options) ? control.options.map(String) : [], help: String(control.help || ''),
  }))
  const visuals = (raw.visualizations || []).map((visual: any) => {
    if (visual.type === 'bars') return { type:'bars' as const, title:String(visual.title || ''), items:(visual.items || []).slice(0,6).map((item:any)=>({label:String(item.label||''),expression:String(item.expression||'0')})) }
    if (visual.type === 'curve') return { type:'curve' as const, title:String(visual.title || ''), xControlId:String(visual.xControlId||''), yExpression:String(visual.yExpression||'0'), xMin:Number(visual.xMin||0), xMax:Number(visual.xMax||100), points:Number(visual.points||32) }
    if (visual.type === 'process') return { type:'process' as const, title:String(visual.title||''), steps:(visual.steps||[]).slice(0,8).map(String) }
    if (visual.type === 'relation') return { type:'relation' as const, title:String(visual.title||''), nodes:(visual.nodes||[]).slice(0,10).map(String), edges:(visual.edges||[]).slice(0,14).map((edge:any)=>({from:String(edge.from||''),to:String(edge.to||''),label:String(edge.label||'')})) }
    return { type:'table' as const, title:String(visual.title||''), columns:(visual.columns||[]).slice(0,6).map(String), rows:(visual.rows||[]).slice(0,10).map((row:any[]) => (row||[]).slice(0,6).map(String)) }
  })
  const c = raw.challenge || {}
  const challenge = c.type === 'order' ? { type:'order' as const, prompt:String(c.prompt||''), items:(c.items||[]).slice(0,7).map(String), explanation:String(c.explanation||'') }
    : c.type === 'classify' ? { type:'classify' as const, prompt:String(c.prompt||''), categories:(c.categories||[]).slice(0,5).map(String), items:(c.classifyItems||[]).slice(0,9).map((item:any)=>({label:String(item.label||''),category:String(item.category||'')})), explanation:String(c.explanation||'') }
    : c.type === 'match' ? { type:'match' as const, prompt:String(c.prompt||''), pairs:(c.pairs||[]).slice(0,7).map((pair:any)=>({left:String(pair.left||''),right:String(pair.right||'')})), explanation:String(c.explanation||'') }
    : { type:'choice' as const, prompt:String(c.prompt||''), options:(c.options||[]).slice(0,6).map(String), correctIndex:Math.max(0, Math.min((c.options||[]).length-1, Number(c.correctIndex||0))), explanation:String(c.explanation||'') }
  return sanitizeGenericLabPlan({
    id:String(raw.id||'generic-lab'), concept:String(raw.concept||''), template:raw.template, title:String(raw.title||''), description:String(raw.description||''), objective:String(raw.objective||''), estimatedMinutes:Number(raw.estimatedMinutes||8), context:String(raw.context||''), mission:String(raw.mission||''), controls,
    metrics:(raw.metrics||[]).slice(0,6).map((metric:any)=>({id:String(metric.id||'').replace(/[^A-Za-z0-9_]/g,'_'),label:String(metric.label||''),expression:String(metric.expression||'0'),format:metric.format,precision:Number(metric.precision||0),help:String(metric.help||'')})),
    visualizations:visuals, challenge, transferPrompt:String(raw.transferPrompt||''), sourceGrounding:String(raw.sourceGrounding||''),
  } as GenericLabPlan)
}

function promptFor(args: { concept:string; materialName:string; excerpts:string[]; recommendation:LabRecommendation; studyQuestion:string; prerequisites:string[]; repair?:string; previous?:unknown }) {
  const template = args.recommendation.genericTemplate && args.recommendation.genericTemplate !== 'none' ? args.recommendation.genericTemplate : 'concept-simulator'
  return `Diseña la CONFIGURACIÓN DECLARATIVA de un laboratorio universitario para Comprende 2.0. NO escribas código, JSX ni JavaScript.

CONCEPTO: ${args.concept}
MATERIAL: ${args.materialName}
PLANTILLA PEDAGÓGICA ELEGIDA: ${template}
MODO: ${args.recommendation.practiceMode}
MOTIVO DEL PLANIFICADOR: ${args.recommendation.reason}
PREGUNTA DE COMPRENSIÓN: ${args.studyQuestion || '(sin pregunta)'}
PRERREQUISITOS: ${args.prerequisites.join(', ') || '(ninguno explícito)'}

EVIDENCIA DEL DOCUMENTO:
${args.excerpts.map((excerpt,i)=>`[${i+1}] ${excerpt}`).join('\n')}

REGLAS CRÍTICAS
- El laboratorio debe enseñar SOLO lo respaldado por la evidencia. Si falta una fórmula, no inventes una: usa relación, proceso, comparación, clasificación, ordenamiento o matching.
- La IA solo diseña configuración. La ejecución será segura y determinista.
- Expresiones numéricas/booleanas usan un DSL, NO JavaScript. Variables permitidas = ids de controls. Operadores: + - * / ^ > < >= <= == != && || !. Funciones: min(), max(), abs(), sqrt(), exp(), log(), sigmoid(), round(). NO ternarios, arrays, propiedades, código ni llamadas externas.
- Máximo 6 controles, 6 métricas y 4 visualizaciones. Una experiencia clara gana a una compleja.
- Sliders: ids simples ASCII, rangos razonables y defaults dentro del rango. Toggles para estados booleanos. Selects solo cuando cambiar una categoría aporta intuición.
- visualizations: bars para magnitudes comparables; curve SOLO si hay una relación cuantitativa respaldada; process para algoritmos/fases; relation para jerarquías/grafos conceptuales; table para matrices, comparaciones o tablas de verdad.
- challenge debe comprobar uso del concepto. No preguntes una definición literal.
- sourceGrounding debe explicar en 1-2 frases qué partes de la evidencia justifican el diseño y qué NO está siendo inferido.
- Si el concepto es cualitativo, no fuerces números. Un buen laboratorio puede ser process/relation/table + order/classify/match.
- Español mexicano, texto compacto y legible.

PLANTILLAS
- parameter-explorer: 1-4 variables + métricas + bars/curve si la evidencia da fórmula.
- process-stepper: process + reto de ordenar/decidir.
- relationship-map: relation + matching/clasificación.
- classification-sort: categorías + ejemplos + classify.
- sequence-builder: fases/estados + order.
- comparison: table + choice/classify.
- matrix-explorer: table/matriz + controles solo si la evidencia define operaciones.
- truth-table: toggles booleanos + métricas booleanas + table.
- concept-simulator: composición mínima de controles/representación/reto según evidencia.

${args.repair ? `REPARACIÓN OBLIGATORIA: ${args.repair}\nPLAN ANTERIOR RECHAZADO: ${JSON.stringify(args.previous).slice(0,7000)}` : ''}`
}

export default async function handler(req:any,res:any) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'})
  try {
    const { concept, materialName, excerpts, recommendation, studyQuestion, prerequisites, forceRefresh } = req.body || {}
    if (!concept || !recommendation?.recommended || recommendation?.labType !== 'generic') return res.status(400).json({error:'Generic lab recommendation required'})
    const cleanExcerpts = Array.isArray(excerpts) ? excerpts.slice(0,4).map(String) : []
    const sourceHash = hashObject({ concept, materialName, excerpts:cleanExcerpts, recommendation, studyQuestion, prerequisites })
    const cacheKey = `generic-lab:${PROMPT_VERSION}:${sourceHash}`
    if (!forceRefresh) {
      const cached = await readAiCache<any>(cacheKey)
      if (cached?.plan) return res.status(200).json({ ...cached, cached:true })
    }
    let routed = await createRoutedLabJson<any>({ prompt:promptFor({concept,materialName,excerpts:cleanExcerpts,recommendation,studyQuestion,prerequisites:prerequisites||[]}), schemaName:'comprende_generic_lab_v2', schema, systemPrompt:'Eres un diseñador de laboratorios educativos universales. Generas configuración declarativa segura y fiel al material. Nunca generas código ejecutable ni inventas fórmulas ausentes.', maxOutputTokens: 3200 })
    let plan = normalize(routed.data)
    let validation = validateGenericLabPlan(plan)
    if (!validation.valid) {
      const repaired = await createRoutedLabJson<any>({ prompt:promptFor({concept,materialName,excerpts:cleanExcerpts,recommendation,studyQuestion,prerequisites:prerequisites||[],repair:validation.warnings.join(' | '),previous:routed.data}), schemaName:'comprende_generic_lab_v2_repair', schema, systemPrompt:'Repara una configuración de laboratorio. Corrige exactamente los errores de validación, mantén fidelidad al material y no generes código.', maxOutputTokens: 3200 })
      routed = repaired
      plan = normalize(repaired.data)
      validation = validateGenericLabPlan(plan)
    }
    if (!validation.valid) return res.status(422).json({error:`Plan rechazado por validador: ${validation.warnings.join(' | ')}`})
    const payload = { plan:{...plan,validation}, provider:routed.provider, model:routed.model }
    await writeAiCache({cacheKey,artifactKind:'generic_lab_plan',sourceHash,promptVersion:PROMPT_VERSION,modelId:`${routed.provider}:${routed.model}`,payload,metadata:{concept,template:recommendation.genericTemplate,materialName}})
    return res.status(200).json({...payload,cached:false})
  } catch(error) {
    return res.status(500).json({error:error instanceof Error ? error.message : 'Generic lab composer failed'})
  }
}
