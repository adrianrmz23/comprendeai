import { useMemo, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { LabComponentProps, LabResult } from './types'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export default function BayesLab({ narrative, previousBest = 0, onComplete }: LabComponentProps) {
  const [prevalence, setPrevalence] = useState(1)
  const [sensitivity, setSensitivity] = useState(95)
  const [falsePositive, setFalsePositive] = useState(5)
  const [prediction, setPrediction] = useState<string>('')
  const [interpretation, setInterpretation] = useState<string>('')
  const [interactions, setInteractions] = useState(0)
  const [saved, setSaved] = useState(false)
  const population = 1000

  const result = useMemo(() => {
    const sick = population * prevalence / 100
    const healthy = population - sick
    const truePositive = sick * sensitivity / 100
    const falsePositiveCount = healthy * falsePositive / 100
    const allPositive = truePositive + falsePositiveCount
    const posterior = allPositive > 0 ? truePositive / allPositive * 100 : 0
    return { sick, healthy, truePositive, falsePositiveCount, allPositive, posterior }
  }, [prevalence, sensitivity, falsePositive])

  const predictionCorrect = prediction === 'sube'
  const interpretationCorrect = interpretation === 'posterior'
  const score = clamp((interactions > 0 ? 20 : 0) + (predictionCorrect ? 40 : 0) + (interpretationCorrect ? 40 : 0), 0, 100)
  const completed = interactions > 0 && Boolean(prediction) && Boolean(interpretation)

  const update = (setter: (n: number) => void, value: number) => {
    setter(value)
    setInteractions(current => current + 1)
    setSaved(false)
  }

  const saveResult = () => {
    if (!completed) return
    const payload: LabResult = {
      score,
      completed: score >= 70,
      interactions,
      detail: `Posterior ${result.posterior.toFixed(1)}% con prevalencia ${prevalence}%, sensibilidad ${sensitivity}% y falsos positivos ${falsePositive}%.`,
      state: { prevalence, sensitivity, falsePositive, posterior: result.posterior, prediction, interpretation },
    }
    onComplete(payload)
    setSaved(true)
  }

  return <div className="lab-experience bayes-lab">
    <div className="lab-scenario"><span>ESCENARIO</span><h3>{narrative.title}</h3><p>{narrative.context}</p><b>{narrative.mission}</b></div>

    <div className="lab-two-column">
      <section className="lab-controls-card">
        <div className="lab-card-heading"><div><span>1</span><strong>Mueve las variables</strong></div><small>Los cálculos los hace TypeScript, no la IA.</small></div>
        <label>Prevalencia <b>{prevalence.toFixed(1)}%</b><input type="range" min="0.1" max="40" step="0.1" value={prevalence} onChange={(e: any) => update(setPrevalence, Number(e.target.value))} /></label>
        <label>Sensibilidad <b>{sensitivity}%</b><input type="range" min="50" max="100" step="1" value={sensitivity} onChange={(e: any) => update(setSensitivity, Number(e.target.value))} /></label>
        <label>Falsos positivos <b>{falsePositive}%</b><input type="range" min="0.1" max="30" step="0.1" value={falsePositive} onChange={(e: any) => update(setFalsePositive, Number(e.target.value))} /></label>
      </section>

      <section className="lab-result-card">
        <span className="lab-result-label">POBLACIÓN SIMULADA · 1,000 PERSONAS</span>
        <div className="bayes-population-bar" aria-label="Distribución de resultados positivos">
          <div className="true-positive" style={{ width: `${result.allPositive ? result.truePositive / result.allPositive * 100 : 0}%` }} />
          <div className="false-positive" style={{ width: `${result.allPositive ? result.falsePositiveCount / result.allPositive * 100 : 0}%` }} />
        </div>
        <div className="bayes-counts"><div><strong>{Math.round(result.truePositive)}</strong><span>positivos verdaderos</span></div><div><strong>{Math.round(result.falsePositiveCount)}</strong><span>falsos positivos</span></div></div>
        <div className="posterior-number"><small>P(enfermedad | positivo)</small><strong>{result.posterior.toFixed(1)}%</strong><p>{Math.round(result.truePositive)} ÷ {Math.round(result.allPositive)} positivos</p></div>
      </section>
    </div>

    <section className="lab-challenge-card">
      <div className="lab-card-heading"><div><span>2</span><strong>Predice antes de tocar otra vez</strong></div></div>
      <p>Si mantienes igual la calidad de la prueba pero aumentas mucho la prevalencia, ¿qué suele pasar con la probabilidad posterior después de un positivo?</p>
      <div className="lab-choice-row">{[['sube','Sube'],['baja','Baja'],['igual','Queda igual']].map(([id,label]) => <button key={id} className={prediction === id ? 'selected' : ''} onClick={() => { setPrediction(id); setSaved(false) }}>{label}</button>)}</div>
      {prediction && <div className={predictionCorrect ? 'lab-feedback good' : 'lab-feedback'}><strong>{predictionCorrect ? 'Sí.' : 'No exactamente.'}</strong><span>Cuando el evento deja de ser tan raro, una evidencia positiva suele ser más convincente porque hay más verdaderos positivos en la población.</span></div>}
    </section>

    <section className="lab-challenge-card">
      <div className="lab-card-heading"><div><span>3</span><strong>Interpreta el número</strong></div></div>
      <p>Ese {result.posterior.toFixed(1)}% representa…</p>
      <div className="lab-choice-grid">
        <button className={interpretation === 'sensitivity' ? 'selected' : ''} onClick={() => { setInterpretation('sensitivity'); setSaved(false) }}>La sensibilidad de la prueba.</button>
        <button className={interpretation === 'posterior' ? 'selected' : ''} onClick={() => { setInterpretation('posterior'); setSaved(false) }}>La probabilidad de estar enfermo dado que salió positivo.</button>
        <button className={interpretation === 'prevalence' ? 'selected' : ''} onClick={() => { setInterpretation('prevalence'); setSaved(false) }}>La prevalencia inicial.</button>
      </div>
      {interpretation && <div className={interpretationCorrect ? 'lab-feedback good' : 'lab-feedback'}><strong>{interpretationCorrect ? 'Exacto.' : 'Revisa la dirección de la condicional.'}</strong><span>El laboratorio está actualizando una creencia después de observar evidencia.</span></div>}
    </section>

    <div className="lab-completion-bar"><div><span>Resultado actual</span><strong>{score}%</strong><small>Mejor anterior: {previousBest}%</small></div><button className="primary-button" disabled={!completed || saved} onClick={saveResult}>{saved ? <><Check size={15}/> Guardado</> : 'Guardar resultado'}</button><button className="secondary-button" onClick={() => { setPrevalence(1); setSensitivity(95); setFalsePositive(5); setPrediction(''); setInterpretation(''); setInteractions(0); setSaved(false) }}><RotateCcw size={14}/> Reiniciar</button></div>
    <div className="lab-transfer"><strong>Transfiérelo:</strong><p>{narrative.transferPrompt}</p></div>
  </div>
}
