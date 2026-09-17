import { useEffect, useState } from 'react'
import { Beaker, RefreshCw, Sparkles } from 'lucide-react'
import type { StudyMaterial } from '../materials'
import type { MemoryEvent } from '../memory'
import BayesLab from './BayesLab'
import BayesianNetworkLab from './BayesianNetworkLab'
import HMMLab from './HMMLab'
import FuzzyLogicLab from './FuzzyLogicLab'
import ConditionalProbabilityLab from './ConditionalProbabilityLab'
import DistributionLab from './DistributionLab'
import MonteCarloLab from './MonteCarloLab'
import NaiveBayesLab from './NaiveBayesLab'
import DempsterShaferLab from './DempsterShaferLab'
import RegressionLab from './RegressionLab'
import ClassificationLab from './ClassificationLab'
import GenericLab from './GenericLab'
import { getLabDefinition, inferLabRecommendation, localLabNarrative } from './registry'
import { getLabNarrative } from './scenarios'
import { getGenericLabPlan } from './genericPlan'
import { loadLabProgress, saveLabResult } from './storage'
import type { GenericLabPlan, LabNarrative, LabProgress, LabResult } from './types'

type Props = {
  userId: string
  material: StudyMaterial
  concept: string
  onMemoryEvent: (event: MemoryEvent) => void
}

