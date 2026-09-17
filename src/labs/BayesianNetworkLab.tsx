import { useMemo, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { LabComponentProps, LabResult } from './types'

const clamp01 = (value: number) => Math.max(0.001, Math.min(0.999, value))

export default function BayesianNetworkLab({ narrative, previousBest = 0, onComplete }: LabComponentProps) {
  const [prior, setPrior] = useState(12)
  const [feverGivenDisease, setFeverGivenDisease] = useState(80)
  const [feverGivenHealthy, setFeverGivenHealthy] = useState(15)
  const [testGivenDisease, setTestGivenDisease] = useState(92)
  const [testGivenHealthy, setTestGivenHealthy] = useState(8)
  const [feverEvidence, setFeverEvidence] = useState(false)
  const [testEvidence, setTestEvidence] = useState(false)
  const [question, setQuestion] = useState('')
  const [interactions, setInteractions] = useState(0)
  const [saved, setSaved] = useState(false)

  const posterior = useMemo(() => {
    const pD = clamp01(prior / 100)
    let d = pD
    let notD = 1 - pD
    if (feverEvidence) { d *= clamp01(feverGivenDisease / 100); notD *= clamp01(feverGivenHealthy / 100) }
    if (testEvidence) { d *= clamp01(testGivenDisease / 100); notD *= clamp01(testGivenHealthy / 100) }
    const total = d + notD
    return total > 0 ? d / total * 100 : prior
  }, [prior, feverGivenDisease, feverGivenHealthy, testGivenDisease, testGivenHealthy, feverEvidence, testEvidence])

  const feverLR = (feverGivenDisease / 100) / clamp01(feverGivenHealthy / 100)
  const testLR = (testGivenDisease / 100) / clamp01(testGivenHealthy / 100)
  const strongest = testLR >= feverLR ? 'test' : 'fever'
  const questionCorrect = question === strongest
  const evidenceUsed = feverEvidence || testEvidence
  const score = Math.min(100, (interactions > 1 ? 30 : 0) + (evidenceUsed ? 30 : 0) + (questionCorrect ? 40 : 0))
  const completed = interactions > 1 && evidenceUsed && Boolean(question)

  const touch = () => { setInteractions(v => v + 1); setSaved(false) }
  const save = () => {
    if (!completed) return
    const payload: LabResult = { score, completed: score >= 70, interactions, detail: `Inferencia posterior ${posterior.toFixed(1)}% con evidencia ${[feverEvidence && 'fiebre', testEvidence && 'prueba+'].filter(Boolean).join(' + ') || 'ninguna'}.`, state: { prior, feverGivenDisease, feverGivenHealthy, testGivenDisease, testGivenHealthy, feverEvidence, testEvidence, posterior } }
    onComplete(payload); setSaved(true)
  }

  return <div className="lab-experience bayesian-network-lab">
    <div className="lab-scenario"><span>ESCENARIO</span><h3>{narrative.title}</h3><p>{narrative.context}</p><b>{narrative.mission}</b></div>

    <section className="bn-network-card">
      <div className="lab-card-heading"><div><span>1</span><strong>Lee la estructura antes de calcular</strong></div><small>Diseño fijo y estable: sin canvas ni arrastre libre.</small></div>
      <div className="bn-network" aria-label="Red bayesiana fija">
        <div className="bn-node parent"><span>HIPÓTESIS</span><strong>Enfermedad</strong><small>P = {prior}%</small></div>
        <div className="bn-arrow-row"><span>↙</span><span>↘</span></div>
        <div className="bn-children"><button className={feverEvidence ? 'bn-node evidence active' : 'bn-node evidence'} onClick={() => { setFeverEvidence(v => !v); touch() }}><span>EVIDENCIA</span><strong>Fiebre</strong><small>{feverEvidence ? 'Observada ✓' : 'Toca para observar'}</small></button><button className={testEvidence ? 'bn-node evidence active' : 'bn-node evidence'} onClick={() => { setTestEvidence(v => !v); touch() }}><span>EVIDENCIA</span><strong>Prueba +</strong><small>{testEvidence ? 'Observada ✓' : 'Toca para observar'}</small></button></div>
      </div>
      <div className="bn-posterior"><small>Probabilidad posterior de enfermedad</small><strong>{posterior.toFixed(1)}%</strong><span>{evidenceUsed ? 'La red está incorporando la evidencia seleccionada.' : 'Sin evidencia, coincide con el prior.'}</span></div>
    </section>

    <section className="lab-controls-card bn-cpt-card">
      <div className="lab-card-heading"><div><span>2</span><strong>Edita una CPT sencilla</strong></div><small>Observa qué relaciones hacen que una señal sea más o menos informativa.</small></div>
      <div className="bn-slider-grid">
        <label>Prior enfermedad <b>{prior}%</b><input type="range" min="1" max="60" value={prior} onChange={(e: any) => { setPrior(Number(e.target.value)); touch() }} /></label>
        <label>P(Fiebre | Enfermedad) <b>{feverGivenDisease}%</b><input type="range" min="20" max="100" value={feverGivenDisease} onChange={(e: any) => { setFeverGivenDisease(Number(e.target.value)); touch() }} /></label>
        <label>P(Fiebre | No enfermedad) <b>{feverGivenHealthy}%</b><input type="range" min="1" max="70" value={feverGivenHealthy} onChange={(e: any) => { setFeverGivenHealthy(Number(e.target.value)); touch() }} /></label>
        <label>P(Prueba+ | Enfermedad) <b>{testGivenDisease}%</b><input type="range" min="20" max="100" value={testGivenDisease} onChange={(e: any) => { setTestGivenDisease(Number(e.target.value)); touch() }} /></label>
        <label>P(Prueba+ | No enfermedad) <b>{testGivenHealthy}%</b><input type="range" min="1" max="70" value={testGivenHealthy} onChange={(e: any) => { setTestGivenHealthy(Number(e.target.value)); touch() }} /></label>
      </div>
    </section>

    <section className="lab-challenge-card">
      <div className="lab-card-heading"><div><span>3</span><strong>¿Qué evidencia pesa más con estos valores?</strong></div></div>
      <p>Compara cuánto distingue cada observación entre “enfermedad” y “no enfermedad”.</p>
      <div className="lab-choice-row"><button className={question === 'fever' ? 'selected' : ''} onClick={() => { setQuestion('fever'); setSaved(false) }}>Fiebre</button><button className={question === 'test' ? 'selected' : ''} onClick={() => { setQuestion('test'); setSaved(false) }}>Prueba positiva</button></div>
      {question && <div className={questionCorrect ? 'lab-feedback good' : 'lab-feedback'}><strong>{questionCorrect ? 'Correcto.' : 'Mira la razón de verosimilitud.'}</strong><span>Fiebre ≈ {feverLR.toFixed(1)}×; prueba ≈ {testLR.toFixed(1)}×. La evidencia más discriminativa produce una actualización mayor.</span></div>}
    </section>

    <div className="lab-completion-bar"><div><span>Resultado actual</span><strong>{score}%</strong><small>Mejor anterior: {previousBest}%</small></div><button className="primary-button" disabled={!completed || saved} onClick={save}>{saved ? <><Check size={15}/> Guardado</> : 'Guardar resultado'}</button><button className="secondary-button" onClick={() => { setPrior(12); setFeverGivenDisease(80); setFeverGivenHealthy(15); setTestGivenDisease(92); setTestGivenHealthy(8); setFeverEvidence(false); setTestEvidence(false); setQuestion(''); setInteractions(0); setSaved(false) }}><RotateCcw size={14}/> Reiniciar</button></div>
    <div className="lab-transfer"><strong>Transfiérelo:</strong><p>{narrative.transferPrompt}</p></div>
  </div>
}
