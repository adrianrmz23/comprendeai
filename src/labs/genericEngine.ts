import type { GenericLabPlan, GenericLabTemplate } from './types.js'

type Token = { type: 'number' | 'id' | 'op' | 'paren' | 'comma'; value: string }

type ValueMap = Record<string, number | boolean | string>

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  abs: x => Math.abs(x),
  sqrt: x => Math.sqrt(Math.max(0, x)),
  exp: x => Math.exp(Math.min(40, x)),
  log: x => Math.log(Math.max(1e-12, x)),
  sigmoid: x => 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, x)))),
  round: x => Math.round(x),
}

const tokenize = (input: string): Token[] => {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const char = input[i]
    if (/\s/.test(char)) { i++; continue }
    if (/[0-9.]/.test(char)) {
      let raw = ''
      while (i < input.length && /[0-9.eE+-]/.test(input[i])) {
        if ((input[i] === '+' || input[i] === '-') && raw && !/[eE]$/.test(raw)) break
        raw += input[i++]
      }
      if (!Number.isFinite(Number(raw))) throw new Error('Número inválido')
      tokens.push({ type: 'number', value: raw }); continue
    }
    if (/[A-Za-z_]/.test(char)) {
      let raw = ''
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) raw += input[i++]
      tokens.push({ type: 'id', value: raw }); continue
    }
    const two = input.slice(i, i + 2)
    if (['>=','<=','==','!=','&&','||'].includes(two)) { tokens.push({ type: 'op', value: two }); i += 2; continue }
    if ('+-*/^><!'.includes(char)) { tokens.push({ type: 'op', value: char }); i++; continue }
    if ('()'.includes(char)) { tokens.push({ type: 'paren', value: char }); i++; continue }
    if (char === ',') { tokens.push({ type: 'comma', value: char }); i++; continue }
    throw new Error(`Símbolo no permitido: ${char}`)
  }
  if (tokens.length > 80) throw new Error('Expresión demasiado larga')
  return tokens
}

