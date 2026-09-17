import { useMemo, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { LabComponentProps, LabResult } from './types'

export default function ConditionalProbabilityLab({ narrative, previousBest = 0, onComplete }: LabComponentProps) {
  const [pA, setPA] = useState(30)
  const [pBGivenA, setPBGivenA] = useState(70)
  const [pBGivenNotA, setPBGivenNotA] = useState(20)
  const [answer, setAnswer] = useState('')
  const [interactions, setInteractions] = useState(0)
  const [saved, setSaved] = useState(false)
  const result = useMemo(() => {
    const population = 1000
    const a = population * pA / 100
    const notA = population - a
    const aAndB = a * pBGivenA / 100
    const notAAndB = notA * pBGivenNotA / 100
    const b = aAndB + notAAndB
    const aGivenB = b ? aAndB / b * 100 : 0
    return { population, a, notA, aAndB, notAAndB, b, aGivenB }
  }, [pA, pBGivenA, pBGivenNotA])
  const touch = (setter: (v:number)=>void, value:number) => { setter(value); setInteractions(v => v + 1); setSaved(false) }
  const correct = answer === 'different'
  const score = Math.min(100, (interactions >= 2 ? 40 : interactions * 20) + (correct ? 60 : 0))
  const completed = interactions >= 2 && Boolean(answer)
  const save = () => {
    if (!completed) return
    const payload: LabResult = { score, completed: score >= 70, interactions, detail: `P(A|B) ${result.aGivenB.toFixed(1)}% frente a P(B|A) ${pBGivenA.toFixed(1)}%.`, state: { pA, pBGivenA, pBGivenNotA, aGivenB: result.aGivenB } }
    onComplete(payload); setSaved(true)
  }
  return <div className="lab-experience conditional-lab">
    <div className="lab-scenario"><span>ESCENARIO</span><h3>{narrative.title}</h3><p>{narrative.context}</p><b>{narrative.mission}</b></div>
    <div className="lab-two-column">
      <section className="lab-controls-card">
        <div className="lab-card-heading"><div><span>1</span><strong>Construye la población</strong></div><small>Piensa en 1,000 casos para evitar invertir la condicional.</small></div>
        <label>P(A) <b>{pA}%</b><input type="range" min="5" max="80" value={pA} onChange={(e: any) => touch(setPA, Number(e.target.value))}/></label>
        <label>P(B | A) <b>{pBGivenA}%</b><input type="range" min="5" max="95" value={pBGivenA} onChange={(e: any) => touch(setPBGivenA, Number(e.target.value))}/></label>
        <label>P(B | no A) <b>{pBGivenNotA}%</b><input type="range" min="1" max="80" value={pBGivenNotA} onChange={(e: any) => touch(setPBGivenNotA, Number(e.target.value))}/></label>
      </section>
      <section className="lab-result-card">
        <span className="lab-result-label">TABLA DE FRECUENCIAS · 1,000 CASOS</span>
        <div className="conditional-grid">
          <div><small>A y B</small><strong>{Math.round(result.aAndB)}</strong></div><div><small>no A y B</small><strong>{Math.round(result.notAAndB)}</strong></div>
          <div><small>Total B</small><strong>{Math.round(result.b)}</strong></div><div className="accent"><small>P(A | B)</small><strong>{result.aGivenB.toFixed(1)}%</strong></div>
        </div>
        <div className="conditional-compare"><span>P(B | A)</span><strong>{pBGivenA.toFixed(1)}%</strong><i>≠</i><span>P(A | B)</span><strong>{result.aGivenB.toFixed(1)}%</strong></div>
      </section>
    </div>
    <section className="lab-challenge-card"><div className="lab-card-heading"><div><span>2</span><strong>Comprueba la dirección</strong></div></div><p>¿P(A|B) y P(B|A) representan necesariamente la misma probabilidad?</p>
      <div className="lab-choice-row"><button className={answer==='same'?'selected':''} onClick={()=>setAnswer('same')}>Sí, son equivalentes</button><button className={answer==='different'?'selected':''} onClick={()=>setAnswer('different')}>No, condicionan universos distintos</button></div>
      {answer && <div className={correct?'lab-feedback good':'lab-feedback'}><strong>{correct?'Exacto.':'Cuidado con invertir la condición.'}</strong><span>La barra vertical cambia qué conjunto tomas como referencia.</span></div>}
    </section>
    <div className="lab-completion-bar"><div><span>Resultado actual</span><strong>{score}%</strong><small>Mejor anterior: {previousBest}%</small></div><button className="primary-button" disabled={!completed || saved} onClick={save}>{saved?<><Check size={15}/> Guardado</>:'Guardar resultado'}</button><button className="secondary-button" onClick={()=>{setPA(30);setPBGivenA(70);setPBGivenNotA(20);setAnswer('');setInteractions(0);setSaved(false)}}><RotateCcw size={14}/> Reiniciar</button></div>
    <div className="lab-transfer"><strong>Transfiérelo:</strong><p>{narrative.transferPrompt}</p></div>
  </div>
}
