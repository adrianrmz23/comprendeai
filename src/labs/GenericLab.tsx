import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, FlaskConical, Lightbulb, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { evaluateExpression } from './genericEngine'
import type { GenericChallenge, GenericLabPlan, GenericVisualization, LabResult } from './types'

type Props = {
  plan: GenericLabPlan
  previousBest?: number
  onComplete: (result: LabResult) => void
}

type ValueMap = Record<string, number | boolean | string>

function formatValue(value: number | boolean, format: 'number' | 'percent' | 'boolean', precision = 2) {
  if (format === 'boolean') return Boolean(value) ? 'Verdadero' : 'Falso'
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  if (format === 'percent') return `${(n * 100).toFixed(Math.max(0, precision))}%`
  return n.toFixed(Math.max(0, precision))
}

function safeEval(expression: string, values: ValueMap) {
  try { return evaluateExpression(expression, values) } catch { return 0 }
}

function GenericVisualizationView({ visual, values }: { visual: GenericVisualization; values: ValueMap }) {
  if (visual.type === 'bars') {
    const evaluated = visual.items.map(item => ({ ...item, value: Math.max(0, Number(safeEval(item.expression, values)) || 0) }))
    const max = Math.max(1, ...evaluated.map(item => item.value))
    return <article className="generic-viz-card"><strong>{visual.title}</strong><div className="generic-bars">{evaluated.map(item => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${Math.max(2, Math.min(100, item.value / max * 100))}%` }} /></i><em>{Number.isInteger(item.value) ? item.value : item.value.toFixed(2)}</em></div>)}</div></article>
  }
  if (visual.type === 'curve') {
    const control = values[visual.xControlId]
    const points = Array.from({ length: Math.max(16, Math.min(80, visual.points)) }, (_, index) => {
      const x = visual.xMin + (visual.xMax - visual.xMin) * index / (Math.max(2, visual.points) - 1)
      const y = Number(safeEval(visual.yExpression, { ...values, [visual.xControlId]: x })) || 0
      return { x, y }
    })
    const ys = points.map(p => p.y)
    const minY = Math.min(...ys); const maxY = Math.max(...ys); const spanY = Math.max(1e-9, maxY - minY)
    const d = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${10 + index / (points.length - 1) * 280} ${105 - (point.y - minY) / spanY * 90}`).join(' ')
    const currentX = typeof control === 'number' ? control : Number(control) || visual.xMin
    const cx = 10 + (currentX - visual.xMin) / Math.max(1e-9, visual.xMax - visual.xMin) * 280
    const cyValue = Number(safeEval(visual.yExpression, values)) || 0
    const cy = 105 - (cyValue - minY) / spanY * 90
    return <article className="generic-viz-card"><strong>{visual.title}</strong><svg className="generic-curve" viewBox="0 0 300 120" role="img" aria-label={visual.title}><path d={d} fill="none" stroke="currentColor" strokeWidth="3" /><line x1="10" y1="108" x2="292" y2="108" stroke="currentColor" opacity=".18"/><circle cx={Math.max(10, Math.min(290, cx))} cy={Math.max(8, Math.min(108, cy))} r="5" fill="currentColor" /></svg><small>Valor actual: {cyValue.toFixed(3)}</small></article>
  }
  if (visual.type === 'process') return <article className="generic-viz-card"><strong>{visual.title}</strong><div className="generic-process">{visual.steps.map((step, index) => <div key={`${step}-${index}`}><span>{index + 1}</span><p>{step}</p></div>)}</div></article>
  if (visual.type === 'relation') return <article className="generic-viz-card"><strong>{visual.title}</strong><div className="generic-relation"><div className="generic-relation-nodes">{visual.nodes.map(node => <span key={node}>{node}</span>)}</div><div className="generic-relation-edges">{visual.edges.map((edge, index) => <p key={`${edge.from}-${edge.to}-${index}`}><b>{edge.from}</b><em>→ {edge.label} →</em><b>{edge.to}</b></p>)}</div></div></article>
  return <article className="generic-viz-card"><strong>{visual.title}</strong><div className="generic-table-wrap"><table><thead><tr>{visual.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{visual.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div></article>
}

function GenericChallengeView({ challenge, onScored }: { challenge: GenericChallenge; onScored: (score: number, detail: string) => void }) {
  const [choice, setChoice] = useState<number | null>(null)
  const [ordered, setOrdered] = useState(() => challenge.type === 'order' ? [...challenge.items].reverse() : [])
  const [classified, setClassified] = useState<Record<string, string>>({})
  const [matched, setMatched] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<{ score: number; detail: string } | null>(null)

  const finish = (score: number, detail: string) => { setFeedback({ score, detail }); onScored(score, detail) }

  if (challenge.type === 'choice') return <div className="generic-challenge"><p>{challenge.prompt}</p><div className="lab-choice-grid">{challenge.options.map((option, index) => <button key={option} disabled={choice !== null} className={choice !== null && index === challenge.correctIndex ? 'correct' : choice === index ? 'selected' : ''} onClick={() => { setChoice(index); finish(index === challenge.correctIndex ? 100 : 45, challenge.explanation) }}>{option}</button>)}</div>{choice !== null && <div className={choice === challenge.correctIndex ? 'lab-feedback good' : 'lab-feedback'}><strong>{choice === challenge.correctIndex ? 'Bien razonado' : 'Revisa la relación'}</strong><span>{challenge.explanation}</span></div>}</div>

  if (challenge.type === 'order') {
    const move = (index: number, delta: number) => setOrdered(current => { const next = [...current]; const target = index + delta; if (target < 0 || target >= next.length) return next; [next[index], next[target]] = [next[target], next[index]]; return next })
    return <div className="generic-challenge"><p>{challenge.prompt}</p><div className="generic-order-list">{ordered.map((item, index) => <div key={item}><span>{index + 1}</span><p>{item}</p><button disabled={index === 0 || Boolean(feedback)} onClick={() => move(index, -1)} aria-label="Subir"><ArrowUp size={14}/></button><button disabled={index === ordered.length - 1 || Boolean(feedback)} onClick={() => move(index, 1)} aria-label="Bajar"><ArrowDown size={14}/></button></div>)}</div><button className="primary-button" disabled={Boolean(feedback)} onClick={() => { const correct = ordered.every((item, index) => item === challenge.items[index]); finish(correct ? 100 : 55, challenge.explanation) }}><Check size={14}/> Comprobar orden</button>{feedback && <div className={feedback.score >= 80 ? 'lab-feedback good' : 'lab-feedback'}><span>{feedback.detail}</span></div>}</div>
  }

  if (challenge.type === 'classify') return <div className="generic-challenge"><p>{challenge.prompt}</p><div className="generic-classify-grid">{challenge.items.map(item => <label key={item.label}><span>{item.label}</span><select disabled={Boolean(feedback)} value={classified[item.label] || ''} onChange={event => setClassified(current => ({ ...current, [item.label]: event.target.value }))}><option value="">Selecciona…</option>{challenge.categories.map(category => <option key={category}>{category}</option>)}</select></label>)}</div><button className="primary-button" disabled={Boolean(feedback) || challenge.items.some(item => !classified[item.label])} onClick={() => { const hits = challenge.items.filter(item => classified[item.label] === item.category).length; finish(Math.round(hits / Math.max(1, challenge.items.length) * 100), challenge.explanation) }}><Check size={14}/> Comprobar clasificación</button>{feedback && <div className={feedback.score >= 80 ? 'lab-feedback good' : 'lab-feedback'}><strong>{feedback.score}% correcto</strong><span>{feedback.detail}</span></div>}</div>

  return <div className="generic-challenge"><p>{challenge.prompt}</p><div className="generic-classify-grid">{challenge.pairs.map(pair => <label key={pair.left}><span>{pair.left}</span><select disabled={Boolean(feedback)} value={matched[pair.left] || ''} onChange={event => setMatched(current => ({ ...current, [pair.left]: event.target.value }))}><option value="">Relaciona con…</option>{challenge.pairs.map(option => <option key={option.right}>{option.right}</option>)}</select></label>)}</div><button className="primary-button" disabled={Boolean(feedback) || challenge.pairs.some(pair => !matched[pair.left])} onClick={() => { const hits = challenge.pairs.filter(pair => matched[pair.left] === pair.right).length; finish(Math.round(hits / Math.max(1, challenge.pairs.length) * 100), challenge.explanation) }}><Check size={14}/> Comprobar relaciones</button>{feedback && <div className={feedback.score >= 80 ? 'lab-feedback good' : 'lab-feedback'}><strong>{feedback.score}% correcto</strong><span>{feedback.detail}</span></div>}</div>
}

export default function GenericLab({ plan, previousBest = 0, onComplete }: Props) {
  const initial = useMemo(() => Object.fromEntries(plan.controls.map(control => [control.id, control.defaultValue])), [plan])
  const [values, setValues] = useState<ValueMap>(initial)
  const [interactions, setInteractions] = useState(0)
  const [challengeScore, setChallengeScore] = useState<number | null>(null)
  const [challengeDetail, setChallengeDetail] = useState('')
  const [saved, setSaved] = useState(false)
  const metrics = plan.metrics.map(metric => ({ ...metric, value: safeEval(metric.expression, values) }))
  const update = (id: string, value: number | boolean | string) => { setValues(current => ({ ...current, [id]: value })); setInteractions(count => count + 1); setSaved(false) }
  const score = Math.round(Math.min(100, Math.max(0, (challengeScore ?? 0) * 0.8 + Math.min(20, interactions * 3))))

  return <div className="generic-lab-experience">
    <section className="lab-scenario"><span>LABORATORIO COMPONIBLE · {plan.template.replace(/-/g, ' ').toUpperCase()}</span><h3>{plan.title}</h3><p>{plan.context}</p><b>{plan.mission}</b></section>

    <div className="generic-lab-grid">
      {plan.controls.length > 0 && <article className="lab-controls-card generic-controls"><div className="lab-card-heading"><div><span><SlidersHorizontal size={14}/></span><strong>Experimenta</strong></div><small>Cambia variables y observa qué permanece o qué se transforma.</small></div>{plan.controls.map(control => {
        const value = values[control.id]
        if (control.type === 'toggle') return <label className="generic-toggle" key={control.id}><span><b>{control.label}</b>{control.help && <small>{control.help}</small>}</span><input type="checkbox" checked={Boolean(value)} onChange={event => update(control.id, event.target.checked)} /></label>
        if (control.type === 'select') return <label className="generic-select" key={control.id}><span><b>{control.label}</b>{control.help && <small>{control.help}</small>}</span><select value={String(value)} onChange={event => update(control.id, event.target.value)}>{(control.options || []).map(option => <option key={option}>{option}</option>)}</select></label>
        return <label key={control.id}><span>{control.label}</span><b>{Number(value).toFixed((control.step || 1) < 1 ? 2 : 0)}{control.unit || ''}</b><input type="range" min={control.min} max={control.max} step={control.step} value={Number(value)} onChange={event => update(control.id, Number(event.target.value))} />{control.help && <small>{control.help}</small>}</label>
      })}<button className="ghost-button" onClick={() => { setValues(initial); setInteractions(0); setSaved(false) }}><RefreshCw size={14}/> Reiniciar</button></article>}

      {metrics.length > 0 && <article className="lab-result-card generic-metrics"><div className="lab-card-heading"><div><span><FlaskConical size={14}/></span><strong>Qué cambia</strong></div><small>Resultados calculados por el motor seguro de Comprende.</small></div><div className="generic-metric-grid">{metrics.map(metric => <div key={metric.id}><small>{metric.label}</small><strong>{formatValue(metric.value, metric.format, metric.precision)}</strong><p>{metric.help}</p></div>)}</div></article>}
    </div>

    {plan.visualizations.length > 0 && <div className="generic-visual-grid">{plan.visualizations.map((visual, index) => <GenericVisualizationView key={`${visual.type}-${index}`} visual={visual} values={values} />)}</div>}

    <article className="lab-challenge-card"><div className="lab-card-heading"><div><span><Lightbulb size={14}/></span><strong>Comprueba la intuición</strong></div><small>No se trata de repetir la definición: úsala.</small></div><GenericChallengeView challenge={plan.challenge} onScored={(value, detail) => { setChallengeScore(value); setChallengeDetail(detail); setSaved(false) }} /></article>

    <div className="lab-transfer"><strong>Transfiérelo</strong><p>{plan.transferPrompt}</p></div>
    <div className="generic-grounding"><strong>Por qué este laboratorio es válido</strong><p>{plan.sourceGrounding}</p>{plan.validation?.warnings?.length ? <small>{plan.validation.warnings.join(' · ')}</small> : null}</div>
    <div className="lab-completion-bar"><div><span>Puntuación del intento</span><strong>{challengeScore === null ? '—' : `${score}%`}</strong><small>{previousBest > 0 ? `Mejor anterior: ${previousBest}%` : 'Primer intento'}</small></div><button className="primary-button" disabled={challengeScore === null || saved} onClick={() => { onComplete({ score, completed: score >= 70, interactions, detail: challengeDetail || `Auto-Lab componible de ${plan.concept}`, state: { values, template: plan.template } }); setSaved(true) }}><Check size={14}/>{saved ? 'Guardado' : 'Guardar resultado'}</button></div>
  </div>
}