const numeric = (value: unknown) => {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function evaluateExpression(expression: string, values: ValueMap): number | boolean {
  const tokens = tokenize(expression)
  let pos = 0
  const peek = () => tokens[pos]
  const consume = () => tokens[pos++]
  const match = (value: string) => peek()?.value === value ? (consume(), true) : false

  const primary = (): number | boolean => {
    const token = consume()
    if (!token) throw new Error('Expresión incompleta')
    if (token.type === 'number') return Number(token.value)
    if (token.type === 'id') {
      if (token.value === 'true') return true
      if (token.value === 'false') return false
      if (match('(')) {
        if (!FUNCTIONS[token.value]) throw new Error(`Función no permitida: ${token.value}`)
        const args: number[] = []
        if (!match(')')) {
          do { args.push(numeric(orExpr())) } while (match(','))
          if (!match(')')) throw new Error('Falta cerrar función')
        }
        return FUNCTIONS[token.value](...args)
      }
      if (!(token.value in values)) throw new Error(`Variable desconocida: ${token.value}`)
      const value = values[token.value]
      return typeof value === 'boolean' ? value : numeric(value)
    }
    if (token.value === '(') {
      const value = orExpr()
      if (!match(')')) throw new Error('Falta paréntesis')
      return value
    }
    if (token.value === '!') return !Boolean(unary())
    if (token.value === '-') return -numeric(unary())
    if (token.value === '+') return numeric(unary())
    throw new Error('Token inesperado')
  }
  const unary = (): number | boolean => (peek()?.value === '!' || peek()?.value === '-' || peek()?.value === '+') ? primary() : primary()
  const power = (): number | boolean => { let left = unary(); while (match('^')) left = Math.pow(numeric(left), numeric(unary())); return left }
  const mul = (): number | boolean => { let left = power(); while (['*','/'].includes(peek()?.value || '')) { const op = consume().value; const right = numeric(power()); left = op === '*' ? numeric(left) * right : (Math.abs(right) < 1e-12 ? 0 : numeric(left) / right) } return left }
  const add = (): number | boolean => { let left = mul(); while (['+','-'].includes(peek()?.value || '')) { const op = consume().value; const right = numeric(mul()); left = op === '+' ? numeric(left) + right : numeric(left) - right } return left }
  const compare = (): number | boolean => {
    let left = add()
    while (['>','<','>=','<=','==','!='].includes(peek()?.value || '')) {
      const op = consume().value; const right = add(); const a = numeric(left); const b = numeric(right)
      left = op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b : op === '<=' ? a <= b : op === '==' ? a === b : a !== b
    }
    return left
  }
  const andExpr = (): number | boolean => { let left = compare(); while (match('&&')) { const right = compare(); left = Boolean(left) && Boolean(right) } return left }
  const orExpr = (): number | boolean => { let left = andExpr(); while (match('||')) { const right = andExpr(); left = Boolean(left) || Boolean(right) } return left }
  const result = orExpr()
  if (pos < tokens.length) throw new Error('Expresión no consumida por completo')
  if (typeof result === 'number' && !Number.isFinite(result)) return 0
  return result
}

export function validateGenericLabPlan(plan: GenericLabPlan) {
  const warnings: string[] = []
  if (!plan?.title || !plan?.concept || !plan?.challenge) return { valid: false, warnings: ['El plan está incompleto.'] }
  if (plan.controls.length > 6) warnings.push('Se limitaron los controles a seis para evitar sobrecarga.')
  if (plan.metrics.length > 6) warnings.push('Se limitaron las métricas a seis.')
  if (plan.visualizations.length > 4) warnings.push('Se limitaron las visualizaciones a cuatro.')
  const controlIds = new Set(plan.controls.slice(0, 6).map(control => control.id))
  const defaults: ValueMap = {}
  for (const control of plan.controls.slice(0, 6)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(control.id)) return { valid: false, warnings: [`ID de control inválido: ${control.id}`] }
    defaults[control.id] = control.defaultValue
    if (control.type === 'slider') {
      if (![control.min, control.max, control.step, control.defaultValue].every(value => typeof value === 'number' && Number.isFinite(value))) return { valid: false, warnings: [`Slider inválido: ${control.label}`] }
      if ((control.max as number) <= (control.min as number)) return { valid: false, warnings: [`Rango inválido: ${control.label}`] }
    }
  }
  const expressions: string[] = []
  plan.metrics.slice(0, 6).forEach(metric => expressions.push(metric.expression))
  plan.visualizations.slice(0, 4).forEach(visual => {
    if (visual.type === 'bars') visual.items.slice(0, 6).forEach(item => expressions.push(item.expression))
    if (visual.type === 'curve') expressions.push(visual.yExpression)
  })
  try { expressions.forEach(expression => evaluateExpression(expression, defaults)) } catch (error) { return { valid: false, warnings: [error instanceof Error ? error.message : 'Expresión inválida'] } }
  for (const visual of plan.visualizations) {
    if (visual.type === 'curve' && !controlIds.has(visual.xControlId)) return { valid: false, warnings: [`Curva usa control inexistente: ${visual.xControlId}`] }
    if (visual.type === 'curve' && visual.xMax <= visual.xMin) return { valid: false, warnings: ['La curva tiene un rango X inválido.'] }
    if (visual.type === 'relation') {
      const nodes = new Set(visual.nodes)
      if (visual.nodes.length < 2) return { valid: false, warnings: ['El mapa de relaciones necesita al menos dos nodos.'] }
      if (visual.edges.some(edge => !nodes.has(edge.from) || !nodes.has(edge.to))) return { valid: false, warnings: ['El mapa de relaciones contiene aristas con nodos inexistentes.'] }
    }
    if (visual.type === 'table' && (!visual.columns.length || !visual.rows.length)) return { valid: false, warnings: ['La tabla necesita columnas y filas.'] }
  }
  const challenge = plan.challenge
  if (challenge.type === 'choice') {
    if (challenge.options.length < 2 || challenge.correctIndex < 0 || challenge.correctIndex >= challenge.options.length) return { valid: false, warnings: ['El reto de opción necesita al menos dos opciones y una respuesta válida.'] }
  } else if (challenge.type === 'order') {
    if (challenge.items.length < 2) return { valid: false, warnings: ['El reto de orden necesita al menos dos elementos.'] }
  } else if (challenge.type === 'classify') {
    const categories = new Set(challenge.categories)
    if (challenge.categories.length < 2 || challenge.items.length < 2 || challenge.items.some(item => !categories.has(item.category))) return { valid: false, warnings: ['El reto de clasificación tiene categorías o respuestas inconsistentes.'] }
  } else if (challenge.type === 'match') {
    if (challenge.pairs.length < 2) return { valid: false, warnings: ['El reto de relaciones necesita al menos dos pares.'] }
  }
  return { valid: true, warnings }
}

export function sanitizeGenericLabPlan(plan: GenericLabPlan): GenericLabPlan {
  return {
    ...plan,
    estimatedMinutes: Math.max(5, Math.min(15, Number(plan.estimatedMinutes) || 8)),
    controls: (plan.controls || []).slice(0, 6),
    metrics: (plan.metrics || []).slice(0, 6),
    visualizations: (plan.visualizations || []).slice(0, 4).map(visual => visual.type === 'curve' ? { ...visual, points: Math.max(16, Math.min(80, visual.points || 32)) } : visual),
  }
}