export default function ConceptLab({ userId, material, concept, onMemoryEvent }: Props) {
  const conceptMeta = material.semantic?.concepts.find(item => item.label === concept)
  const recommendation = conceptMeta?.lab || inferLabRecommendation(concept, conceptMeta?.description || '')
  const definition = getLabDefinition(concept, recommendation)
  const modeLabel: Record<string, string> = { simulation:'Simulación', visualization:'Visualización', builder:'Constructor', experiment:'Experimento', step_by_step:'Paso a paso', case:'Caso interactivo' }
  const [narrative, setNarrative] = useState<LabNarrative | null>(() => definition && definition.type !== 'generic' ? localLabNarrative(definition.type, concept) : null)
  const [genericPlan, setGenericPlan] = useState<GenericLabPlan | null>(null)
  const [progress, setProgress] = useState<LabProgress | null>(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)
  const [saveNote, setSaveNote] = useState('')

  useEffect(() => {
    if (!definition) return
    let cancelled = false
    setSaveNote('')
    setGenericPlan(null)
    loadLabProgress(userId, material.id, concept, definition.type).then(value => { if (!cancelled) setProgress(value) })
    setScenarioLoading(true)
    if (definition.type === 'generic') {
      getGenericLabPlan(material, concept, recommendation).then(value => { if (!cancelled) { setGenericPlan(value); setScenarioLoading(false) } })
    } else {
      setNarrative(localLabNarrative(definition.type, concept))
      getLabNarrative(material, concept, definition.type).then(value => { if (!cancelled) { setNarrative(value); setScenarioLoading(false) } })
    }
    return () => { cancelled = true }
  }, [userId, material.id, concept, definition?.type, recommendation?.genericTemplate])

  if (!definition) return null
  if (definition.type !== 'generic' && !narrative) return null
  if (definition.type === 'generic' && !genericPlan) return <div className="concept-lab-shell"><div className="auto-lab-explainer"><RefreshCw size={15}/><span>Comprende está componiendo un laboratorio seguro para <b>{concept}</b> a partir de tu material…</span></div></div>

  const refreshScenario = async () => {
    setScenarioLoading(true)
    if (definition.type === 'generic') {
      const value = await getGenericLabPlan(material, concept, recommendation, true)
      setGenericPlan(value)
    } else {
      const value = await getLabNarrative(material, concept, definition.type, true)
      setNarrative(value)
    }
    setScenarioLoading(false)
  }

  const complete = async (result: LabResult) => {
    const scenarioId = definition.type === 'generic' ? (genericPlan?.id || 'generic') : (narrative?.id || 'specialized')
    setSaveNote('Guardando intento…')
    const next = await saveLabResult({ userId, materialId: material.id, materialName: material.name, concept, labType: definition.type, scenarioId, result })
    setProgress(next)
    onMemoryEvent({ materialId: material.id, materialName: material.name, concept, type:'lab', score:result.score, detail:`${definition.shortTitle}: ${result.detail}` })
    setSaveNote(`Laboratorio guardado · mejor puntuación ${next.bestScore}%`)
  }

  const common = narrative ? { narrative, previousBest: progress?.bestScore || 0, onComplete: complete } : null
  const provider = definition.type === 'generic' ? genericPlan?.provider : narrative?.provider
  const model = definition.type === 'generic' ? genericPlan?.model : narrative?.model
  const cached = definition.type === 'generic' ? genericPlan?.cached : narrative?.cached

  return <div className="concept-lab-shell">
    <header className="concept-lab-header">
      <div className="concept-lab-icon"><Beaker size={22} /></div>
      <div><span className="tiny-label">COMPRENDE 2.0 · UNIVERSAL LEARNING ENGINE</span><h2>{definition.title}</h2><p>{definition.description}</p></div>
      <div className="concept-lab-meta"><span>≈ {definition.estimatedMinutes} min</span>{progress && <span>Mejor: {progress.bestScore}% · {progress.attempts} intento{progress.attempts === 1 ? '' : 's'}</span>}<button className="secondary-button" disabled={scenarioLoading} onClick={refreshScenario}><Sparkles size={14}/>{scenarioLoading ? 'Componiendo…' : definition.type === 'generic' ? 'Regenerar composición' : 'Otro escenario'}</button></div>
    </header>
    <div className="lab-goals">{definition.goals.map(goal => <span key={goal}>{goal}</span>)}</div>
    {recommendation?.recommended && <div className="auto-lab-explainer"><Beaker size={15}/><span><b>{recommendation.engine === 'composed' || definition.type === 'generic' ? 'Auto-Lab componible' : 'Lab especializado'}:</b> {recommendation.reason} <span className="lab-mode-pill">{modeLabel[recommendation.practiceMode] || recommendation.practiceMode}</span>{recommendation.genericTemplate && recommendation.genericTemplate !== 'none' && <span className="lab-mode-pill">{recommendation.genericTemplate.replace(/-/g, ' ')}</span>}<span className="auto-lab-confidence">confianza {recommendation.confidence}%</span></span></div>}
    {provider && <div className="lab-provider-note"><Sparkles size={14}/><span>{cached ? 'Diseño reutilizado desde caché' : 'Diseño generado'} con <b>{provider}</b>{model ? ` · ${model}` : ''}. {definition.type === 'generic' ? 'El modelo compuso configuración declarativa; no escribió ni ejecutó JavaScript.' : 'Los cálculos del laboratorio siguen siendo deterministas en TypeScript.'}</span></div>}

    {definition.type === 'generic' && genericPlan && <GenericLab plan={genericPlan} previousBest={progress?.bestScore || 0} onComplete={complete} />}
    {definition.type === 'bayes' && common && <BayesLab {...common} />}
    {definition.type === 'bayesian-network' && common && <BayesianNetworkLab {...common} />}
    {definition.type === 'hmm' && common && <HMMLab {...common} />}
    {definition.type === 'fuzzy' && common && <FuzzyLogicLab {...common} />}
    {definition.type === 'conditional-probability' && common && <ConditionalProbabilityLab {...common} />}
    {definition.type === 'distribution' && common && <DistributionLab {...common} />}
    {definition.type === 'monte-carlo' && common && <MonteCarloLab {...common} />}
    {definition.type === 'naive-bayes' && common && <NaiveBayesLab {...common} />}
    {definition.type === 'dempster-shafer' && common && <DempsterShaferLab {...common} />}
    {definition.type === 'regression' && common && <RegressionLab {...common} />}
    {definition.type === 'classification' && common && <ClassificationLab {...common} />}
    {saveNote && <div className="lab-save-note"><RefreshCw size={14}/>{saveNote}</div>}
  </div>
}
