import { useMemo, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { LabComponentProps, LabResult } from './types'

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export default function FuzzyLogicLab({ narrative, previousBest = 0, onComplete }: LabComponentProps) {
  const [temperature, setTemperature] = useState(28)
  const [humidity, setHumidity] = useState(65)
  const [answer, setAnswer] = useState('')
  const [interactions, setInteractions] = useState(0)
  const [saved, setSaved] = useState(false)

  const values = useMemo(() => {
    const cold = clamp01((24 - temperature) / 12)
    const hot = clamp01((temperature - 20) / 15)
    const warm = clamp01(1 - Math.max(cold, hot))
    const dry = clamp01((60 - humidity) / 40)
    const humid = clamp01((humidity - 40) / 50)
    const comfortable = clamp01(1 - Math.max(dry, humid))
    const rules = [
      { name: 'caliente ∧ húmedo → potencia máxima', strength: Math.min(hot, humid), output: 100 },
      { name: 'caliente ∧ cómodo → potencia alta', strength: Math.min(hot, comfortable), output: 80 },
      { name: 'templado ∧ húmedo → potencia media-alta', strength: Math.min(warm, humid), output: 65 },
      { name: 'templado ∧ cómodo → potencia media', strength: Math.min(warm, comfortable), output: 45 },
      { name: 'frío → potencia baja', strength: cold, output: 15 },
      { name: 'caliente ∧ seco → potencia alta', strength: Math.min(hot, dry), output: 70 },
    ]
    const total = rules.reduce((sum,r) => sum + r.strength, 0)
    const power = total > 0 ? rules.reduce((sum,r) => sum + r.strength * r.output, 0) / total : 35
    return { cold, warm, hot, dry, comfortable, humid, rules, power }
  }, [temperature, humidity])

  const correct = answer === 'gradual'
  const score = Math.min(100, (interactions >= 2 ? 40 : interactions * 20) + (correct ? 60 : 0))
  const completed = interactions >= 2 && Boolean(answer)
  const touch = () => { setInteractions(v => v + 1); setSaved(false) }
  const save = () => { if (!completed) return; const payload: LabResult = { score, completed: score >= 70, interactions, detail: `Salida difusa ${values.power.toFixed(0)}% para ${temperature}°C y ${humidity}% de humedad.`, state: { temperature, humidity, power: values.power, memberships: { cold: values.cold, warm: values.warm, hot: values.hot, dry: values.dry, comfortable: values.comfortable, humid: values.humid } } }; onComplete(payload); setSaved(true) }

  const meter = (label: string, value: number) => <div className="fuzzy-membership" key={label}><div><span>{label}</span><strong>{value.toFixed(2)}</strong></div><div className="membership-track"><i style={{ width: `${value*100}%` }}/></div></div>

  return <div className="lab-experience fuzzy-lab">
    <div className="lab-scenario"><span>ESCENARIO</span><h3>{narrative.title}</h3><p>{narrative.context}</p><b>{narrative.mission}</b></div>
    <div className="lab-two-column">
      <section className="lab-controls-card"><div className="lab-card-heading"><div><span>1</span><strong>Mueve entradas nítidas</strong></div></div><label>Temperatura <b>{temperature}°C</b><input type="range" min="10" max="40" value={temperature} onChange={(e: any) => { setTemperature(Number(e.target.value)); touch() }} /></label><label>Humedad <b>{humidity}%</b><input type="range" min="10" max="95" value={humidity} onChange={(e: any) => { setHumidity(Number(e.target.value)); touch() }} /></label><div className="fuzzy-output"><small>SALIDA DEFUZZIFICADA</small><strong>{values.power.toFixed(0)}%</strong><span>potencia sugerida</span></div></section>
      <section className="fuzzy-membership-card"><div className="lab-card-heading"><div><span>2</span><strong>Observa grados de pertenencia</strong></div><small>Una misma entrada puede pertenecer parcialmente a varias etiquetas.</small></div><div className="fuzzy-group"><b>Temperatura</b>{[['Frío',values.cold],['Templado',values.warm],['Caliente',values.hot]].map(([l,v]) => meter(String(l), Number(v)))}</div><div className="fuzzy-group"><b>Humedad</b>{[['Seca',values.dry],['Cómoda',values.comfortable],['Húmeda',values.humid]].map(([l,v]) => meter(String(l), Number(v)))}</div></section>
    </div>
    <section className="fuzzy-rules-card"><div className="lab-card-heading"><div><span>3</span><strong>Qué reglas se están activando</strong></div></div><div className="fuzzy-rule-list">{values.rules.filter(r => r.strength > .03).sort((a,b)=>b.strength-a.strength).map(rule => <div key={rule.name}><span style={{ width: `${rule.strength*100}%` }}/><strong>{rule.name}</strong><em>{rule.strength.toFixed(2)}</em></div>)}</div></section>
    <section className="lab-challenge-card"><div className="lab-card-heading"><div><span>4</span><strong>¿Qué aporta la lógica difusa?</strong></div></div><p>¿Por qué la potencia cambia de forma progresiva al mover los sliders?</p><div className="lab-choice-grid"><button className={answer === 'binary' ? 'selected' : ''} onClick={() => { setAnswer('binary'); setSaved(false) }}>Porque convierte todo inmediatamente a 0 o 1.</button><button className={answer === 'gradual' ? 'selected' : ''} onClick={() => { setAnswer('gradual'); setSaved(false) }}>Porque combina grados de pertenencia y reglas con distintas intensidades.</button><button className={answer === 'random' ? 'selected' : ''} onClick={() => { setAnswer('random'); setSaved(false) }}>Porque introduce aleatoriedad.</button></div>{answer && <div className={correct ? 'lab-feedback good' : 'lab-feedback'}><strong>{correct ? 'Exacto.' : 'No es azar ni una decisión binaria.'}</strong><span>La salida gradual emerge de cuánto se activa cada conjunto y cada regla.</span></div>}</section>
    <div className="lab-completion-bar"><div><span>Resultado actual</span><strong>{score}%</strong><small>Mejor anterior: {previousBest}%</small></div><button className="primary-button" disabled={!completed || saved} onClick={save}>{saved ? <><Check size={15}/> Guardado</> : 'Guardar resultado'}</button><button className="secondary-button" onClick={() => { setTemperature(28); setHumidity(65); setAnswer(''); setInteractions(0); setSaved(false) }}><RotateCcw size={14}/> Reiniciar</button></div>
    <div className="lab-transfer"><strong>Transfiérelo:</strong><p>{narrative.transferPrompt}</p></div>
  </div>
}