export function buildFallbackGenericPlan(concept: string, template: Exclude<GenericLabTemplate, 'none'> = 'concept-simulator'): GenericLabPlan {
  const common = {
    id: `generic-${concept.toLocaleLowerCase('es-MX').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45)}-v1`,
    concept,
    template,
    title: `Laboratorio interactivo: ${concept}`,
    description: 'Explora el concepto con una experiencia componible y comprueba tu comprensión con una decisión concreta.',
    objective: `Construir intuición sobre ${concept} sin memorizar la explicación de forma pasiva.`,
    estimatedMinutes: 8,
    context: `Comprende detectó que ${concept} se beneficia de una experiencia interactiva, pero no existe un motor especializado. Este laboratorio usa componentes genéricos seguros.`,
    mission: 'Explora la representación, cambia la información disponible y después responde el reto.',
    controls: [],
    metrics: [],
    visualizations: [{ type: 'process' as const, title: 'Recorrido del concepto', steps: ['Identifica qué entra al proceso', 'Observa la transformación o relación principal', 'Comprueba qué resultado o decisión produce'] }],
    challenge: { type: 'choice' as const, prompt: `¿Qué demuestra mejor que comprendiste ${concept}?`, options: ['Poder repetir su definición literalmente', 'Poder explicar qué cambia y cuándo usarlo', 'Recordar solo el nombre del tema'], correctIndex: 1, explanation: 'Comprender implica reconocer el mecanismo, sus condiciones y cuándo resulta útil.' },
    transferPrompt: `¿En qué otra situación podrías reconocer el mismo patrón de ${concept}?`,
    sourceGrounding: 'Fallback local: usa la estructura conceptual detectada, sin añadir cálculos externos.',
  }
  if (template === 'truth-table') return { ...common, controls: [{ id: 'p', label: 'Proposición P', type: 'toggle', defaultValue: true }, { id: 'q', label: 'Proposición Q', type: 'toggle', defaultValue: false }], metrics: [{ id: 'and', label: 'P AND Q', expression: 'p && q', format: 'boolean', precision: 0, help: 'Solo es verdadero cuando ambas proposiciones lo son.' }, { id: 'or', label: 'P OR Q', expression: 'p || q', format: 'boolean', precision: 0, help: 'Es verdadero cuando al menos una proposición lo es.' }], visualizations: [{ type: 'table', title: 'Lectura lógica', columns: ['P', 'Q', 'P AND Q', 'P OR Q'], rows: [['V','V','V','V'],['V','F','F','V'],['F','V','F','V'],['F','F','F','F']] }] }
  if (template === 'parameter-explorer' || template === 'concept-simulator') return { ...common, controls: [{ id: 'x', label: 'Variable principal', type: 'slider', min: 0, max: 100, step: 1, defaultValue: 50, unit: '', help: 'Variable de exploración genérica.' }], metrics: [{ id: 'relative', label: 'Nivel relativo', expression: 'x / 100', format: 'percent', precision: 0, help: 'Representación normalizada para observar cómo cambia una magnitud.' }], visualizations: [{ type: 'bars', title: 'Cambio relativo', items: [{ label: 'Nivel actual', expression: 'x' }, { label: 'Resto', expression: '100-x' }] }] }
  if (template === 'relationship-map') return { ...common, visualizations: [{ type: 'relation', title: 'Estructura conceptual', nodes: ['Concepto', 'Componente', 'Resultado'], edges: [{ from: 'Concepto', to: 'Componente', label: 'se organiza mediante' }, { from: 'Componente', to: 'Resultado', label: 'produce / explica' }] }] }
  if (template === 'process-stepper' || template === 'sequence-builder') return { ...common, visualizations: [{ type: 'process', title: 'Proceso', steps: ['Entrada o estado inicial', 'Transformación intermedia', 'Resultado o estado final'] }], challenge: { type: 'order', prompt: 'Ordena el proceso de forma lógica.', items: ['Entrada o estado inicial', 'Transformación intermedia', 'Resultado o estado final'], explanation: 'El orden causal/procedimental permite explicar cómo se obtiene el resultado.' } }
  if (template === 'classification-sort') return { ...common, challenge: { type: 'classify', prompt: 'Clasifica cada elemento según su función conceptual.', categories: ['Entrada', 'Proceso', 'Salida'], items: [{ label: 'Información inicial', category: 'Entrada' }, { label: 'Regla o transformación', category: 'Proceso' }, { label: 'Resultado obtenido', category: 'Salida' }], explanation: 'Separar entradas, proceso y salidas ayuda a entender la función de cada componente.' } }
  if (template === 'comparison') return { ...common, visualizations: [{ type: 'table', title: 'Comparación guiada', columns: ['Aspecto', 'Opción A', 'Opción B'], rows: [['Supuesto principal','Revisa el material','Revisa el material'],['Cuándo conviene','Identifica condiciones','Identifica condiciones']] }] }
  if (template === 'matrix-explorer') return { ...common, visualizations: [{ type: 'table', title: 'Estructura matricial', columns: ['','C1','C2'], rows: [['F1','a11','a12'],['F2','a21','a22']] }], challenge: { type: 'choice', prompt: '¿Qué debes identificar antes de operar una matriz?', options: ['Solo el color de sus celdas', 'Sus dimensiones y el significado de filas/columnas', 'Únicamente el primer valor'], correctIndex: 1, explanation: 'Las dimensiones y el significado de cada eje determinan qué operaciones e interpretaciones tienen sentido.' } }
  return common
}
