import { useMemo, useState } from 'react'
import { Check, RotateCcw, Trash2 } from 'lucide-react'
import type { LabComponentProps, LabResult } from './types'

type State = 'Soleado' | 'Lluvioso'
type Observation = 'Paraguas' | 'Sin paraguas'

function viterbi(observations: Observation[], sunnyStay: number, rainyStay: number, umbrellaRain: number, umbrellaSunny: number) {
  const states: State[] = ['Soleado', 'Lluvioso']
  if (!observations.length) return { path: [] as State[], probability: 0 }
  const transition: Record<State, Record<State, number>> = {
    Soleado: { Soleado: sunnyStay, Lluvioso: 1 - sunnyStay },
    Lluvioso: { Soleado: 1 - rainyStay, Lluvioso: rainyStay },
  }
  const emission = (state: State, obs: Observation) => {
    const umbrella = state === 'Lluvioso' ? umbrellaRain : umbrellaSunny
    return obs === 'Paraguas' ? umbrella : 1 - umbrella
  }
  const initial: Record<State, number> = { Soleado: .6, Lluvioso: .4 }
  const dp: Record<State, number>[] = []
  const back: Record<State, State | null>[] = []
  dp[0] = { Soleado: initial.Soleado * emission('Soleado', observations[0]), Lluvioso: initial.Lluvioso * emission('Lluvioso', observations[0]) }
  back[0] = { Soleado: null, Lluvioso: null }
  for (let t = 1; t < observations.length; t++) {
    dp[t] = { Soleado: 0, Lluvioso: 0 }
    back[t] = { Soleado: null, Lluvioso: null }
    for (const current of states) {
      let bestPrev: State = states[0]
      let bestValue = -1
      for (const prev of states) {
        const value = dp[t - 1][prev] * transition[prev][current] * emission(current, observations[t])
        if (value > bestValue) { bestValue = value; bestPrev = prev }
      }
      dp[t][current] = bestValue
      back[t][current] = bestPrev
    }
  }
  const lastIndex = observations.length - 1
  let last: State = dp[lastIndex].Lluvioso > dp[lastIndex].Soleado ? 'Lluvioso' : 'Soleado'
  const probability = dp[lastIndex][last]
  const path: State[] = [last]
  for (let t = lastIndex; t > 0; t--) { last = back[t][last] || 'Soleado'; path.unshift(last) }
  return { path, probability }
}

