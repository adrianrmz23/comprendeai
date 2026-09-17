import { useMemo, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { LabComponentProps, LabResult } from './types'

const erf = (x:number) => {
  const sign = x < 0 ? -1 : 1; const ax = Math.abs(x); const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911
  const t=1/(1+p*ax); const y=1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-ax*ax); return sign*y
}
const cdf = (z:number) => 0.5 * (1 + erf(z / Math.SQRT2))

export default function DistributionLab({ narrative, previousBest=0, onComplete }: LabComponentProps) {
  const [mean,setMean]=useState(50), [sd,setSd]=useState(10), [x,setX]=useState(65), [answer,setAnswer]=useState(''), [interactions,setInteractions]=useState(0), [saved,setSaved]=useState(false)
  const values=useMemo(()=>{const z=(x-mean)/sd; return {z,prob:cdf(z)*100}},[mean,sd,x])
  const curve=useMemo(()=>Array.from({length:41},(_,i)=>{const z=-3.5+i*7/40; const y=Math.exp(-0.5*z*z); return {z,y}}),[])
  const path=curve.map((p,i)=>`${i?'L':'M'} ${((p.z+3.5)/7*100).toFixed(2)} ${(62-p.y*52).toFixed(2)}`).join(' ')
  const xPos=Math.max(0,Math.min(100,((values.z+3.5)/7)*100))
  const touch=(setter:(v:number)=>void,v:number)=>{setter(v);setInteractions(n=>n+1);setSaved(false)}
  const correct=answer==='closer'; const score=Math.min(100,(interactions>=2?40:interactions*20)+(correct?60:0)); const completed=interactions>=2&&Boolean(answer)
  const save=()=>{if(!completed)return; onComplete({score,completed:score>=70,interactions,detail:`z=${values.z.toFixed(2)} y P(X≤${x})=${values.prob.toFixed(1)}%.`,state:{mean,sd,x,z:values.z,probability:values.prob}});setSaved(true)}
  return <div className="lab-experience distribution-lab"><div className="lab-scenario"><span>ESCENARIO</span><h3>{narrative.title}</h3><p>{narrative.context}</p><b>{narrative.mission}</b></div>
    <div className="lab-two-column"><section className="lab-controls-card"><div className="lab-card-heading"><div><span>1</span><strong>Mueve la distribución</strong></div><small>Usamos una normal para visualizar posición y dispersión.</small></div>
      <label>Media μ <b>{mean}</b><input type="range" min="20" max="80" value={mean} onChange={(e: any)=>touch(setMean,Number(e.target.value))}/></label>
      <label>Desviación σ <b>{sd}</b><input type="range" min="3" max="25" value={sd} onChange={(e: any)=>touch(setSd,Number(e.target.value))}/></label>
      <label>Valor x <b>{x}</b><input type="range" min="10" max="100" value={x} onChange={(e: any)=>touch(setX,Number(e.target.value))}/></label>
    </section><section className="lab-result-card"><span className="lab-result-label">DISTRIBUCIÓN NORMAL</span><svg className="distribution-svg" viewBox="0 0 100 68" role="img" aria-label="Curva normal"><path d={path}/><line x1={xPos} x2={xPos} y1="8" y2="63"/><circle cx={xPos} cy="61" r="2"/></svg><div className="distribution-stats"><div><small>Puntaje z</small><strong>{values.z.toFixed(2)}</strong></div><div><small>P(X ≤ x)</small><strong>{values.prob.toFixed(1)}%</strong></div></div></section></div>
    <section className="lab-challenge-card"><div className="lab-card-heading"><div><span>2</span><strong>Predice la dispersión</strong></div></div><p>Si x permanece por encima de la media y aumentas mucho σ, ¿qué ocurre con |z|?</p><div className="lab-choice-row"><button className={answer==='farther'?'selected':''} onClick={()=>setAnswer('farther')}>Aumenta</button><button className={answer==='closer'?'selected':''} onClick={()=>setAnswer('closer')}>Disminuye</button><button className={answer==='same'?'selected':''} onClick={()=>setAnswer('same')}>No cambia</button></div>{answer&&<div className={correct?'lab-feedback good':'lab-feedback'}><strong>{correct?'Sí.':'Revisa z=(x−μ)/σ.'}</strong><span>Con más dispersión, la misma distancia absoluta representa menos desviaciones estándar.</span></div>}</section>
    <div className="lab-completion-bar"><div><span>Resultado actual</span><strong>{score}%</strong><small>Mejor anterior: {previousBest}%</small></div><button className="primary-button" disabled={!completed||saved} onClick={save}>{saved?<><Check size={15}/> Guardado</>:'Guardar resultado'}</button><button className="secondary-button" onClick={()=>{setMean(50);setSd(10);setX(65);setAnswer('');setInteractions(0);setSaved(false)}}><RotateCcw size={14}/> Reiniciar</button></div><div className="lab-transfer"><strong>Transfiérelo:</strong><p>{narrative.transferPrompt}</p></div>
  </div>
}