export default function HMMLab({ narrative, previousBest = 0, onComplete }: LabComponentProps) {
  const [observations, setObservations] = useState<Observation[]>(['Paraguas','Paraguas','Sin paraguas'])
  const [sunnyStay, setSunnyStay] = useState(.75)
  const [rainyStay, setRainyStay] = useState(.7)
  const [umbrellaRain, setUmbrellaRain] = useState(.85)
  const [umbrellaSunny, setUmbrellaSunny] = useState(.15)
  const [answer, setAnswer] = useState('')
  const [interactions, setInteractions] = useState(0)
  const [saved, setSaved] = useState(false)
  const inference = useMemo(() => viterbi(observations, sunnyStay, rainyStay, umbrellaRain, umbrellaSunny), [observations, sunnyStay, rainyStay, umbrellaRain, umbrellaSunny])
  const correct = answer === 'hidden'
  const score = Math.min(100, (observations.length >= 3 ? 30 : 0) + (interactions > 0 ? 30 : 0) + (correct ? 40 : 0))
  const completed = observations.length >= 3 && interactions > 0 && Boolean(answer)
  const touch = () => { setInteractions(v => v + 1); setSaved(false) }
  const addObservation = (obs: Observation) => { if (observations.length >= 7) return; setObservations(v => [...v, obs]); touch() }
  const save = () => { if (!completed) return; const payload: LabResult = { score, completed: score >= 70, interactions, detail: `Viterbi sobre ${observations.length} observaciones: ${inference.path.join(' → ')}.`, state: { observations, path: inference.path, sunnyStay, rainyStay, umbrellaRain, umbrellaSunny } }; onComplete(payload); setSaved(true) }

  return <div className="lab-experience hmm-lab">
    <div className="lab-scenario"><span>ESCENARIO</span><h3>{narrative.title}</h3><p>{narrative.context}</p><b>{narrative.mission}</b></div>
    <section className="hmm-builder-card">
      <div className="lab-card-heading"><div><span>1</span><strong>Construye lo que sí puedes observar</strong></div><small>Máximo 7 observaciones para mantener visible el razonamiento.</small></div>
      <div className="hmm-observation-actions"><button onClick={() => addObservation('Paraguas')}>☂️ Paraguas</button><button onClick={() => addObservation('Sin paraguas')}>☀️ Sin paraguas</button><button onClick={() => { setObservations([]); touch() }}><Trash2 size={14}/> Limpiar</button></div>
      <div className="hmm-sequence"><div className="hmm-row-label">Observado</div><div className="hmm-sequence-items">{observations.length ? observations.map((obs,i) => <span key={`${obs}-${i}`}>{obs === 'Paraguas' ? '☂️' : '☀️'}<small>{obs}</small></span>) : <em>Agrega observaciones.</em>}</div></div>
      <div className="hmm-sequence inferred"><div className="hmm-row-label">Viterbi</div><div className="hmm-sequence-items">{inference.path.map((state,i) => <span key={`${state}-${i}`} className={state === 'Lluvioso' ? 'rainy' : 'sunny'}>{state === 'Lluvioso' ? '🌧️' : '🌤️'}<small>{state}</small></span>)}</div></div>
    </section>
    <section className="lab-controls-card">
      <div className="lab-card-heading"><div><span>2</span><strong>Manipula transición y emisión</strong></div></div>
      <div className="hmm-slider-grid">
        <label>P(Soleado→Soleado) <b>{Math.round(sunnyStay*100)}%</b><input type="range" min="50" max="95" value={sunnyStay*100} onChange={(e: any) => { setSunnyStay(Number(e.target.value)/100); touch() }} /></label>
        <label>P(Lluvioso→Lluvioso) <b>{Math.round(rainyStay*100)}%</b><input type="range" min="50" max="95" value={rainyStay*100} onChange={(e: any) => { setRainyStay(Number(e.target.value)/100); touch() }} /></label>
        <label>P(Paraguas|Lluvioso) <b>{Math.round(umbrellaRain*100)}%</b><input type="range" min="50" max="99" value={umbrellaRain*100} onChange={(e: any) => { setUmbrellaRain(Number(e.target.value)/100); touch() }} /></label>
        <label>P(Paraguas|Soleado) <b>{Math.round(umbrellaSunny*100)}%</b><input type="range" min="1" max="50" value={umbrellaSunny*100} onChange={(e: any) => { setUmbrellaSunny(Number(e.target.value)/100); touch() }} /></label>
      </div>
      <div className="hmm-explain-strip"><strong>Qué está haciendo Viterbi</strong><span>Compara rutas completas de estados y conserva, en cada paso, la ruta más probable que podría haber producido las observaciones.</span></div>
    </section>
    <section className="lab-challenge-card"><div className="lab-card-heading"><div><span>3</span><strong>Identifica qué es realmente “oculto”</strong></div></div><p>En este laboratorio, ¿qué parte no observas directamente?</p><div className="lab-choice-grid"><button className={answer === 'obs' ? 'selected' : ''} onClick={() => { setAnswer('obs'); setSaved(false) }}>Si aparece un paraguas.</button><button className={answer === 'hidden' ? 'selected' : ''} onClick={() => { setAnswer('hidden'); setSaved(false) }}>El estado real del clima.</button><button className={answer === 'sequence' ? 'selected' : ''} onClick={() => { setAnswer('sequence'); setSaved(false) }}>La longitud de la secuencia.</button></div>{answer && <div className={correct ? 'lab-feedback good' : 'lab-feedback'}><strong>{correct ? 'Exacto.' : 'No.'}</strong><span>Las observaciones son visibles; los estados que las originan son lo que inferimos.</span></div>}</section>
    <div className="lab-completion-bar"><div><span>Resultado actual</span><strong>{score}%</strong><small>Mejor anterior: {previousBest}%</small></div><button className="primary-button" disabled={!completed || saved} onClick={save}>{saved ? <><Check size={15}/> Guardado</> : 'Guardar resultado'}</button><button className="secondary-button" onClick={() => { setObservations(['Paraguas','Paraguas','Sin paraguas']); setSunnyStay(.75); setRainyStay(.7); setUmbrellaRain(.85); setUmbrellaSunny(.15); setAnswer(''); setInteractions(0); setSaved(false) }}><RotateCcw size={14}/> Reiniciar</button></div>
    <div className="lab-transfer"><strong>Transfiérelo:</strong><p>{narrative.transferPrompt}</p></div>
  </div>
}
