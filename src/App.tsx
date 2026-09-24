import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, ChangeEvent, MouseEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  FileText,
  UploadCloud,
  FolderOpen,
  Search,
  Trash2,
  Plus,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  Gauge,
  Headphones,
  Home,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Target,
  Trophy,
  Volume2,
  X,
  Network,
  Layers3,
  Route,
  RefreshCw,
  Cloud,
  LogOut,
  FlaskConical,
} from 'lucide-react'

type View = 'home' | 'session' | 'practice' | 'progress' | 'materials' | 'material-map' | 'material-study'
type StepId = 'problem' | 'intuition' | 'visual' | 'formal' | 'lab' | 'guided' | 'solo' | 'explain'
type Blocker = 'terms' | 'formula' | 'use' | 'prereq'
type LearningMode = 'explain-first' | 'challenge-first'

import { findRelevantExcerpts, readStudyFile, type StudyMaterial, type SemanticConcept } from './materials'
import { enhanceSessionWithAI, evaluateRecall, explainConceptWithAI, type ExplanationVariant } from './ai'
import { buildLocalStudySession, type RecallEvaluation, type StudySession } from './sessionGenerator'
import { analyzeMaterialSemantically, buildLocalSemanticAnalysis, conceptsFromSemantic, normalizeSemanticAnalysis, sortConceptsByDocumentOrder } from './semantic'
import { applyMemoryEvent, clearLearningMemoryCache, dueReviews, formatReviewDate, fragileConcepts, getMemoryRecords, loadLearningMemory, memoryLabel, memoryStatus, saveLearningMemory, solidConcepts, type LearningMemory, type MemoryEvent } from './memory'
import DashboardView from './dashboardView'
import { subjectFor } from './dashboard'
import { useMicroAudio } from './microaudio'
import { useAuth } from './auth'
import { clearLocalMaterialCache, deleteCloudMaterial, hasCompletedCloudMigration, loadCloudState, loadLocalMaterialCache, migrateLocalStateToCloud, saveAllConceptProgress, saveCloudMaterial, saveCloudMaterials, saveCloudShellState, saveConceptProgress, saveLocalMaterialCache, uploadMaterialOriginal, type SyncStatus } from './cloudSync'
import { clearAiClientCache, getCachedExplanation, getCachedExplanationEntry, getCachedSession, getCachedSessionEntry, type AiAttribution } from './aiClientCache'
import ConceptLab from './labs/ConceptLab'
import { availableLabs, getLabDefinition } from './labs/registry'

const steps: { id: StepId; label: string; short: string }[] = [
  { id: 'problem', label: 'El problema', short: 'Problema' },
  { id: 'intuition', label: 'Entiéndelo fácil', short: 'Entender' },
  { id: 'visual', label: 'Míralo', short: 'Visual' },
  { id: 'formal', label: 'Ahora sí, formal', short: 'Formal' },
  { id: 'guided', label: 'Hazlo conmigo', short: 'Conmigo' },
  { id: 'solo', label: 'Ahora tú', short: 'Tú solo' },
  { id: 'explain', label: 'Explícamelo tú', short: 'Explícalo' },
]

const audioScripts = {
  review: `Repaso rápido del teorema de Bayes. Bayes sirve para actualizar una creencia cuando aparece evidencia nueva. La idea más importante es que un resultado positivo no se interpreta aislado: también importa qué tan frecuente era el evento antes de observar la evidencia. Imagina una enfermedad poco común. Aunque la prueba sea muy buena, puede haber muchos falsos positivos si la mayoría de las personas estaban sanas. Por eso distinguimos cuatro ideas: la probabilidad previa, que es lo que creíamos antes; la verosimilitud, que nos dice qué tan compatible es la evidencia con cada caso; la evidencia total; y la probabilidad posterior, que es nuestra creencia actualizada. Si solo recuerdas una frase, recuerda esta: Bayes combina lo que ya sabías con lo nuevo que acabas de observar. Un error muy común es confundir la probabilidad de obtener un positivo si alguien está enfermo, con la probabilidad de estar enfermo si obtuviste un positivo. No son la misma cosa. Para resolver un problema, primero identifica qué evento quieres actualizar, luego anota la probabilidad inicial y finalmente incorpora la evidencia.`,
  understand: `Vamos a entender Bayes sin empezar por la fórmula. Imagina que hay diez mil personas. Solo cien tienen cierta enfermedad; eso significa que la enfermedad es poco frecuente. Supongamos que una prueba detecta correctamente a casi todos los enfermos: noventa y nueve de esos cien darán positivo. Hasta aquí suena como si un positivo significara casi con seguridad estar enfermo. Pero falta mirar al grupo enorme de personas sanas. Hay nueve mil novecientas personas sanas. Si la prueba produce falsos positivos en cinco de cada cien personas sanas, unas cuatrocientas noventa y cinco personas sanas también darán positivo. Entonces, entre todos los resultados positivos, tenemos aproximadamente noventa y nueve enfermos y cuatrocientas noventa y cinco personas sanas. Ahora la pregunta cambia: de todas las personas que dieron positivo, ¿qué fracción realmente está enferma? Noventa y nueve entre quinientos noventa y cuatro, aproximadamente diecisiete por ciento. Ese salto entre noventa y nueve por ciento de sensibilidad y diecisiete por ciento de probabilidad posterior es exactamente el tipo de situación para la que Bayes resulta útil. La intuición es esta: la evidencia nueva pesa, pero no borra lo que ya sabíamos. Si algo era muy raro antes de observar la evidencia, se necesita evidencia realmente fuerte para volverlo muy probable. Bayes formaliza esa actualización. La probabilidad previa se llama prior. La probabilidad después de observar la evidencia se llama posterior. La sensibilidad de la prueba representa una parte de la verosimilitud. Y la tasa de falsos positivos nos recuerda que la evidencia también puede aparecer cuando la hipótesis es falsa. Antes de memorizar una fórmula, conviene construir una tabla de población. Esa representación casi siempre hace visible de dónde sale el resultado y evita confundir P positivo dado enfermo con P enfermo dado positivo.`,
  exam: `Repaso previo a examen sobre Bayes. Primero, definición operativa: el teorema de Bayes permite calcular la probabilidad de una hipótesis después de observar evidencia. Segundo, lenguaje que debes reconocer. Prior es la probabilidad inicial de la hipótesis. Likelihood o verosimilitud es la probabilidad de observar la evidencia si la hipótesis fuera verdadera. Posterior es la probabilidad actualizada. Evidencia total es la probabilidad de observar el dato considerando tanto que la hipótesis sea verdadera como falsa. Tercero, error clásico: invertir condicionales. P de B dado A no es igual a P de A dado B. Una prueba con sensibilidad del noventa y nueve por ciento no implica que una persona con prueba positiva tenga noventa y nueve por ciento de probabilidad de estar enferma. La prevalencia modifica mucho la respuesta. Cuarto, procedimiento de examen. Escribe qué evento quieres encontrar. Convierte porcentajes a probabilidades. Si te confundes, imagina una población de mil o diez mil personas. Separa verdaderos positivos y falsos positivos. Divide los verdaderos positivos entre todos los positivos. Quinto, lectura conceptual. Cuando aumenta la prevalencia, un positivo suele ser más convincente. Cuando aumenta la tasa de falsos positivos, un positivo pierde fuerza. Cuando la sensibilidad aumenta, la prueba detecta mejor los casos verdaderos. Sexto, relación con inteligencia artificial. En clasificación probabilística usamos evidencia para actualizar creencias sobre clases. Naive Bayes simplifica el cálculo asumiendo independencia condicional entre características dadas las clases. Séptimo, pregunta rápida que deberías poder responder: si una enfermedad es extremadamente rara y una prueba tiene algunos falsos positivos, ¿por qué un resultado positivo puede seguir sin implicar una probabilidad alta de enfermedad? Porque el grupo de personas sanas es mucho mayor y puede producir más falsos positivos que verdaderos positivos. Si puedes explicar eso con tus palabras, ya captaste la idea central.`,
}

const blockers: Record<Blocker, { title: string; body: string; action: string }> = {
  terms: {
    title: 'Los términos te están estorbando',
    body: 'No intentes memorizar “prior”, “likelihood” y “posterior” todavía. Piensa así: antes → evidencia → después. Primero entiende ese recorrido y después le ponemos nombre formal a cada parte.',
    action: 'Volver a la intuición',
  },
  formula: {
    title: 'La fórmula llegó demasiado pronto',
    body: 'Conviene regresar a una población concreta. Si puedes contar cuántos positivos vienen de enfermos y cuántos de sanos, la fórmula deja de sentirse arbitraria.',
    action: 'Abrir visualización',
  },
  use: {
    title: 'Te falta reconocer cuándo usarlo',
    body: 'Busca esta señal: tienes una creencia inicial y aparece evidencia nueva. Si necesitas responder “¿qué tan probable es la causa después de observar el efecto?”, probablemente estás frente a un problema bayesiano.',
    action: 'Ir al problema',
  },
  prereq: {
    title: 'Puede faltar un prerrequisito',
    body: 'Si el mapa detectó prerrequisitos, arriba de la sesión puedes abrir un repaso de 3 minutos antes de continuar. La idea es recuperar solo la base que te falta, no obligarte a repetir una lección completa.',
    action: 'Repasar condicionales',
  },
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function conceptRecord(memory: LearningMemory, materialId: string, concept: string) {
  const normalized = concept.toLocaleLowerCase('es-MX')
  return Object.values(memory.concepts).find(record =>
    record.materialId === materialId &&
    record.concept.toLocaleLowerCase('es-MX') === normalized
  )
}

function lessonIsCompleted(record: ReturnType<typeof conceptRecord>) {
  return Boolean(record?.completedAt || typeof record?.teachBackScore === 'number')
}

function lessonCompletionScore(record: ReturnType<typeof conceptRecord>) {
  return record?.completionScore ?? record?.teachBackScore ?? record?.mastery ?? 0
}

function App() {
  const { user, signOut } = useAuth()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const [syncError, setSyncError] = useState('')
  const [cloudHydrated, setCloudHydrated] = useState(false)
  const [view, setView] = useState<View>('home')
  const [stepIndex, setStepIndex] = useState(0)
  const [problemAnswer, setProblemAnswer] = useState<string | null>(null)
  const [soloAnswer, setSoloAnswer] = useState<string | null>(null)
  const [guidedValue, setGuidedValue] = useState('')
  const [explanation, setExplanation] = useState('')
  const [explainScore, setExplainScore] = useState<number | null>(null)
  const [blockerOpen, setBlockerOpen] = useState(false)
  const [selectedBlocker, setSelectedBlocker] = useState<Blocker | null>(null)
  const [mastery, setMastery] = useState(() => Number(localStorage.getItem(`comprende-mastery:${user.id}`) || localStorage.getItem('comprende-mastery') || '18'))
  const [completedSteps, setCompletedSteps] = useState<StepId[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`comprende-steps:${user.id}`) || localStorage.getItem('comprende-steps') || '[]')
    } catch {
      return []
    }
  })
  const speech = useMicroAudio()
  const [materials, setMaterials] = useState<StudyMaterial[]>(() => loadLocalMaterialCache(user.id))
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null)
  const [activeConcept, setActiveConcept] = useState('')
  const [learningMemory, setLearningMemory] = useState<LearningMemory>(() => loadLearningMemory(user.id))

  useEffect(() => {
    let cancelled = false
    setCloudHydrated(false)
    setSyncStatus('loading')
    setSyncError('')

    const localMaterialsSnapshot = loadLocalMaterialCache(user.id)
    const localMemorySnapshot = loadLearningMemory(user.id)

    loadCloudState(user.id).then(async cloud => {
      if (cancelled) return
      let authoritative = cloud

      // Migración única por dispositivo: rescata datos locales antiguos SIN borrar ni degradar
      // lo que ya existe en Supabase. Después de esto, la nube manda siempre.
      if (!hasCompletedCloudMigration(user.id) && (localMaterialsSnapshot.length || Object.keys(localMemorySnapshot.concepts).length)) {
        setSyncStatus('syncing')
        authoritative = await migrateLocalStateToCloud(user.id, localMaterialsSnapshot, localMemorySnapshot, cloud)
      }

      const cloudMaterials = authoritative.materials || []
      const cloudMemory = authoritative.progress?.learningMemory || { version: 1, concepts: {} } as LearningMemory
      const cloudSteps = (authoritative.progress?.completedSteps || []) as StepId[]
      const cloudMastery = authoritative.progress?.demoMastery ?? 18

      if (cancelled) return
      setMaterials(cloudMaterials)
      setLearningMemory(cloudMemory)
      setCompletedSteps(cloudSteps)
      setMastery(cloudMastery)
      saveLocalMaterialCache(user.id, cloudMaterials)
      saveLearningMemory(cloudMemory, user.id)
      localStorage.setItem(`comprende-mastery:${user.id}`, String(cloudMastery))
      localStorage.setItem(`comprende-steps:${user.id}`, JSON.stringify(cloudSteps))
      setCloudHydrated(true)
      setSyncStatus('synced')
    }).catch(error => {
      if (cancelled) return
      setSyncStatus('error')
      setSyncError(error instanceof Error ? error.message : 'No pude cargar tus datos de Supabase.')
      // Si la nube no está disponible, conservamos la caché local para no bloquear el estudio.
      setMaterials(localMaterialsSnapshot)
      setLearningMemory(localMemorySnapshot)
      setCloudHydrated(true)
    })
    return () => { cancelled = true }
  }, [user.id])

  // Solo el estado de la demo original se guarda de forma global. El progreso real por concepto
  // se persiste de manera granular en comprende_v1_concept_progress para evitar que un
  // dispositivo antiguo sobrescriba todo el progreso de otro.
  useEffect(() => {
    if (!cloudHydrated) return
    const timer = window.setTimeout(() => {
      saveCloudShellState(user.id, learningMemory, mastery, completedSteps).catch(error => {
        setSyncStatus('error')
        setSyncError(error instanceof Error ? error.message : 'No pude guardar el estado general.')
      })
    }, 900)
    return () => window.clearTimeout(timer)
  }, [cloudHydrated, user.id, mastery, completedSteps, learningMemory])

  useEffect(() => {
    localStorage.setItem(`comprende-mastery:${user.id}`, String(mastery))
    localStorage.setItem(`comprende-steps:${user.id}`, JSON.stringify(completedSteps))
  }, [user.id, mastery, completedSteps])

  useEffect(() => {
    saveLocalMaterialCache(user.id, materials)
  }, [user.id, materials])

  useEffect(() => {
    saveLearningMemory(learningMemory, user.id)
  }, [user.id, learningMemory])

  const recordMemoryEvent = (event: MemoryEvent) => {
    setLearningMemory(current => {
      const next = applyMemoryEvent(current, event)
      const record = conceptRecord(next, event.materialId, event.concept)
      if (record && cloudHydrated) {
        setSyncStatus('syncing')
        saveConceptProgress(user.id, record, event).then(() => {
          setSyncStatus('synced')
          setSyncError('')
        }).catch(error => {
          setSyncStatus('error')
          setSyncError(error instanceof Error ? error.message : 'No pude guardar esta evidencia de aprendizaje.')
        })
      }
      return next
    })
  }

  const addMaterial = async (material: StudyMaterial, file: File) => {
    setSyncStatus('syncing')
    const updatedAt = new Date().toISOString()
    let originalFilePath = material.originalFilePath
    try {
      originalFilePath = await uploadMaterialOriginal(user.id, material.id, file)
    } catch (error) {
      // El material procesado sigue siendo útil aunque Storage falle. Dejamos el error visible,
      // pero no perdemos el análisis ya realizado.
      setSyncError(`El contenido se guardará, pero no pude subir el archivo original: ${error instanceof Error ? error.message : 'error desconocido'}`)
    }
    const nextMaterial: StudyMaterial = {
      ...material,
      updatedAt,
      originalFilePath,
      originalFileSize: file.size,
      originalMimeType: file.type || material.originalMimeType,
    }
    await saveCloudMaterial(user.id, nextMaterial)
    setMaterials(current => [nextMaterial, ...current.filter(item => item.id !== nextMaterial.id)])
    setSyncStatus('synced')
    return nextMaterial
  }

  const updateMaterial = async (material: StudyMaterial) => {
    const nextMaterial = { ...material, updatedAt: new Date().toISOString() }
    setMaterials(current => current.map(item => item.id === nextMaterial.id ? nextMaterial : item))
    setSyncStatus('syncing')
    try {
      await saveCloudMaterial(user.id, nextMaterial)
      setSyncStatus('synced')
      setSyncError('')
    } catch (error) {
      setSyncStatus('error')
      setSyncError(error instanceof Error ? error.message : 'No pude guardar el material actualizado.')
    }
  }

  const removeMaterial = async (material: StudyMaterial) => {
    setSyncStatus('syncing')
    try {
      await deleteCloudMaterial(user.id, material)
      setMaterials(current => current.filter(item => item.id !== material.id))
      setLearningMemory(current => ({
        ...current,
        concepts: Object.fromEntries(Object.entries(current.concepts).filter(([, record]) => record.materialId !== material.id)),
      }))
      setSyncStatus('synced')
      setSyncError('')
    } catch (error) {
      setSyncStatus('error')
      setSyncError(error instanceof Error ? error.message : 'No pude eliminar el material de la nube.')
    }
  }

  const importBackup = async (nextMaterials: StudyMaterial[], nextMemory: LearningMemory) => {
    setSyncStatus('syncing')
    const stamped = nextMaterials.map(material => ({ ...material, updatedAt: material.updatedAt || new Date().toISOString() }))
    await saveCloudMaterials(user.id, stamped)
    await saveAllConceptProgress(user.id, nextMemory)
    setMaterials(stamped)
    setLearningMemory(nextMemory)
    setSyncStatus('synced')
  }

  const openTrackedConcept = (materialId: string, concept: string) => {
    setActiveMaterialId(materialId)
    setActiveConcept(concept)
    setView('material-study')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const currentStep = steps[stepIndex]

  const finishStep = () => {
    if (!completedSteps.includes(currentStep.id)) {
      const next = [...completedSteps, currentStep.id]
      setCompletedSteps(next)
      setMastery(clamp(Math.round((next.length / steps.length) * 100), 0, 100))
    }
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1)
  }

  const startSession = () => {
    setView('session')
    setStepIndex(0)
    window.scrollTo({ top: 0 })
  }

  const evaluateExplanation = () => {
    const text = explanation.toLowerCase()
    const concepts = [
      ['inicial', 'previa', 'prior', 'antes'],
      ['evidencia', 'dato', 'resultado'],
      ['actualiza', 'actualizar', 'posterior', 'después'],
      ['falso', 'falsos positivos', 'prevalencia', 'frecuencia'],
    ]
    const hits = concepts.filter(group => group.some(word => text.includes(word))).length
    const lengthBonus = text.trim().split(/\s+/).length >= 30 ? 1 : 0
    setExplainScore(Math.min(100, 20 + hits * 18 + lengthBonus * 8))
  }

  const handleSignOut = async () => {
    // La nube ya conserva el estado. Limpiamos datos privados del navegador para que
    // otro usuario en el mismo equipo no herede materiales/progreso ni caché pedagógico.
    clearLocalMaterialCache(user.id)
    clearLearningMemoryCache(user.id)
    localStorage.removeItem(`comprende-mastery:${user.id}`)
    localStorage.removeItem(`comprende-steps:${user.id}`)
    localStorage.removeItem('comprende-mastery')
    localStorage.removeItem('comprende-steps')
    localStorage.removeItem('comprende-learning-mode')
    clearAiClientCache()
    await signOut()
  }

  const jumpForBlocker = () => {
    const blocker = selectedBlocker
    if (!blocker) return
    const target: Record<Blocker, StepId> = {
      terms: 'intuition',
      formula: 'visual',
      use: 'problem',
      prereq: 'intuition',
    }
    setStepIndex(steps.findIndex(s => s.id === target[blocker]))
    setBlockerOpen(false)
  }

  if (!cloudHydrated && syncStatus === 'loading') {
    return <div className="cloud-bootstrap-screen"><div className="cloud-bootstrap-card"><Cloud size={28} /><strong>Sincronizando tu biblioteca…</strong><span>Supabase es la fuente oficial. Estoy cargando materiales, progreso y lecciones completadas antes de mostrar datos.</span></div></div>
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} mastery={mastery} materialCount={materials.length} dueCount={dueReviews(learningMemory).length} />
      <main className="main-area">
        <Topbar view={view} setView={setView} email={user.email || ''} syncStatus={syncStatus} syncError={syncError} onSignOut={handleSignOut} />
        {view === 'home' && <DashboardView materials={materials} learningMemory={learningMemory} onOpenConcept={openTrackedConcept} onOpenMap={(id) => { setActiveMaterialId(id); setView('material-map'); window.scrollTo({ top: 0 }) }} onOpenMaterials={() => setView('materials')} onOpenReviews={() => setView('practice')} onOpenProgress={() => setView('progress')} onImport={(nextMaterials, nextMemory) => { void importBackup(nextMaterials, nextMemory) }} onStartDemo={startSession} />}
        {view === 'materials' && (
          <MaterialsView
            materials={materials}
            onAddMaterial={addMaterial}
            onDeleteMaterial={removeMaterial}
            learningMemory={learningMemory}
            onStudy={(id, concept) => { setActiveMaterialId(id); setActiveConcept(concept); setView('material-study'); window.scrollTo({ top: 0 }) }}
            onMap={(id) => { setActiveMaterialId(id); setView('material-map'); window.scrollTo({ top: 0 }) }}
          />
        )}
        {view === 'material-map' && activeMaterialId && (
          <MaterialMapView
            material={materials.find(m => m.id === activeMaterialId) || null}
            learningMemory={learningMemory}
            onBack={() => setView('materials')}
            onStudy={(concept) => { setActiveConcept(concept); setView('material-study'); window.scrollTo({ top: 0 }) }}
            onUpdate={(updated) => { void updateMaterial(updated) }}
          />
        )}
        {view === 'material-study' && activeMaterialId && (
          <MaterialStudyView
            material={materials.find(m => m.id === activeMaterialId) || null}
            initialConcept={activeConcept}
            onBack={() => setView('materials')}
            onMemoryEvent={recordMemoryEvent}
            learningMemory={learningMemory}
            userId={user.id}
          />
        )}
        {view === 'session' && (
          <SessionView
            stepIndex={stepIndex}
            setStepIndex={setStepIndex}
            problemAnswer={problemAnswer}
            setProblemAnswer={setProblemAnswer}
            soloAnswer={soloAnswer}
            setSoloAnswer={setSoloAnswer}
            guidedValue={guidedValue}
            setGuidedValue={setGuidedValue}
            explanation={explanation}
            setExplanation={setExplanation}
            explainScore={explainScore}
            evaluateExplanation={evaluateExplanation}
            finishStep={finishStep}
            completedSteps={completedSteps}
            setBlockerOpen={setBlockerOpen}
            speech={speech}
          />
        )}
        {view === 'practice' && <PracticeView setView={setView} learningMemory={learningMemory} materials={materials} onReview={openTrackedConcept} />}
        {view === 'progress' && <ProgressView mastery={mastery} completedSteps={completedSteps} startSession={startSession} learningMemory={learningMemory} onReview={openTrackedConcept} />}
      </main>

      {blockerOpen && (
        <BlockerModal
          selected={selectedBlocker}
          setSelected={setSelectedBlocker}
          close={() => setBlockerOpen(false)}
          onAction={jumpForBlocker}
        />
      )}
    </div>
  )
}

function Sidebar({ view, setView, mastery, materialCount, dueCount }: { view: View; setView: (v: View) => void; mastery: number; materialCount: number; dueCount: number }) {
  const items = [
    { id: 'home' as View, label: 'Panel', icon: Home },
    { id: 'materials' as View, label: `Materiales${materialCount ? ` · ${materialCount}` : ''}`, icon: FolderOpen },
    { id: 'practice' as View, label: `Repasar${dueCount ? ` · ${dueCount}` : ''}`, icon: Target },
    { id: 'progress' as View, label: 'Dominio', icon: BarChart3 },
  ]
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">C</div>
        <div>
          <strong>Comprende</strong>
          <span>VERSIÓN 2.0.7 · UNIVERSAL LEARNING ENGINE</span>
        </div>
      </div>
      <nav className="nav-list">
        {items.map(item => {
          const Icon = item.icon
          return (
            <button key={item.id} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setView(item.id)}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="side-section">
        <div className="side-label">HOY</div>
        <button className="course-card" onClick={() => setView(dueCount ? 'practice' : 'materials')}>
          <div className="course-icon">{dueCount ? '↻' : '◎'}</div>
          <div className="course-copy">
            <strong>{dueCount ? `${dueCount} ${dueCount === 1 ? 'repaso' : 'repasos'}` : materialCount ? `${materialCount} ${materialCount === 1 ? 'material' : 'materiales'}` : 'Empieza aquí'}</strong>
            <span>{dueCount ? 'Prioridad de memoria' : materialCount ? 'Biblioteca semántica' : 'Sube tu primer PDF'}</span>
          </div>
        </button>
      </div>
      <div className="sidebar-footer sidebar-footer-v10">
        <small>Comprende 2.0.7 · Supabase Sync</small>
        <button onClick={() => setView('session')}>Abrir demo de Bayes</button>
      </div>
    </aside>
  )
}

function Topbar({ view, setView, email, syncStatus, syncError, onSignOut }: { view: View; setView: (v: View) => void; email: string; syncStatus: SyncStatus; syncError: string; onSignOut: () => Promise<void> }) {
  const syncLabel = syncStatus === 'loading' ? 'Cargando nube' : syncStatus === 'syncing' ? 'Guardando…' : syncStatus === 'error' ? 'Error de nube' : 'Todo sincronizado'
  return (
    <header className="topbar">
      <div className="crumbs">
        <span>Comprende 2.0.7</span>
        {view === 'session' && <><ChevronRight size={14} /><strong>Teorema de Bayes</strong></>}
        {(view === 'materials' || view === 'material-study' || view === 'material-map') && <><ChevronRight size={14} /><strong>{view === 'materials' ? 'Materiales' : view === 'material-map' ? 'Mapa del documento' : 'Mesa de comprensión'}</strong></>}
        {view === 'practice' && <><ChevronRight size={14} /><strong>Repaso inteligente</strong></>}
        {view === 'progress' && <><ChevronRight size={14} /><strong>Dominio</strong></>}
      </div>
      <div className="topbar-account">
        <span className={`cloud-status ${syncStatus}`} title={syncError || 'Tus cambios se guardan en Supabase'}><Cloud size={14} /> {syncLabel}</span>
        <span className="account-email">{email}</span>
        {view !== 'home' && <button className="ghost-button" onClick={() => setView('home')}><ArrowLeft size={16} /> Inicio</button>}
        <button className="ghost-button signout-button" onClick={() => void onSignOut()} title="Cerrar sesión"><LogOut size={16} /> Salir</button>
      </div>
    </header>
  )
}

function HomeView({ mastery, startSession, setView, materialCount, learningMemory, onReview }: { mastery: number; startSession: () => void; setView: (v: View) => void; materialCount: number; learningMemory: LearningMemory; onReview: (materialId: string, concept: string) => void }) {
  const due = dueReviews(learningMemory)
  const fragile = fragileConcepts(learningMemory)
  const nextReview = due[0] || fragile[0] || getMemoryRecords(learningMemory)[0]
  return (
    <div className="page home-page">
      <section className="hero">
        <div className="eyebrow"><Sparkles size={16} /> SESIONES CORTAS · COMPRENSIÓN REAL</div>
        <h1>¿Qué quieres <span>entender</span> hoy?</h1>
        <p>No empieces memorizando. Empieza con un problema, míralo, practícalo y después explícalo con tus propias palabras.</p>
      </section>

      <section className="memory-home-strip">
        <div className="memory-home-icon"><RefreshCw size={21} /></div>
        <div className="memory-home-copy">
          <span className="tiny-label">MEMORIA ACTIVA</span>
          <h3>{due.length ? `${due.length} ${due.length === 1 ? 'concepto necesita' : 'conceptos necesitan'} repaso hoy` : getMemoryRecords(learningMemory).length ? 'Tu memoria está al día' : 'Empieza a estudiar y construiré tu calendario de repaso'}</h3>
          <p>{due.length ? 'No repitas todo el tema. Comprende te devuelve justo al concepto que conviene recuperar antes de que se enfríe.' : getMemoryRecords(learningMemory).length ? `Tienes ${fragile.length} concepto${fragile.length === 1 ? '' : 's'} frágil${fragile.length === 1 ? '' : 'es'} y el sistema ya programó el siguiente repaso.` : 'Después de practicar o explicarme un concepto, registraré la evidencia y decidiré cuándo conviene recuperarlo de memoria.'}</p>
        </div>
        <div className="memory-home-actions">
          {nextReview && <button className="primary-button" onClick={() => onReview(nextReview.materialId, nextReview.concept)}>{due.length ? `Repasar ${nextReview.concept}` : `Volver a ${nextReview.concept}`} <ArrowRight size={15} /></button>}
          <button className="secondary-button" onClick={() => setView('practice')}>Ver cola de repaso</button>
        </div>
      </section>

      <section className="focus-card">
        <div className="focus-main">
          <div className="focus-icon"><BrainCircuit size={24} /></div>
          <div className="focus-copy">
            <span className="tiny-label">SESIÓN RECOMENDADA · 18–22 MIN</span>
            <h2>Teorema de Bayes</h2>
            <p>Por qué una prueba “99% precisa” no significa necesariamente que tengas 99% de probabilidad.</p>
            <div className="chips"><span>Intuición</span><span>Simulador</span><span>Práctica</span><span>Active recall</span></div>
          </div>
        </div>
        <div className="focus-action">
          <div className="mastery-ring" style={{ '--p': `${mastery * 3.6}deg` } as CSSProperties}>
            <div><strong>{mastery}%</strong><span>dominio</span></div>
          </div>
          <button className="primary-button" onClick={startSession}>{mastery > 20 ? 'Continuar sesión' : 'Empezar sesión'} <ArrowRight size={17} /></button>
        </div>
      </section>

      <div className="home-grid">
        <section className="panel">
          <div className="panel-heading"><div><span className="tiny-label">CUANDO ALGO NO HACE CLIC</span><h3>Detectamos el bloqueo</h3></div><CircleHelp size={20} /></div>
          <div className="blocker-preview">
            <div><span>1</span><p><strong>No entiendo los términos</strong><small>Quitamos vocabulario y volvemos a la intuición.</small></p></div>
            <div><span>2</span><p><strong>Entiendo la idea, no la fórmula</strong><small>La reconstruimos desde un ejemplo visual.</small></p></div>
            <div><span>3</span><p><strong>No sé cuándo usarlo</strong><small>Practicamos reconocimiento de problemas.</small></p></div>
          </div>
        </section>

        <section className="panel audio-panel">
          <div className="panel-heading"><div><span className="tiny-label">AUDIO SIN MARATONES</span><h3>Microaudios, no clases de una hora</h3></div><Headphones size={20} /></div>
          <div className="audio-preview-row"><div className="audio-dot"><Volume2 size={16} /></div><div><strong>Repasar</strong><span>Idea esencial</span></div><b>~2 min</b></div>
          <div className="audio-preview-row"><div className="audio-dot"><Volume2 size={16} /></div><div><strong>Entender</strong><span>Explicación intuitiva</span></div><b>~3 min</b></div>
          <div className="audio-preview-row"><div className="audio-dot"><Volume2 size={16} /></div><div><strong>Antes del examen</strong><span>Errores y claves</span></div><b>~4 min</b></div>
        </section>
      </div>

      <section className="material-cta">
        <div className="material-cta-icon"><UploadCloud size={24} /></div>
        <div>
          <span className="tiny-label">TU MATERIAL</span>
          <h3>Convierte tus PDFs en una mesa de estudio</h3>
          <p>Sube un documento de la maestría. Comprende extrae el texto, detecta conceptos y te ayuda a estudiarlos con recuperación activa, sin esconderte detrás de un resumen.</p>
        </div>
        <button className="primary-button" onClick={() => setView('materials')}>{materialCount ? 'Abrir materiales' : 'Subir material'} <ArrowRight size={16} /></button>
      </section>

      <section className="section-title-row"><div><span className="tiny-label">SIGUIENTE CAPA</span><h3>Después de Bayes</h3></div><button className="text-button" onClick={() => setView('progress')}>Ver dominio <ArrowRight size={15} /></button></section>
      <div className="topic-row">
        {[
          ['Probabilidad condicional', 'Prerrequisito', 'Reforzar'],
          ['Redes bayesianas', 'Siguiente concepto', 'Bloqueado'],
          ['Naive Bayes', 'Aplicación en IA', 'Bloqueado'],
        ].map(([title, kicker, status], i) => (
          <div className="topic-card" key={title}>
            <div className={`topic-number n${i + 1}`}>{i + 1}</div>
            <div><span>{kicker}</span><strong>{title}</strong></div>
            <em>{status}</em>
          </div>
        ))}
      </div>
    </div>
  )
}

function SessionView(props: {
  stepIndex: number
  setStepIndex: (n: number) => void
  problemAnswer: string | null
  setProblemAnswer: (v: string) => void
  soloAnswer: string | null
  setSoloAnswer: (v: string) => void
  guidedValue: string
  setGuidedValue: (v: string) => void
  explanation: string
  setExplanation: (v: string) => void
  explainScore: number | null
  evaluateExplanation: () => void
  finishStep: () => void
  completedSteps: StepId[]
  setBlockerOpen: (v: boolean) => void
  speech: ReturnType<typeof useMicroAudio>
}) {
  const { stepIndex, setStepIndex, completedSteps } = props
  return (
    <div className="page session-page">
      <div className="session-header">
        <div><span className="tiny-label">ESTADÍSTICA · SESIÓN DE COMPRENSIÓN</span><h1>Teorema de Bayes</h1><p>De la intuición a poder explicarlo sin mirar apuntes.</p></div>
        <button className="help-button" onClick={() => props.setBlockerOpen(true)}><CircleHelp size={17} /> No lo estoy entendiendo</button>
      </div>

      <div className="stepper">
        {steps.map((s, i) => (
          <button key={s.id} className={`${i === stepIndex ? 'current' : ''} ${completedSteps.includes(s.id) ? 'done' : ''}`} onClick={() => setStepIndex(i)}>
            <span>{completedSteps.includes(s.id) ? <Check size={14} /> : i + 1}</span>
            <small>{s.short}</small>
          </button>
        ))}
      </div>

      <div className="learning-card">
        <StepContent {...props} />
        <div className="card-footer">
          <button className="ghost-button" disabled={stepIndex === 0} onClick={() => setStepIndex(stepIndex - 1)}><ArrowLeft size={16} /> Anterior</button>
          {stepIndex < steps.length - 1 ? (
            <button className="primary-button" onClick={props.finishStep}>Entendido, seguir <ArrowRight size={16} /></button>
          ) : (
            <button className="primary-button" onClick={props.finishStep}><Check size={16} /> Guardar dominio</button>
          )}
        </div>
      </div>
    </div>
  )
}

function StepContent(props: Parameters<typeof SessionView>[0]) {
  const step = steps[props.stepIndex].id
  if (step === 'problem') return <ProblemStep answer={props.problemAnswer} setAnswer={props.setProblemAnswer} />
  if (step === 'intuition') return <IntuitionStep speech={props.speech} />
  if (step === 'visual') return <BayesSimulator />
  if (step === 'formal') return <FormalStep />
  if (step === 'guided') return <GuidedStep value={props.guidedValue} setValue={props.setGuidedValue} />
  if (step === 'solo') return <SoloStep answer={props.soloAnswer} setAnswer={props.setSoloAnswer} />
  return <ExplainStep explanation={props.explanation} setExplanation={props.setExplanation} score={props.explainScore} evaluate={props.evaluateExplanation} />
}

function StepHeading({ icon, kicker, title, children }: { icon: ReactNode; kicker: string; title: string; children?: ReactNode }) {
  return <div className="step-heading"><div className="step-icon">{icon}</div><div><span className="tiny-label">{kicker}</span><h2>{title}</h2>{children && <p>{children}</p>}</div></div>
}

function ProblemStep({ answer, setAnswer }: { answer: string | null; setAnswer: (v: string) => void }) {
  const options = [
    ['A', '99%'], ['B', '95%'], ['C', '50%'], ['D', 'Aproximadamente 17%'],
  ]
  return <div className="step-content">
    <StepHeading icon={<Target size={22} />} kicker="1 · EL PROBLEMA" title="Primero intenta predecirlo">No importa si fallas. Queremos que tu intuición se confronte con el resultado.</StepHeading>
    <div className="scenario">
      <p>Una enfermedad afecta a <strong>1 de cada 100 personas</strong>. Una prueba detecta al <strong>99% de los enfermos</strong>, pero da positivo por error al <strong>5% de las personas sanas</strong>.</p>
      <h3>La prueba salió positiva. ¿Qué probabilidad crees que tienes de estar enfermo?</h3>
    </div>
    <div className="answer-grid">
      {options.map(([key, label]) => <button key={key} onClick={() => setAnswer(key)} className={answer === key ? 'selected' : ''}><span>{key}</span>{label}</button>)}
    </div>
    {answer && <div className={answer === 'D' ? 'feedback success' : 'feedback'}>{answer === 'D' ? <><Check size={18} /><div><strong>Muy bien.</strong><p>Ahora vamos a descubrir por qué es tan distinto de 99%.</p></div></> : <><Lightbulb size={18} /><div><strong>Tu intuición hizo exactamente lo que suele hacer.</strong><p>La sensibilidad de la prueba no es lo mismo que la probabilidad de estar enfermo después de un positivo.</p></div></>}</div>}
  </div>
}

function AudioCard({ title, subtitle, script, speech }: { title: string; subtitle: string; script: string; speech: ReturnType<typeof useMicroAudio> }) {
  return <div className="microaudio-card"><div className="audio-play"><Volume2 size={18} /></div><div><strong>{title}</strong><span>{subtitle}</span>{speech.source && <small className="audio-cache-note">{speech.source === 'cache' ? 'Audio guardado · Supabase' : 'Nueva voz · guardada en Supabase'}</small>}{speech.error && <small className="audio-error-note">{speech.error}</small>}</div><div className="audio-actions">{!speech.playing ? <button disabled={speech.loading} onClick={() => speech.speak(script)}><Play size={15} /> {speech.loading ? 'Preparando…' : 'Escuchar'}</button> : <><button onClick={() => speech.paused ? speech.resume() : speech.pause()}>{speech.paused ? <Play size={15} /> : <Pause size={15} />}</button><button onClick={speech.stop}><Square size={14} /></button></>}</div></div>
}

function IntuitionStep({ speech }: { speech: ReturnType<typeof useMicroAudio> }) {
  return <div className="step-content">
    <StepHeading icon={<Lightbulb size={22} />} kicker="2 · ENTIÉNDELO FÁCIL" title="Olvida la fórmula por un momento">Piensa en personas reales antes de pensar en símbolos.</StepHeading>
    <div className="story-visual">
      <div className="population-block"><span>10,000</span><small>personas</small></div>
      <ArrowRight size={22} />
      <div className="split-box"><div><b>100</b><span>enfermas</span></div><div><b>9,900</b><span>sanas</span></div></div>
      <ArrowRight size={22} />
      <div className="split-box accent"><div><b>99</b><span>positivos reales</span></div><div><b>495</b><span>falsos positivos</span></div></div>
    </div>
    <div className="aha-box"><Sparkles size={20} /><div><strong>La idea que debe hacer clic</strong><p>De 594 personas con resultado positivo, solo 99 están realmente enfermas. Por eso 99 ÷ 594 ≈ <b>16.7%</b>.</p></div></div>
    <AudioCard title="Escucharlo en modo explicación" subtitle="Narración breve con la intuición completa" script={audioScripts.understand} speech={speech} />
  </div>
}

function BayesSimulator() {
  const [prevalence, setPrevalence] = useState(1)
  const [sensitivity, setSensitivity] = useState(99)
  const [falsePositive, setFalsePositive] = useState(5)
  const population = 10000
  const sick = population * (prevalence / 100)
  const healthy = population - sick
  const truePos = sick * (sensitivity / 100)
  const falsePos = healthy * (falsePositive / 100)
  const posterior = (truePos / Math.max(1, truePos + falsePos)) * 100

  return <div className="step-content">
    <StepHeading icon={<Gauge size={22} />} kicker="3 · MÍRALO" title="Mueve las condiciones y mira qué cambia">El objetivo no es calcular: es desarrollar intuición.</StepHeading>
    <div className="simulator-grid">
      <div className="controls-card">
        <Slider label="Prevalencia" value={prevalence} setValue={setPrevalence} min={1} max={50} suffix="%" />
        <Slider label="Sensibilidad" value={sensitivity} setValue={setSensitivity} min={50} max={100} suffix="%" />
        <Slider label="Falsos positivos" value={falsePositive} setValue={setFalsePositive} min={1} max={30} suffix="%" />
        <button className="reset-button" onClick={() => { setPrevalence(1); setSensitivity(99); setFalsePositive(5) }}><RotateCcw size={15} /> Valores del ejemplo</button>
      </div>
      <div className="posterior-card">
        <span>PROBABILIDAD DESPUÉS DEL POSITIVO</span>
        <strong>{posterior.toFixed(1)}%</strong>
        <div className="result-bar"><span style={{ width: `${posterior}%` }} /></div>
        <p>En 10,000 personas habría aprox. <b>{Math.round(truePos)}</b> positivos reales y <b>{Math.round(falsePos)}</b> falsos positivos.</p>
      </div>
    </div>
    <div className="insight-row"><Lightbulb size={17} /><p>Prueba subir la prevalencia al 20%. Verás que el mismo positivo se vuelve mucho más convincente. <strong>El punto de partida importa.</strong></p></div>
  </div>
}

function Slider({ label, value, setValue, min, max, suffix }: { label: string; value: number; setValue: (n: number) => void; min: number; max: number; suffix: string }) {
  return <label className="slider-row"><div><span>{label}</span><strong>{value}{suffix}</strong></div><input type="range" min={min} max={max} value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(Number(e.target.value))} /></label>
}

function FormalStep() {
  return <div className="step-content">
    <StepHeading icon={<BookOpen size={22} />} kicker="4 · AHORA SÍ, FORMAL" title="Ponemos símbolos a algo que ya entendiste">La teoría llega después de la intuición, no antes.</StepHeading>
    <div className="formula-card">P(A|B) = <span>P(B|A) · P(A)</span><hr /><span>P(B)</span></div>
    <div className="term-grid">
      <div><span className="term-chip prior">PRIOR</span><strong>P(A)</strong><p>Lo que creías antes de ver la evidencia.</p></div>
      <div><span className="term-chip likelihood">LIKELIHOOD</span><strong>P(B|A)</strong><p>Qué tan esperable es la evidencia si A fuera cierta.</p></div>
      <div><span className="term-chip posterior">POSTERIOR</span><strong>P(A|B)</strong><p>Lo que crees después de observar B.</p></div>
    </div>
    <div className="warning-box"><CircleHelp size={18} /><div><strong>Error de examen frecuente</strong><p>P(positivo | enfermo) no es lo mismo que P(enfermo | positivo). Bayes sirve precisamente para invertir esa perspectiva correctamente.</p></div></div>
  </div>
}

function GuidedStep({ value, setValue }: { value: string; setValue: (v: string) => void }) {
  const numeric = Number(value)
  const correct = value !== '' && Math.abs(numeric - 16.7) < 1
  return <div className="step-content">
    <StepHeading icon={<BrainCircuit size={22} />} kicker="5 · HAZLO CONMIGO" title="Ahora tú completas una parte">Yo sostengo la estructura; tú haces el salto importante.</StepHeading>
    <div className="guided-problem">
      <div className="guided-line done"><span>1</span><p>De 10,000 personas, 1% está enfermo → <strong>100 enfermos</strong>.</p><Check size={16} /></div>
      <div className="guided-line done"><span>2</span><p>99% de sensibilidad → <strong>99 verdaderos positivos</strong>.</p><Check size={16} /></div>
      <div className="guided-line done"><span>3</span><p>5% de 9,900 sanos → <strong>495 falsos positivos</strong>.</p><Check size={16} /></div>
      <div className="guided-line active"><span>4</span><p>Entonces: 99 ÷ (99 + 495) × 100 =</p><div className="inline-input"><input value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="?" /><b>%</b></div></div>
    </div>
    {value && <div className={correct ? 'feedback success' : 'feedback'}>{correct ? <><Check size={18} /><div><strong>Exacto: aproximadamente 16.7%.</strong><p>Ya no estás aplicando una fórmula a ciegas; sabes de dónde viene cada término.</p></div></> : <><Lightbulb size={18} /><div><strong>Casi.</strong><p>Suma todos los positivos primero: 99 + 495 = 594. Después divide 99 entre 594.</p></div></>}</div>}
  </div>
}

function SoloStep({ answer, setAnswer }: { answer: string | null; setAnswer: (v: string) => void }) {
  const options = [
    ['A', 'Aumenta'], ['B', 'Disminuye'], ['C', 'No cambia'], ['D', 'Siempre se vuelve 100%'],
  ]
  return <div className="step-content">
    <StepHeading icon={<Target size={22} />} kicker="6 · AHORA TÚ" title="Transfiere la idea a una situación nueva">Aquí ya no tienes el procedimiento resuelto.</StepHeading>
    <div className="scenario compact"><p>Usamos la misma prueba, con la misma sensibilidad y la misma tasa de falsos positivos. Pero ahora estudiamos una población donde la enfermedad es mucho más frecuente.</p><h3>¿Qué suele pasar con P(enfermedad | positivo)?</h3></div>
    <div className="answer-grid two-col">{options.map(([key, label]) => <button key={key} className={answer === key ? 'selected' : ''} onClick={() => setAnswer(key)}><span>{key}</span>{label}</button>)}</div>
    {answer && <div className={answer === 'A' ? 'feedback success' : 'feedback'}>{answer === 'A' ? <><Check size={18} /><div><strong>Correcto.</strong><p>Si la condición era más probable desde el inicio, el mismo positivo suele producir una posterior mayor.</p></div></> : <><Lightbulb size={18} /><div><strong>Revisa el punto de partida.</strong><p>Mayor prevalencia significa que entre los positivos habrá proporcionalmente más casos reales.</p></div></>}</div>}
  </div>
}

function ExplainStep({ explanation, setExplanation, score, evaluate }: { explanation: string; setExplanation: (v: string) => void; score: number | null; evaluate: () => void }) {
  const words = explanation.trim() ? explanation.trim().split(/\s+/).length : 0
  return <div className="step-content">
    <StepHeading icon={<Trophy size={22} />} kicker="7 · EXPLÍCAMELO TÚ" title="Demuestra que realmente lo entendiste">Sin mirar arriba: explícaselo a alguien que nunca ha estudiado estadística.</StepHeading>
    <div className="prompt-card"><strong>Tu reto</strong><p>¿Qué hace el Teorema de Bayes y por qué una prueba con 99% de sensibilidad no implica necesariamente 99% de probabilidad de estar enfermo después de un positivo?</p></div>
    <textarea className="explanation-area" value={explanation} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setExplanation(e.target.value)} placeholder="Explícalo con tus palabras. No hace falta sonar académico..." />
    <div className="textarea-footer"><span>{words} palabras · intenta llegar a 30+</span><button className="secondary-button" onClick={evaluate} disabled={words < 8}><Sparkles size={15} /> Evaluar comprensión</button></div>
    {score !== null && <ExplainFeedback score={score} explanation={explanation} />}
  </div>
}

function ExplainFeedback({ score, explanation }: { score: number; explanation: string }) {
  const t = explanation.toLowerCase()
  const missing = [
    !/(previa|inicial|prior|antes)/.test(t) && 'probabilidad inicial',
    !/(evidencia|dato|resultado)/.test(t) && 'evidencia nueva',
    !/(actualiza|posterior|después)/.test(t) && 'actualización posterior',
  ].filter(Boolean) as string[]
  return <div className="evaluation-card"><div className="score-circle">{score}</div><div><strong>{score >= 80 ? 'La idea central está clara.' : score >= 60 ? 'Vas bien; falta afinar una parte.' : 'Todavía hay huecos conceptuales.'}</strong><p>{missing.length ? `Intenta incluir explícitamente: ${missing.join(', ')}.` : 'Conectaste el punto de partida, la evidencia y la actualización. Eso es exactamente lo que buscamos.'}</p></div></div>
}

function BlockerModal({ selected, setSelected, close, onAction }: { selected: Blocker | null; setSelected: (b: Blocker) => void; close: () => void; onAction: () => void }) {
  const choices: { id: Blocker; label: string; note: string }[] = [
    { id: 'terms', label: 'No entiendo los términos', note: 'Prior, likelihood, posterior…' },
    { id: 'formula', label: 'Entiendo la idea, no la fórmula', note: 'Los símbolos me desconectan.' },
    { id: 'use', label: 'No sé cuándo usarlo', note: 'No reconozco un problema de Bayes.' },
    { id: 'prereq', label: 'Siento que me falta algo anterior', note: 'Probabilidad condicional u otra base.' },
  ]
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}><button className="modal-close" onClick={close}><X size={18} /></button><span className="tiny-label">CAMBIEMOS DE ESTRATEGIA</span><h2>¿Qué parte no está haciendo clic?</h2><p className="modal-intro">No voy a repetirte lo mismo con otras palabras. Elige el bloqueo.</p><div className="blocker-options">{choices.map(c => <button key={c.id} className={selected === c.id ? 'selected' : ''} onClick={() => setSelected(c.id)}><CircleHelp size={18} /><div><strong>{c.label}</strong><span>{c.note}</span></div><ChevronRight size={16} /></button>)}</div>{selected && <div className="blocker-response"><Lightbulb size={18} /><div><strong>{blockers[selected].title}</strong><p>{blockers[selected].body}</p><button onClick={onAction}>{blockers[selected].action} <ArrowRight size={14} /></button></div></div>}</div></div>
}

function PracticeView({ setView, learningMemory, materials, onReview }: { setView: (v: View) => void; learningMemory: LearningMemory; materials: StudyMaterial[]; onReview: (materialId: string, concept: string) => void }) {
  const due = dueReviews(learningMemory)
  const fragile = fragileConcepts(learningMemory)
  const records = getMemoryRecords(learningMemory)
  const queue = due.length ? due : [...fragile, ...records.filter(record => !fragile.some(item => item.id === record.id))].slice(0, 5)
  const existingQueue = queue.filter(record => materials.some(material => material.id === record.materialId))

  return <div className="page review-page">
    <section className="generic-hero review-hero">
      <span className="tiny-label">COMPRENDE 2.0.7 · REPASO INTELIGENTE</span>
      <h1>No repases todo. <span>Recupera lo que empieza a enfriarse.</span></h1>
      <p>Comprende programa el siguiente contacto usando lo que hiciste en práctica y en “Explícamelo tú”. Un fallo acorta el intervalo; una recuperación sólida lo alarga.</p>
    </section>

    <div className="review-summary-grid">
      <div><strong>{due.length}</strong><span>para hoy</span><small>ya vencieron o toca recuperarlos</small></div>
      <div><strong>{fragile.length}</strong><span>frágiles</span><small>dominio bajo o varios tropiezos</small></div>
      <div><strong>{solidConcepts(learningMemory).length}</strong><span>sólidos</span><small>pueden esperar más antes del siguiente repaso</small></div>
      <div><strong>{records.length}</strong><span>con memoria</span><small>conceptos con evidencia real registrada</small></div>
    </div>

    <section className="review-queue-section">
      <div className="section-heading"><div><span className="tiny-label">COLA DE HOY</span><h2>{due.length ? 'Empieza por estos conceptos' : records.length ? 'No tienes repasos vencidos' : 'Todavía no hay evidencia suficiente'}</h2></div><p>{due.length ? 'Están ordenados por urgencia. Con una sesión corta basta; no necesitas releer el PDF entero.' : records.length ? 'Te muestro los conceptos más frágiles o próximos para que puedas adelantarte si quieres.' : 'Completa una práctica o una explicación final dentro de un concepto del PDF.'}</p></div>
      {existingQueue.length ? <div className="review-queue-list">{existingQueue.map((record, index) => {
        const status = memoryStatus(record)
        return <article key={record.id}>
          <div className="review-rank">{index + 1}</div>
          <div className="review-queue-copy"><div className="review-title-line"><strong>{record.concept}</strong><span className={`memory-status ${status}`}>{memoryLabel(record)}</span></div><p>{record.materialName}</p><div className="review-evidence"><span>Dominio <b>{record.mastery}%</b></span><span>Racha <b>{record.streak}</b></span><span>Siguiente <b>{formatReviewDate(record.nextReviewAt)}</b></span></div></div>
          <button className="primary-button" onClick={() => onReview(record.materialId, record.concept)}>Repasar ahora <ArrowRight size={14} /></button>
        </article>
      })}</div> : <div className="review-empty"><BrainCircuit size={28} /><h3>{materials.length ? 'Estudia un concepto y volveré a encontrarlo cuando toque.' : 'Primero sube un material.'}</h3><p>La memoria no aumenta por abrir pantallas. Necesita práctica o recuperación activa para tener evidencia.</p><button className="secondary-button" onClick={() => setView('materials')}>{materials.length ? 'Ir a mis materiales' : 'Subir material'} <ArrowRight size={14} /></button></div>}
    </section>

    <section className="memory-method-section">
      <div className="section-heading"><div><span className="tiny-label">CÓMO DECIDE COMPRENDE</span><h2>Menos repetición, más recuperación</h2></div></div>
      <div className="memory-method-grid">
        <div><span>1</span><strong>Observa evidencia</strong><p>Registra aciertos en práctica y la calidad de tu explicación con tus palabras.</p></div>
        <div><span>2</span><strong>Ajusta el intervalo</strong><p>Si fallas, el concepto vuelve pronto. Si lo recuperas bien varias veces, espera más días.</p></div>
        <div><span>3</span><strong>Prioriza fragilidad</strong><p>Un concepto con bajo dominio o lapsos repetidos aparece antes aunque ya lo hayas “completado”.</p></div>
      </div>
    </section>
  </div>
}

function ProgressView({ mastery, completedSteps, startSession, learningMemory, onReview }: { mastery: number; completedSteps: StepId[]; startSession: () => void; learningMemory: LearningMemory; onReview: (materialId: string, concept: string) => void }) {
  const records = getMemoryRecords(learningMemory)
  const due = dueReviews(learningMemory)
  const fragile = fragileConcepts(learningMemory)
  const solid = solidConcepts(learningMemory)
  const average = records.length ? Math.round(records.reduce((sum, item) => sum + item.mastery, 0) / records.length) : 0

  return <div className="page memory-progress-page">
    <section className="generic-hero">
      <span className="tiny-label">COMPRENDE 2.0.7 · MEMORIA Y DOMINIO</span>
      <h1>Lo importante no es haberlo visto. <span>Es poder recuperarlo después.</span></h1>
      <p>Este tablero usa evidencia de práctica y active recall. El porcentaje ya no representa páginas abiertas, sino señales de que puedes usar y explicar el concepto.</p>
    </section>

    <div className="memory-dashboard-grid">
      <div className="memory-dashboard-main"><span>DOMINIO MEDIO</span><strong>{average}%</strong><p>{records.length ? `Calculado con ${records.length} conceptos que ya tienen evidencia.` : 'Aún no hay conceptos medidos desde tus materiales.'}</p></div>
      <div><strong>{due.length}</strong><span>Repasar hoy</span></div>
      <div><strong>{fragile.length}</strong><span>Frágiles</span></div>
      <div><strong>{solid.length}</strong><span>Sólidos</span></div>
    </div>

    <section className="memory-concepts-section">
      <div className="section-heading"><div><span className="tiny-label">MEMORIA POR CONCEPTO</span><h2>Qué está sólido y qué se está enfriando</h2></div><p>La fecha de repaso cambia automáticamente después de cada evidencia nueva.</p></div>
      {records.length ? <div className="memory-concept-list">{records.map(record => {
        const status = memoryStatus(record)
        const accuracy = record.practiceAccuracy == null ? '—' : `${Math.round(record.practiceAccuracy * 100)}%`
        const recall = record.teachBackScore == null ? '—' : `${record.teachBackScore}%`
        return <article key={record.id}>
          <div className="memory-concept-head"><div><strong>{record.concept}</strong><span>{record.materialName}</span></div><span className={`memory-status ${status}`}>{memoryLabel(record)}</span></div>
          <div className="memory-bar"><span style={{ width: `${record.mastery}%` }} /></div>
          <div className="memory-metrics"><span><b>{record.mastery}%</b> dominio</span><span><b>{accuracy}</b> práctica</span><span><b>{recall}</b> explicación</span><span><b>{record.attempts}</b> evidencias</span><span><b>{record.streak}</b> racha</span></div>
          <div className="memory-card-footer"><span>Siguiente repaso: <b>{formatReviewDate(record.nextReviewAt)}</b> · intervalo {record.intervalDays} día{record.intervalDays === 1 ? '' : 's'}</span><button className="text-button" onClick={() => onReview(record.materialId, record.concept)}>{status === 'due' ? 'Repasar ahora' : 'Abrir concepto'} <ArrowRight size={13} /></button></div>
        </article>
      })}</div> : <div className="review-empty"><Gauge size={28} /><h3>Tu tablero se llenará con evidencia, no con clics.</h3><p>Entra a cualquier concepto de tus materiales, completa la práctica adaptativa o “Explícamelo tú” y volverás aquí con una medición real.</p></div>}
    </section>

    <section className="legacy-memory-card"><div><span className="tiny-label">DEMO ORIGINAL DE BAYES</span><h3>{mastery}% de recorrido guardado</h3><p>Conservo el avance de la sesión inicial para no romper tus pruebas anteriores. A partir de tus PDFs, el sistema nuevo usa memoria por concepto.</p></div><button className="secondary-button" onClick={startSession}>Abrir demo <ArrowRight size={14} /></button></section>
  </div>
}


function MaterialsView({
  materials,
  onAddMaterial,
  onDeleteMaterial,
  learningMemory,
  onStudy,
  onMap,
}: {
  materials: StudyMaterial[]
  onAddMaterial: (material: StudyMaterial, file: File) => Promise<StudyMaterial>
  onDeleteMaterial: (material: StudyMaterial) => Promise<void>
  learningMemory: LearningMemory
  onStudy: (id: string, concept: string) => void
  onMap: (id: string) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [processingLabel, setProcessingLabel] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es-MX')
    if (!q) return materials
    return materials.filter(m =>
      m.name.toLocaleLowerCase('es-MX').includes(q) ||
      m.concepts.some(c => c.label.toLocaleLowerCase('es-MX').includes(q)),
    )
  }, [materials, query])

  const addFile = async (file?: File) => {
    if (!file) return
    setError('')
    setLoading(true)
    setProcessingLabel('Extrayendo texto y conservando referencias por página…')
    try {
      const raw = await readStudyFile(file)
      setProcessingLabel('Construyendo mapa conceptual preliminar…')
      const local = buildLocalSemanticAnalysis(raw)
      const provisional: StudyMaterial = { ...raw, semantic: local }
      setProcessingLabel('Analizando relaciones, prerrequisitos y laboratorios recomendados…')
      const semantic = await analyzeMaterialSemantically(provisional)
      setProcessingLabel('Asignando laboratorios interactivos automáticamente…')
      const semanticConcepts = conceptsFromSemantic(semantic)
      const material: StudyMaterial = {
        ...provisional,
        semantic,
        concepts: semanticConcepts.length ? semanticConcepts : raw.concepts,
      }
      await onAddMaterial(material, file)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pude procesar el archivo.')
    } finally {
      setLoading(false)
      setProcessingLabel('')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const engineLabel = (material: StudyMaterial) => {
    if (material.semantic?.engine === 'hybrid') return 'BGE-M3 + IA'
    if (material.semantic?.engine === 'openai') return 'IA semántica'
    return 'Mapa local'
  }

  return (
    <div className="page materials-page">
      <section className="generic-hero materials-hero">
        <div className="eyebrow"><BrainCircuit size={16} /> COMPRENDE 2.0 · UNIVERSAL LEARNING ENGINE</div>
        <h1>Convierte cada documento en una <span>ruta para aprender</span>.</h1>
        <p>Sube tu PDF y sigue estudiando: Comprende detecta conceptos, dependencias y decide automáticamente qué laboratorios interactivos necesita cada tema. No tienes que configurar nada por documento.</p>
      </section>

      <div
        className={dragging ? 'upload-zone dragging' : 'upload-zone'}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFile(e.dataTransfer.files?.[0]) }}
        onClick={() => !loading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf,.txt,.md,text/plain,text/markdown"
          hidden
          onChange={e => addFile(e.target.files?.[0])}
        />
        <div className="upload-icon">{loading ? <Sparkles size={27} /> : <UploadCloud size={27} />}</div>
        <div>
          <strong>{loading ? 'Analizando tu documento…' : 'Suelta aquí tu PDF, TXT o MD'}</strong>
          <span>{loading ? processingLabel : 'PDF.js extrae el texto; el motor semántico decide qué vale la pena aprender.'}</span>
        </div>
        {!loading && <button type="button" className="secondary-button"><Plus size={15} /> Elegir archivo</button>}
      </div>
      {error && <div className="material-error"><CircleHelp size={16} /><span>{error}</span></div>}

      <section className="semantic-pipeline">
        <div><FileText size={17} /><span><b>1. Texto</b><small>páginas conservadas</small></span></div>
        <ChevronRight size={15} />
        <div><Layers3 size={17} /><span><b>2. Chunks</b><small>contexto, no palabras sueltas</small></span></div>
        <ChevronRight size={15} />
        <div><Network size={17} /><span><b>3. BGE-M3</b><small>agrupación semántica opcional</small></span></div>
        <ChevronRight size={15} />
        <div><Sparkles size={17} /><span><b>4. IA</b><small>depura jerarquía y prerrequisitos</small></span></div>
        <ChevronRight size={15} />
        <div><Route size={17} /><span><b>5. Ruta</b><small>orden original del documento</small></span></div>
      </section>

      <div className="materials-toolbar">
        <div>
          <span className="tiny-label">BIBLIOTECA EN LA NUBE</span>
          <h3>{materials.length ? `${materials.length} material${materials.length === 1 ? '' : 'es'}` : 'Aún no hay materiales'}</h3>
        </div>
        {materials.length > 0 && (
          <label className="search-box"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar documento o concepto…" /></label>
        )}
      </div>

      {materials.length === 0 ? (
        <section className="empty-materials">
          <Network size={30} />
          <h3>Sube un documento real y mira su estructura</h3>
          <p>Sin claves externas recibirás un mapa local funcional. Con <b>HF_TOKEN</b> + <b>OPENAI_API_KEY</b>, Comprende usa embeddings semánticos y después una IA depura la jerarquía pedagógica.</p>
        </section>
      ) : (
        <div className="materials-list">
          {visible.map(material => {
            const semantic = material.semantic || buildLocalSemanticAnalysis(material)
            const normalizedSemantic = normalizeSemanticAnalysis(semantic)
            const previewConcepts = [
              ...normalizedSemantic.learningOrder.map(label => normalizedSemantic.concepts.find(concept => concept.label === label)).filter(Boolean),
              ...sortConceptsByDocumentOrder(normalizedSemantic.concepts.filter(concept => !normalizedSemantic.learningOrder.includes(concept.label)), normalizedSemantic.learningOrder),
            ].filter(Boolean) as SemanticConcept[]
            const firstDocumentConcept = normalizedSemantic.learningOrder[0] || previewConcepts[0]?.label || material.concepts[0]?.label || ''
            const completedCount = normalizedSemantic.learningOrder.filter(label => lessonIsCompleted(conceptRecord(learningMemory, material.id, label))).length
            return (
              <article className="material-card semantic-card" key={material.id}>
                <div className="material-card-head">
                  <div className="file-badge"><FileText size={18} /></div>
                  <div>
                    <strong>{material.name}</strong>
                    <span>{material.kind.toUpperCase()} · {material.pages ? `${material.pages} páginas · ` : ''}{Math.round(material.text.length / 1000)}k caracteres</span>
                    <small className="material-subject-v10">Materia: {subjectFor(material)}</small>
                  </div>
                  <button className="icon-button danger" title="Eliminar" onClick={() => { void onDeleteMaterial(material) }}><Trash2 size={15} /></button>
                </div>

                <div className="semantic-summary-row">
                  <span className={semantic.engine === 'hybrid' ? 'semantic-engine hybrid' : semantic.engine === 'openai' ? 'semantic-engine ai' : 'semantic-engine'}><Sparkles size={12} /> {engineLabel(material)}</span>
                  <span><b>{semantic.concepts.length}</b> conceptos</span>
                  <span><b>{semantic.relations.length}</b> relaciones</span>
                  <span><b>{semantic.chunksAnalyzed}</b> chunks</span>
                  <span><b>{availableLabs(normalizedSemantic.concepts).length}</b> auto-labs</span>
                  <span className={completedCount ? 'material-completed-summary' : ''}><b>{completedCount}/{normalizedSemantic.learningOrder.length || 0}</b> completadas</span>
                </div>

                <div className="concept-cloud semantic-cloud">
                  {previewConcepts.slice(0, 10).map((concept, index) => {
                    const record = conceptRecord(learningMemory, material.id, concept.label)
                    const completed = lessonIsCompleted(record)
                    return (
                      <button className={completed ? 'completed' : ''} key={concept.label} onClick={() => onStudy(material.id, concept.label)}>
                        <span>{completed && <Check size={12} />} {index + 1}. {concept.label}</span><em>{completed ? `${lessonCompletionScore(record)}%` : concept.pages?.[0] ? `p.${concept.pages[0]}` : concept.importance}</em>
                      </button>
                    )
                  })}
                </div>
                {semantic.engine === 'local' && semantic.warnings?.[0] && (
                  <div className="semantic-inline-warning" title={semantic.warnings[0]}>
                    <CircleHelp size={14} /> <span>{semantic.warnings[0]}</span>
                  </div>
                )}
                <div className="material-card-foot semantic-foot">
                  <span>{semantic.documentSummary}</span>
                  <div>
                    <button className="secondary-button compact-button" onClick={() => onMap(material.id)}><Network size={14} /> Ver mapa</button>
                    <button className="text-button" onClick={() => onStudy(material.id, firstDocumentConcept)}>Estudiar desde el inicio <ArrowRight size={14} /></button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MaterialMapView({
  material,
  learningMemory,
  onBack,
  onStudy,
  onUpdate,
}: {
  material: StudyMaterial | null
  learningMemory: LearningMemory
  onBack: () => void
  onStudy: (concept: string) => void
  onUpdate: (material: StudyMaterial) => void
}) {
  const [filter, setFilter] = useState<'all' | 'foundation' | 'principal' | 'subconcept' | 'application'>('all')
  const [reanalyzing, setReanalyzing] = useState(false)
  const [selectedMapConcept, setSelectedMapConcept] = useState('')

  if (!material) return <div className="page"><section className="empty-materials"><h3>Ya no encuentro este material.</h3><button className="primary-button" onClick={onBack}>Volver</button></section></div>
  const semantic = normalizeSemanticAnalysis(material.semantic || buildLocalSemanticAnalysis(material))
  const concepts = filter === 'all' ? semantic.concepts : semantic.concepts.filter(concept => concept.category === filter)
  const essential = semantic.concepts.filter(concept => concept.tier === 'essential')
  const labs = availableLabs(semantic.concepts)
  const specializedLabs = labs.filter(item => item.recommendation?.engine === 'specialized').length
  const composedLabs = labs.filter(item => item.recommendation?.engine === 'composed' || item.lab.type === 'generic').length
  const roots = essential.filter(concept => !concept.parent || !semantic.concepts.some(item => item.label === concept.parent)).slice(0, 8)
  const selected = semantic.concepts.find(concept => concept.label === selectedMapConcept) || null
  const selectedChildren = selected ? semantic.concepts.filter(concept => concept.parent === selected.label) : []
  const selectedPrerequisites = selected ? selected.prerequisites.map(label => semantic.concepts.find(concept => concept.label === label)).filter(Boolean) : []
  const selectedDependents = selected ? semantic.concepts.filter(concept => concept.prerequisites.includes(selected.label)) : []
  const selectedRelated = selected ? selected.related.map(label => semantic.concepts.find(concept => concept.label === label)).filter(Boolean) : []

  const reanalyze = async () => {
    setReanalyzing(true)
    const analysis = await analyzeMaterialSemantically({ ...material, semantic: buildLocalSemanticAnalysis(material) }, true)
    const next = { ...material, semantic: analysis, concepts: conceptsFromSemantic(analysis) }
    onUpdate(next)
    setSelectedMapConcept('')
    setReanalyzing(false)
  }

  const categoryLabel: Record<string, string> = {
    foundation: 'Base previa', principal: 'Principal', subconcept: 'Subconcepto', application: 'Aplicación',
  }

  const openSubmap = (label: string) => {
    setSelectedMapConcept(label)
    window.setTimeout(() => document.getElementById('concept-submap')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 10)
  }

  return (
    <div className="page material-map-page">
      <button className="text-button study-back" onClick={onBack}><ArrowLeft size={15} /> Mis materiales</button>

      <section className="map-hero">
        <div>
          <div className="eyebrow"><Network size={16} /> MAPA DEL DOCUMENTO · MOTOR HÍBRIDO</div>
          <h1>{material.name}</h1>
          <p>{semantic.documentSummary}</p>
          <div className="session-facts">
            <span>{semantic.concepts.length} conceptos detectados</span><span>{essential.length} esenciales</span><span>{semantic.concepts.filter(c => c.tier === 'deep').length} de profundidad</span><span>{semantic.chunksAnalyzed} chunks</span>
          </div>
        </div>
        <div className="map-engine-card">
          <span className={semantic.engine === 'hybrid' ? 'semantic-engine hybrid' : semantic.engine === 'openai' ? 'semantic-engine ai' : 'semantic-engine'}><Sparkles size={12} /> {semantic.engine === 'hybrid' ? 'Motor híbrido' : semantic.engine === 'openai' ? 'IA semántica' : 'Motor local'}</span>
          <strong>{semantic.model}</strong>
          <small>{semantic.engine === 'hybrid' ? 'Embeddings para agrupar + IA para auditar cobertura, jerarquía, dependencias y decidir entre Labs especializados, Labs componibles o ninguna simulación.' : semantic.engine === 'openai' ? 'La IA organizó el documento y planificó automáticamente la experiencia interactiva más útil para cada concepto.' : 'Puedes enriquecer este mapa configurando HF_TOKEN y OPENAI_API_KEY.'}</small>
          <button className="secondary-button" onClick={reanalyze} disabled={reanalyzing}><RefreshCw size={14} /> {reanalyzing ? 'Analizando…' : 'Reanalizar mapa'}</button>
        </div>
      </section>

      <div className="map-stats-grid">
        <article><BookOpen size={19} /><strong>{semantic.concepts.filter(c => c.category === 'foundation' && c.tier === 'essential').length}</strong><span>bases esenciales</span></article>
        <article><Target size={19} /><strong>{semantic.concepts.filter(c => c.category === 'principal' && c.tier === 'essential').length}</strong><span>ideas troncales</span></article>
        <article><Layers3 size={19} /><strong>{semantic.concepts.filter(c => c.tier === 'deep').length}</strong><span>detalles profundos</span></article>
        <article><Route size={19} /><strong>{semantic.learningOrder.length}</strong><span>temas en orden</span></article>
        <article><FlaskConical size={19} /><strong>{labs.length}</strong><span>labs automáticos</span></article>
      </div>

      <div className="auto-lab-explainer"><FlaskConical size={17}/><span><b>Universal Auto-Lab:</b> Comprende decidió automáticamente qué conceptos necesitan interacción. Asignó {labs.length} lab{labs.length === 1 ? '' : 's'}: {specializedLabs} especializado{specializedLabs === 1 ? '' : 's'} y {composedLabs} componible{composedLabs === 1 ? '' : 's'}. Si un tema futuro no tiene motor dedicado, puede componer uno con bloques seguros sin pedirte configuración.</span></div>

      {semantic.warnings.length > 0 && <div className="semantic-warning"><CircleHelp size={16} /><div>{semantic.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</div></div>}

      <section className="knowledge-tree-section">
        <div className="section-heading"><div><span className="tiny-label">ESTRUCTURA ESENCIAL</span><h2>Cómo se organiza el tema</h2></div><p>Este primer nivel mantiene el mapa limpio. Abre una idea para ver prerrequisitos, componentes internos y conexiones sin llenar la pantalla de tarjetas.</p></div>
        <div className="knowledge-tree">
          {roots.map(root => {
            const children = semantic.concepts.filter(c => c.parent === root.label).slice(0, 6)
            return <article className={selectedMapConcept === root.label ? 'tree-root selected' : 'tree-root'} key={root.label}>
              <button onClick={() => openSubmap(root.label)}><span>{categoryLabel[root.category]}</span><strong>{root.label}</strong><p>{root.description}</p><small className="tree-open-hint">Abrir submapa <ArrowRight size={13} /></small></button>
              {children.length > 0 && <div className="tree-children">{children.map(child => <button key={child.label} onClick={() => openSubmap(child.label)}><ChevronRight size={14} /><span>{child.label}</span><em>{child.tier === 'deep' ? 'Detalle' : 'Esencial'}</em></button>)}</div>}
            </article>
          })}
        </div>
      </section>

      {selected && <section className="concept-submap-section" id="concept-submap">
        <div className="section-heading"><div><span className="tiny-label">MAPA PROFUNDO</span><h2>{selected.label}</h2></div><button className="text-button" onClick={() => setSelectedMapConcept('')}><X size={14} /> Cerrar</button></div>
        <div className="submap-question"><BrainCircuit size={18} /><div><strong>Pregunta para saber si de verdad lo entendiste</strong><p>{selected.studyQuestion}</p></div></div>
        <div className="concept-submap-grid">
          <article className="submap-column prerequisite-column">
            <span>ANTES</span><h3>Qué necesitas dominar</h3>
            {selectedPrerequisites.length ? selectedPrerequisites.map(item => item && <button key={item.label} onClick={() => openSubmap(item.label)}><strong>{item.label}</strong><small>{item.description}</small></button>) : <p>No tiene un prerrequisito explícito dentro de este documento.</p>}
          </article>
          <article className="submap-center">
            <span className={`concept-category ${selected.category}`}>{categoryLabel[selected.category]}</span>
            <small className={selected.tier === 'deep' ? 'tier-badge deep' : 'tier-badge'}>{selected.tier === 'deep' ? 'Profundidad' : 'Esencial'}</small>
            <h3>{selected.label}</h3><p>{selected.description}</p>
            {lessonIsCompleted(conceptRecord(learningMemory, material.id, selected.label)) && <div className="lesson-completed-pill"><Check size={14} /> Completada · {lessonCompletionScore(conceptRecord(learningMemory, material.id, selected.label))}%</div>}
            {selected.pages.length > 0 && <div className="submap-pages">Aparece en páginas {selected.pages.join(', ')}</div>}
            {getLabDefinition(selected.label, selected.lab) && <div className="lab-available-badge"><FlaskConical size={14} /><span>{selected.lab?.engine === 'composed' || selected.lab?.labType === 'generic' ? 'Auto-Lab componible' : 'Laboratorio especializado'}</span></div>}
            {selected.lab?.recommended && <div className="auto-lab-explainer"><Sparkles size={15}/><span><b>{getLabDefinition(selected.label, selected.lab)?.shortTitle}</b> · {selected.lab.reason}<span className="auto-lab-confidence">Confianza {selected.lab.confidence}%</span></span></div>}
            <button className="primary-button" onClick={() => onStudy(selected.label)}>{getLabDefinition(selected.label, selected.lab) ? 'Estudiar + abrir laboratorio' : 'Estudiar este concepto'} <ArrowRight size={15} /></button>
          </article>
          <article className="submap-column">
            <span>DESPUÉS / DENTRO</span><h3>Qué se abre desde aquí</h3>
            {selectedChildren.length > 0 && <div className="submap-group"><b>Componentes internos</b>{selectedChildren.map(item => <button key={item.label} onClick={() => openSubmap(item.label)}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div>}
            {selectedDependents.length > 0 && <div className="submap-group"><b>Conceptos que dependen de esto</b>{selectedDependents.slice(0, 5).map(item => <button key={item.label} onClick={() => openSubmap(item.label)}><strong>{item.label}</strong><small>{categoryLabel[item.category]}</small></button>)}</div>}
            {!selectedChildren.length && !selectedDependents.length && selectedRelated.length > 0 && <div className="submap-group"><b>Conecta con</b>{selectedRelated.slice(0, 5).map(item => item && <button key={item.label} onClick={() => openSubmap(item.label)}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div>}
            {!selectedChildren.length && !selectedDependents.length && !selectedRelated.length && <p>Este concepto cierra una rama del mapa.</p>}
          </article>
        </div>
      </section>}

      <section className="learning-route-section">
        <div className="section-heading"><div><span className="tiny-label">ORDEN DEL DOCUMENTO</span><h2>Estúdialo en el orden original</h2></div><p>La secuencia respeta el orden en que el PDF desarrolla los temas. Los prerrequisitos se muestran como apoyo, pero nunca adelantan ni mueven un tema.</p></div>
        <div className="learning-route-list">
          {semantic.learningOrder.map((label, index) => {
            const item = semantic.concepts.find(c => c.label === label)
            if (!item) return null
            const lab = getLabDefinition(label, item.lab)
            const record = conceptRecord(learningMemory, material.id, label)
            const completed = lessonIsCompleted(record)
            return <button className={completed ? 'completed' : ''} key={label} onClick={() => onStudy(label)}><span className="route-number">{completed ? <Check size={15} /> : index + 1}</span><div><strong>{label}{lab && <em className="route-lab-tag auto"><FlaskConical size={12}/> {item.lab?.engine === 'composed' || item.lab?.labType === 'generic' ? 'Auto-Lab' : 'Lab'}</em>}</strong><small>{completed ? `Completada · ${lessonCompletionScore(record)}%` : `${categoryLabel[item.category]}${item.prerequisites.length ? ` · requiere: ${item.prerequisites.join(', ')}` : ''}`}</small></div>{completed ? <span className="route-completed-badge">Lista</span> : <ArrowRight size={16} />}</button>
          })}
        </div>
      </section>

      <section className="concept-catalog-section">
        <div className="section-heading"><div><span className="tiny-label">CATÁLOGO SEMÁNTICO</span><h2>Conceptos detectados</h2></div><p>Incluye tanto la ruta esencial como los detalles profundos que el motor encontró en secciones, glosarios, fórmulas y componentes.</p></div>
        <div className="map-filters">
          {([['all','Todos'],['foundation','Bases'],['principal','Principales'],['subconcept','Subconceptos'],['application','Aplicaciones']] as const).map(([id, label]) => <button className={filter === id ? 'active' : ''} key={id} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
        <div className="semantic-concept-grid">
          {concepts.map(concept => {
            const record = conceptRecord(learningMemory, material.id, concept.label)
            const completed = lessonIsCompleted(record)
            return <article className={completed ? 'semantic-concept-card completed' : 'semantic-concept-card'} key={concept.label}>
            <div className="concept-card-top"><div><span className={`concept-category ${concept.category}`}>{categoryLabel[concept.category]}</span><span className={concept.tier === 'deep' ? 'tier-badge deep' : 'tier-badge'}>{concept.tier === 'deep' ? 'Profundidad' : 'Esencial'}</span>{completed && <span className="concept-completed-badge"><Check size={12}/> Completada</span>}</div><em>{completed ? `${lessonCompletionScore(record)}%` : `${concept.importance}%`}</em></div>
            <h3>{concept.label}</h3>
            {getLabDefinition(concept.label, concept.lab) && <div className="catalog-lab-pill"><FlaskConical size={13}/>{concept.lab?.engine === 'composed' || concept.lab?.labType === 'generic' ? ' Auto-Lab componible' : ' Lab especializado'}</div>}
            {concept.lab?.recommended && <div className="catalog-lab-reason">{concept.lab.reason} · confianza {concept.lab.confidence}%</div>}
            <p>{concept.description}</p>
            {concept.pages.length > 0 && <small className="page-references">Páginas: {concept.pages.join(', ')}</small>}
            {concept.related.length > 0 && <div className="related-tags">{concept.related.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div>}
            <div className="concept-card-actions"><button className="secondary-button compact-button" onClick={() => openSubmap(concept.label)}><Network size={14} /> Ver submapa</button><button className="text-button" onClick={() => onStudy(concept.label)}>{completed ? 'Repasar' : 'Estudiar'} <ArrowRight size={14} /></button></div>
          </article>
          })}
        </div>
      </section>

      {semantic.relations.length > 0 && <section className="relations-section">
        <div className="section-heading"><div><span className="tiny-label">RELACIONES</span><h2>Qué conecta con qué</h2></div></div>
        <div className="relations-list">{semantic.relations.slice(0, 24).map((relation, i) => <div key={`${relation.source}-${relation.target}-${i}`}><strong>{relation.source}</strong><span>{relation.type === 'requires' ? 'requiere' : relation.type === 'part_of' ? 'contiene / agrupa' : relation.type === 'applies_to' ? 'se aplica a' : 'se relaciona con'}</span><strong>{relation.target}</strong></div>)}</div>
      </section>}
    </div>
  )
}


function PrerequisiteGate({
  material,
  concept,
  onContinue,
  onStudyPrerequisite,
}: {
  material: StudyMaterial
  concept: string
  onContinue: () => void
  onStudyPrerequisite: (concept: string) => void
}) {
  const semantic = normalizeSemanticAnalysis(material.semantic || buildLocalSemanticAnalysis(material))
  const current = semantic.concepts.find(item => item.label === concept)
  const currentOrderIndex = semantic.learningOrder.indexOf(concept)
  const currentPrimaryPage = current?.pages?.[0] ?? Number.POSITIVE_INFINITY
  const prerequisites = (current?.prerequisites || [])
    .map(label => semantic.concepts.find(item => item.label === label))
    .filter(Boolean)
    .filter(item => {
      if (!item) return false
      const prerequisiteOrderIndex = semantic.learningOrder.indexOf(item.label)
      if (currentOrderIndex >= 0 && prerequisiteOrderIndex >= 0) return prerequisiteOrderIndex < currentOrderIndex
      const prerequisitePage = item.pages?.[0] ?? Number.POSITIVE_INFINITY
      return prerequisitePage < currentPrimaryPage
    })
  const storageKey = `comprende-prerequisite-mastery:${material.id}`
  const [mastered, setMastered] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} }
  })
  const [expanded, setExpanded] = useState('')
  const [loading, setLoading] = useState('')
  const [lessons, setLessons] = useState<Record<string, StudySession['intuition']>>({})
  const [sources, setSources] = useState<Record<string, 'local' | 'ai'>>({})

  useEffect(() => {
    try { setMastered(JSON.parse(localStorage.getItem(storageKey) || '{}')) } catch { setMastered({}) }
    setExpanded('')
    setLessons({})
    setSources({})
  }, [storageKey, concept])

  if (!current || prerequisites.length === 0) return null

  const persistMastery = (label: string, value: boolean) => {
    const next = { ...mastered, [label]: value }
    setMastered(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const openMicroLesson = async (label: string) => {
    if (expanded === label) { setExpanded(''); return }
    setExpanded(label)
    if (lessons[label]) return
    const fallback = buildLocalStudySession(material, label).intuition
    setLessons(previous => ({ ...previous, [label]: fallback }))
    setSources(previous => ({ ...previous, [label]: 'local' }))
    setLoading(label)
    const result = await explainConceptWithAI(material, label, 'simpler')
    setLessons(previous => ({ ...previous, [label]: result.explanation }))
    setSources(previous => ({ ...previous, [label]: result.source }))
    setLoading('')
  }

  const masteredCount = prerequisites.filter(item => item && mastered[item.label]).length

  return <section className="prerequisite-gate">
    <div className="prerequisite-gate-head">
      <div><span className="tiny-label">REPASO OPCIONAL · SIN CAMBIAR EL ORDEN</span><h2>Ideas anteriores que pueden ayudarte con {concept}</h2><p>Comprende mantiene el orden del PDF. Aquí solo aparecen conceptos que el documento ya presentó antes; puedes repasarlos 3 minutos sin saltar a un tema posterior.</p></div>
      <div className="prerequisite-progress"><strong>{masteredCount}/{prerequisites.length}</strong><span>listos</span></div>
    </div>
    <div className="prerequisite-list">
      {prerequisites.map(item => item && <article className={mastered[item.label] ? 'mastered' : ''} key={item.label}>
        <div className="prerequisite-row">
          <div className="prerequisite-copy"><span className="prerequisite-status">{mastered[item.label] ? <Check size={14} /> : <CircleHelp size={14} />}</span><div><strong>{item.label}</strong><p>{item.description}</p></div></div>
          <div className="prerequisite-actions"><button className="secondary-button" onClick={() => openMicroLesson(item.label)}><BookOpen size={14} /> {expanded === item.label ? 'Cerrar repaso' : 'Repaso 3 min'}</button><button className={mastered[item.label] ? 'mastery-button active' : 'mastery-button'} onClick={() => persistMastery(item.label, !mastered[item.label])}>{mastered[item.label] ? 'Dominado' : 'Ya lo domino'}</button></div>
        </div>
        {expanded === item.label && <div className="micro-prerequisite-lesson">
          <div className="micro-prereq-meta"><span>{loading === item.label ? 'Generando explicación…' : sources[item.label] === 'ai' ? 'Explicación IA' : 'Repaso local'}</span><button className="text-button" onClick={() => onStudyPrerequisite(item.label)}>Estudiarlo a fondo <ArrowRight size={14} /></button></div>
          <div className="micro-prereq-grid">
            <div><b>Qué es</b><p>{lessons[item.label]?.summary || item.description}</p></div>
            <div><b>Para qué te sirve aquí</b><p>{lessons[item.label]?.purpose || `Te prepara para entender ${concept} sin saltos.`}</p></div>
            <div><b>Ejemplo</b><p>{lessons[item.label]?.example || item.evidence?.[0] || 'Busca un ejemplo concreto en el documento antes de continuar.'}</p></div>
            <div className="micro-prereq-check"><b>Compruébalo</b><p>¿Podrías explicar con tus palabras qué es {item.label} y por qué {concept} depende de ello?</p></div>
          </div>
        </div>}
      </article>)}
    </div>
    <div className="prerequisite-gate-footer"><span>Esto es solo un recordatorio: tu siguiente tema sigue siendo el que marca el documento.</span><button className="primary-button" onClick={onContinue}>Continuar con {concept} <ArrowRight size={15} /></button></div>
  </section>
}

function MaterialStudyView({ material, initialConcept, onBack, onMemoryEvent, learningMemory, userId }: { material: StudyMaterial | null; initialConcept: string; onBack: () => void; onMemoryEvent: (event: MemoryEvent) => void; learningMemory: LearningMemory; userId: string }) {
  const initialSemantic = material ? normalizeSemanticAnalysis(material.semantic || buildLocalSemanticAnalysis(material)) : null
  const initialStudyConcept = initialConcept || initialSemantic?.learningOrder[0] || material?.concepts[0]?.label || '' 
  const initialCachedSessionEntry = material && initialStudyConcept ? getCachedSessionEntry(material, initialStudyConcept) : null
  const initialCachedSession = initialCachedSessionEntry?.payload || null
  const initialCachedExplanationEntry = material && initialStudyConcept ? getCachedExplanationEntry(material, initialStudyConcept) : null
  const initialCachedExplanation = initialCachedExplanationEntry?.payload || null
  const [concept, setConcept] = useState(initialStudyConcept)
  const [phase, setPhase] = useState(0)
  const [session, setSession] = useState<StudySession | null>(() => {
    if (!material || !initialStudyConcept) return null
    const base = initialCachedSession || buildLocalStudySession(material, initialStudyConcept)
    return initialCachedExplanation ? { ...base, intuition: initialCachedExplanation } : base
  })
  const [generationSource, setGenerationSource] = useState<'local' | 'ai'>(initialCachedSession ? 'ai' : 'local')
  const [generationNote, setGenerationNote] = useState(initialCachedSession ? 'Sesión cargada al instante desde el caché de este dispositivo.' : '')
  const [generationAttribution, setGenerationAttribution] = useState<AiAttribution | null>(initialCachedSessionEntry?.attribution || null)
  const [enhancing, setEnhancing] = useState(false)
  const [explanationSource, setExplanationSource] = useState<'local' | 'ai'>(initialCachedExplanation ? 'ai' : 'local')
  const [explanationNote, setExplanationNote] = useState(initialCachedExplanation ? 'Explicación cargada al instante. Supabase conserva la copia para tus otros dispositivos.' : '')
  const [explanationAttribution, setExplanationAttribution] = useState<AiAttribution | null>(initialCachedExplanationEntry?.attribution || null)
  const [activeExplanationVariant, setActiveExplanationVariant] = useState<ExplanationVariant>('default')
  const [explaining, setExplaining] = useState(false)
  const [hookAnswer, setHookAnswer] = useState('')
  const [visualAnswer, setVisualAnswer] = useState<number | null>(null)
  const [guidedAnswers, setGuidedAnswers] = useState<Record<number, number>>({})
  const [guidedHints, setGuidedHints] = useState<number[]>([])
  const [soloIndex, setSoloIndex] = useState(1)
  const [soloAnswers, setSoloAnswers] = useState<Record<string, number>>({})
  const [soloFinished, setSoloFinished] = useState(false)
  const [teachBack, setTeachBack] = useState('')
  const [evaluation, setEvaluation] = useState<RecallEvaluation | null>(null)
  const [evaluationSource, setEvaluationSource] = useState<'local' | 'ai'>('local')
  const [evaluating, setEvaluating] = useState(false)
  const [rescue, setRescue] = useState<keyof StudySession['rescue'] | null>(null)
  const [prereqGateDismissed, setPrereqGateDismissed] = useState(false)
  const [learningMode, setLearningMode] = useState<LearningMode>(() =>
    localStorage.getItem('comprende-learning-mode') === 'challenge-first' ? 'challenge-first' : 'explain-first'
  )
  const speech = useMicroAudio()
  const semanticForLab = material ? normalizeSemanticAnalysis(material.semantic || buildLocalSemanticAnalysis(material)) : null
  const conceptForLab = semanticForLab?.concepts.find(item => item.label === concept)
  const labDefinition = getLabDefinition(concept, conceptForLab?.lab)

  const phaseConfigs: { id: StepId; label: string }[] = learningMode === 'explain-first'
    ? [
        { id: 'intuition', label: 'Entender' },
        { id: 'visual', label: 'Caso real' },
        { id: 'problem', label: 'Problema' },
        { id: 'formal', label: 'Formal' },
        ...(labDefinition ? [{ id: 'lab' as StepId, label: 'Laboratorio' }] : []),
        { id: 'guided', label: 'Guiado' },
        { id: 'solo', label: 'Practica' },
        { id: 'explain', label: 'Explícalo' },
      ]
    : [
        { id: 'problem', label: 'Problema' },
        { id: 'intuition', label: 'Entender' },
        { id: 'visual', label: 'Caso real' },
        { id: 'formal', label: 'Formal' },
        ...(labDefinition ? [{ id: 'lab' as StepId, label: 'Laboratorio' }] : []),
        { id: 'guided', label: 'Guiado' },
        { id: 'solo', label: 'Practica' },
        { id: 'explain', label: 'Explícalo' },
      ]
  const currentPhase = phaseConfigs[phase]?.id ?? phaseConfigs[0].id

  const resetInteraction = () => {
    setPhase(0)
    setHookAnswer('')
    setVisualAnswer(null)
    setGuidedAnswers({})
    setGuidedHints([])
    setSoloIndex(session?.solo.startIndex ?? 1)
    setSoloAnswers({})
    setSoloFinished(false)
    setTeachBack('')
    setEvaluation(null)
    setRescue(null)
    speech.stop()
  }

  const changeLearningMode = (mode: LearningMode) => {
    if (mode === learningMode) return
    setLearningMode(mode)
    localStorage.setItem('comprende-learning-mode', mode)
    resetInteraction()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const applyAIExplanation = async (targetConcept: string, variant: ExplanationVariant = 'default') => {
    if (!material || !targetConcept) return
    if (variant === 'default') {
      const instant = getCachedExplanationEntry(material, targetConcept)
      if (instant) {
        setSession(current => current && current.concept === targetConcept ? { ...current, intuition: instant.payload } : current)
        setExplanationSource('ai')
        setExplanationAttribution(instant.attribution || null)
        setActiveExplanationVariant('default')
        setExplanationNote('Explicación cargada al instante desde este dispositivo. Supabase conserva la copia en la nube.')
        setExplaining(false)
        return
      }
    }
    setExplaining(true)
    setExplanationNote(variant === 'default' ? 'Consultando la versión guardada en Supabase…' : variant === 'deep' ? 'Profundizando con el modelo avanzado…' : 'Generando una nueva variante con IA…')
    const result = await explainConceptWithAI(material, targetConcept, variant, variant !== 'default')
    setSession(current => current && current.concept === targetConcept ? { ...current, intuition: result.explanation } : current)
    setExplanationSource(result.source)
    setExplanationAttribution(result.attribution || null)
    setActiveExplanationVariant(variant)
    setExplanationNote(result.source === 'ai'
      ? result.cacheLayer === 'browser'
        ? 'Explicación cargada al instante desde este dispositivo.'
        : result.cached
          ? 'Explicación recuperada desde Supabase: no se hizo una nueva llamada a OpenAI.'
          : variant === 'deep'
            ? 'El modelo avanzado profundizó el concepto y guardé esta versión por separado en Supabase + caché local.'
            : variant === 'simpler'
            ? 'La IA volvió a explicar el concepto con lenguaje todavía más simple; guardé esta versión en Supabase y en el dispositivo.'
            : variant === 'new-example'
              ? 'La IA generó otro ejemplo; guardé esta versión en Supabase y en el dispositivo.'
              : 'La explicación fue generada una sola vez y quedó guardada en Supabase + caché local.'
      : result.message || 'Explicación local activa.')
    setExplaining(false)
  }

  const loadConcept = async (nextConcept: string) => {
    if (!material || !nextConcept) return
    setConcept(nextConcept)
    setPrereqGateDismissed(false)
    resetInteraction()
    const cachedSessionEntry = getCachedSessionEntry(material, nextConcept)
    const cachedSession = cachedSessionEntry?.payload || null
    const cachedExplanationEntry = getCachedExplanationEntry(material, nextConcept)
    const cachedExplanation = cachedExplanationEntry?.payload || null
    const local = cachedSession || buildLocalStudySession(material, nextConcept)
    setSession(cachedExplanation ? { ...local, intuition: cachedExplanation } : local)
    setGenerationSource(cachedSession ? 'ai' : 'local')
    setGenerationAttribution(cachedSessionEntry?.attribution || null)
    setGenerationNote(cachedSession ? 'Sesión completa cargada al instante desde el caché del dispositivo.' : 'Ruta base lista. La explicación fácil usa IA solo si todavía no existe una versión guardada.')
    if (cachedExplanation) {
      setExplanationSource('ai')
      setExplanationAttribution(cachedExplanationEntry?.attribution || null)
      setActiveExplanationVariant('default')
      setExplanationNote('Explicación cargada al instante desde este dispositivo. Supabase conserva la copia en la nube.')
      setExplaining(false)
      return
    }
    setExplanationSource('local')
    setExplanationAttribution(null)
    setExplanationNote('Consultando si ya existe una explicación guardada…')
    await applyAIExplanation(nextConcept)
  }

  const regenerateFullSession = async () => {
    if (!material || !concept) return
    setEnhancing(true)
    setGenerationNote('Generando la sesión completa con IA…')
    const result = await enhanceSessionWithAI(material, concept, true)
    setSession(current => {
      if (!current) return result.session
      // Si la explicación fácil ya fue generada por el endpoint especializado,
      // la conservamos porque está optimizada para comprensión inicial.
      return explanationSource === 'ai' ? { ...result.session, intuition: current.intuition } : result.session
    })
    setGenerationSource(result.source)
    setGenerationAttribution(result.attribution || null)
    setGenerationNote(result.source === 'ai'
      ? result.cacheLayer === 'browser'
        ? 'Sesión completa cargada al instante desde este dispositivo.'
        : result.cached
          ? 'Sesión recuperada desde Supabase sin volver a generarla.'
          : 'La sesión completa fue enriquecida con IA y guardada en Supabase + caché local.'
      : result.message || 'Ruta base local activa.')
    if (result.source === 'ai' && explanationSource !== 'ai') {
      setExplanationSource('ai')
      setExplanationNote('La explicación fácil también proviene de la sesión generada con IA.')
    }
    setEnhancing(false)
  }

  useEffect(() => {
    const semanticAtLoad = material ? normalizeSemanticAnalysis(material.semantic || buildLocalSemanticAnalysis(material)) : null
    const nextConcept = initialConcept || semanticAtLoad?.learningOrder[0] || material?.concepts[0]?.label || ''
    if (!material || !nextConcept) return
    let cancelled = false
    setPrereqGateDismissed(false)
    resetInteraction()
    const cachedSessionEntry = getCachedSessionEntry(material, nextConcept)
    const cachedSession = cachedSessionEntry?.payload || null
    const cachedExplanationEntry = getCachedExplanationEntry(material, nextConcept)
    const cachedExplanation = cachedExplanationEntry?.payload || null
    const local = cachedSession || buildLocalStudySession(material, nextConcept)
    setConcept(nextConcept)
    setSession(cachedExplanation ? { ...local, intuition: cachedExplanation } : local)
    setGenerationSource(cachedSession ? 'ai' : 'local')
    setGenerationAttribution(cachedSessionEntry?.attribution || null)
    setGenerationNote(cachedSession ? 'Sesión completa cargada al instante desde este dispositivo.' : 'Ruta base lista. La IA solo trabaja si todavía no hay una versión guardada.')

    if (cachedExplanation) {
      setExplanationSource('ai')
      setExplanationAttribution(cachedExplanationEntry?.attribution || null)
      setActiveExplanationVariant('default')
      setExplanationNote('Explicación cargada al instante desde este dispositivo. Supabase conserva la copia para otros equipos.')
      setExplaining(false)
      return () => { cancelled = true }
    }

    setExplanationSource('local')
    setExplanationAttribution(null)
    setExplanationNote('Consultando la explicación guardada en Supabase…')
    setExplaining(true)
    explainConceptWithAI(material, nextConcept).then(result => {
      if (cancelled) return
      setSession(current => current && current.concept === nextConcept ? { ...current, intuition: result.explanation } : current)
      setExplanationSource(result.source)
      setExplanationAttribution(result.attribution || null)
      setActiveExplanationVariant('default')
      setExplanationNote(result.source === 'ai'
        ? result.cached
          ? 'Explicación recuperada desde Supabase y guardada también en este dispositivo.'
          : 'La explicación fue generada por IA y guardada para futuras visitas.'
        : result.message || 'Explicación local activa.')
      setExplaining(false)
    })

    return () => { cancelled = true }
  }, [initialConcept, material?.id])

  if (!material) {
    return <div className="page"><section className="empty-materials"><h3>Ya no encuentro este material.</h3><button className="primary-button" onClick={onBack}>Volver</button></section></div>
  }

  if (!session) {
    return <div className="page"><section className="empty-materials"><Sparkles size={28} /><h3>Preparando tu sesión…</h3><p>Estoy organizando el concepto en una ruta corta de comprensión.</p></section></div>
  }

  const semanticForStudy = normalizeSemanticAnalysis(material.semantic || buildLocalSemanticAnalysis(material))
  const semanticConcept = semanticForStudy.concepts.find(item => item.label.toLocaleLowerCase('es-MX') === concept.toLocaleLowerCase('es-MX'))
  const sourcePages = semanticConcept?.pages?.length ? semanticConcept.pages.join(', ') : ''
  const attributionLabel = explanationAttribution?.provider === 'openai' ? 'OpenAI' : explanationAttribution?.provider || 'IA'
  const modelLabel = explanationAttribution?.model || ''
  const semanticStudyConcept = semanticForStudy.concepts.find(item => item.label === concept)
  const currentDocumentIndex = semanticForStudy.learningOrder.indexOf(concept)
  const nextDocumentConcept = currentDocumentIndex >= 0 && currentDocumentIndex < semanticForStudy.learningOrder.length - 1 ? semanticForStudy.learningOrder[currentDocumentIndex + 1] : ''
  const routeConcepts = semanticForStudy.learningOrder
    .map(label => semanticForStudy.concepts.find(item => item.label === label))
    .filter(Boolean) as SemanticConcept[]
  const extraConcepts = sortConceptsByDocumentOrder(
    semanticForStudy.concepts.filter(item => !semanticForStudy.learningOrder.includes(item.label)),
    semanticForStudy.learningOrder,
  )
  // La navegación principal sigue únicamente el orden del documento. Los conceptos
  // de profundidad siguen disponibles desde el mapa, pero no se mezclan con la ruta.
  const currentDeepConcept = currentDocumentIndex < 0
    ? extraConcepts.find(item => item.label === concept)
    : undefined
  const orderedStudyConcepts = currentDeepConcept ? [currentDeepConcept, ...routeConcepts] : routeConcepts
  const hasPrerequisites = Boolean(semanticStudyConcept?.prerequisites?.length)

  const previousDocumentConcepts = currentDocumentIndex > 0
    ? semanticForStudy.learningOrder.slice(0, currentDocumentIndex)
    : []
  const completedPreviousConcepts = previousDocumentConcepts.filter(label =>
    lessonIsCompleted(conceptRecord(learningMemory, material.id, label)),
  )
  const connectionTarget = completedPreviousConcepts.at(-1) || ''
  const effectiveTeachBack: StudySession['teachBack'] = connectionTarget
    ? {
        prompt: `Explícame ${concept} como si yo fuera un compañero que faltó a clase. Incluye qué es, para qué sirve, cómo se relaciona con ${connectionTarget} —que ya estudiaste— y un ejemplo del mundo real distinto al que acabas de practicar. No necesitas usar conceptos posteriores del documento.`,
        checklist: [
          `Definiste ${concept} con tus palabras.`,
          'Explicaste para qué sirve o qué problema aborda.',
          `Lo relacionaste con ${connectionTarget}, que ya habías estudiado.`,
          'Incluiste un ejemplo nuevo o una consecuencia práctica.',
        ],
      }
    : {
        prompt: `Explícame ${concept} como si yo fuera un compañero que faltó a clase. Incluye qué es, para qué sirve y un ejemplo del mundo real distinto al que acabas de practicar. Como todavía no has completado un tema anterior de esta ruta, no necesitas relacionarlo con conceptos que aparecen después en el documento.`,
        checklist: [
          `Definiste ${concept} con tus palabras.`,
          'Explicaste para qué sirve o qué problema aborda.',
          'Describiste la idea sin apoyarte en un tema que todavía no has estudiado.',
          'Incluiste un ejemplo nuevo o una consecuencia práctica.',
        ],
      }

  const audioText = `${session.concept}. ${session.intuition.summary} ${session.intuition.purpose} Ejemplo: ${session.intuition.example} ${session.intuition.analogy} ${session.intuition.keyIdea}`
  const evaluate = async () => {
    if (!teachBack.trim()) return
    setEvaluating(true)
    const sessionForEvaluation: StudySession = { ...session, teachBack: effectiveTeachBack }
    const result = await evaluateRecall(teachBack, material, concept, sessionForEvaluation)
    setEvaluation(result.evaluation)
    setEvaluationSource(result.source)
    onMemoryEvent({
      materialId: material.id,
      materialName: material.name,
      concept,
      type: 'teachback',
      score: result.evaluation.score,
      teachBackScore: result.evaluation.score,
      detail: result.evaluation.verdict,
      completed: true,
    })
    setEvaluating(false)
  }

  const rescueLabels: { id: keyof StudySession['rescue']; label: string }[] = [
    { id: 'terms', label: 'No entiendo los términos' },
    { id: 'formula', label: 'La fórmula me pierde' },
    { id: 'use', label: 'No sé cuándo usarlo' },
    { id: 'prereq', label: 'Siento que me falta algo anterior' },
  ]

  const guidedComplete = session.guided.steps.every((_, index) => guidedAnswers[index] !== undefined)
  const currentSoloExercise = session.solo.exercises[soloIndex] || session.solo.exercises[session.solo.startIndex] || session.solo.exercises[0]
  const currentSoloAnswer = currentSoloExercise ? soloAnswers[currentSoloExercise.id] : undefined
  const soloAnsweredEntries = session.solo.exercises.filter(exercise => soloAnswers[exercise.id] !== undefined)
  const soloCorrectCount = soloAnsweredEntries.filter(exercise => soloAnswers[exercise.id] === exercise.correctIndex).length
  const currentMemory = conceptRecord(learningMemory, material.id, concept)

  const goNextSoloExercise = () => {
    if (!currentSoloExercise || currentSoloAnswer === undefined) return
    const correct = currentSoloAnswer === currentSoloExercise.correctIndex
    const indexByLevel = (level: StudySession['solo']['exercises'][number]['level']) => session.solo.exercises.findIndex(exercise => exercise.level === level)
    let next = -1
    if (currentSoloExercise.level === 'aplicacion') next = correct ? indexByLevel('examen') : indexByLevel('refuerzo')
    else if (currentSoloExercise.level === 'refuerzo') next = indexByLevel('examen')
    else if (currentSoloExercise.level === 'examen') next = indexByLevel('transferencia')
    else next = -1
    if (next >= 0 && next !== soloIndex) setSoloIndex(next)
    else {
      const answered = session.solo.exercises.filter(exercise => soloAnswers[exercise.id] !== undefined)
      const correctCount = answered.filter(exercise => soloAnswers[exercise.id] === exercise.correctIndex).length
      const accuracy = answered.length ? correctCount / answered.length : 0
      onMemoryEvent({
        materialId: material.id,
        materialName: material.name,
        concept,
        type: 'practice',
        score: Math.round(accuracy * 100),
        practiceAccuracy: accuracy,
        detail: `${correctCount}/${answered.length} retos correctos en práctica adaptativa`,
      })
      setSoloFinished(true)
    }
  }

  const resetSoloPractice = () => {
    setSoloAnswers({})
    setSoloIndex(session.solo.startIndex ?? 1)
    setSoloFinished(false)
  }

  return (
    <div className="page generated-study-page">
      <button className="text-button study-back" onClick={onBack}><ArrowLeft size={15} /> Mis materiales</button>

      <section className="generated-study-header">
        <div>
          <div className="generated-meta-row">
            <span className="tiny-label">COMPRENDE 2.0.7 · SESIÓN DE COMPRENSIÓN</span>
            <span className={generationSource === 'ai' || explanationSource === 'ai' ? 'engine-badge ai' : 'engine-badge'}><Sparkles size={12} /> {generationSource === 'ai' ? 'Sesión IA' : explanationSource === 'ai' ? 'Explicación IA' : 'Motor local'}</span>
            {(enhancing || explaining) && <span className="engine-working">{explaining ? 'Consultando contenido guardado…' : 'Mejorando con IA…'}</span>}
          </div>
          <h1>{concept}</h1>
          <p>{session.objective}</p>
          <div className="session-facts"><span>≈ {session.estimatedMinutes} min</span><span>{material.name}</span>{currentDocumentIndex >= 0 && <span>Tema {currentDocumentIndex + 1} de {semanticForStudy.learningOrder.length}</span>}<span>7 pasos</span><span>{learningMode === 'explain-first' ? 'Explicación primero' : 'Descubrimiento primero'}</span>{lessonIsCompleted(currentMemory) && <span className="lesson-completed-fact"><Check size={12}/> Completada · {lessonCompletionScore(currentMemory)}%</span>}{currentMemory && <span className="memory-fact">Memoria {currentMemory.mastery}% · {formatReviewDate(currentMemory.nextReviewAt)}</span>}</div>
        </div>
        <div className="generated-actions">
          <label className="concept-select">
            <span>Cambiar tema</span>
            <select value={concept} onChange={e => loadConcept(e.target.value)}>
              {currentDeepConcept && <option value={currentDeepConcept.label}>Subtema opcional · {currentDeepConcept.label}</option>}
              {routeConcepts.map((c, index) => <option value={c.label} key={c.label}>{`${index + 1}. ${c.label}`}</option>)}
            </select>
          </label>
          <button className="secondary-button" disabled={enhancing || explaining} onClick={regenerateFullSession}><Sparkles size={14} /> {enhancing ? 'Generando…' : 'Mejorar sesión completa con IA'}</button>
        </div>
      </section>

      {generationNote && <div className="engine-note"><Sparkles size={14} /><span>{generationNote}</span></div>}

      {hasPrerequisites && !prereqGateDismissed && <PrerequisiteGate material={material} concept={concept} onContinue={() => setPrereqGateDismissed(true)} onStudyPrerequisite={loadConcept} />}

      <section className="learning-mode-panel">
        <div className="learning-mode-copy">
          <span className="tiny-label">CÓMO QUIERES APRENDERLO</span>
          <strong>{learningMode === 'explain-first' ? 'Primero te lo explico; después te hago pensar.' : 'Primero intentas resolver el problema; después construimos la explicación.'}</strong>
          <p>Puedes cambiar de enfoque en cualquier momento. Comprende recordará tu preferencia para los siguientes conceptos.</p>
        </div>
        <div className="learning-mode-options">
          <button className={learningMode === 'explain-first' ? 'active' : ''} onClick={() => changeLearningMode('explain-first')}>
            <BookOpen size={17} />
            <span><b>Explícame primero</b><small>{labDefinition ? 'Concepto → caso real → problema → formal → laboratorio → práctica' : 'Concepto → caso real → problema → formal → práctica interactiva'}</small></span>
            {learningMode === 'explain-first' && <Check size={15} />}
          </button>
          <button className={learningMode === 'challenge-first' ? 'active' : ''} onClick={() => changeLearningMode('challenge-first')}>
            <BrainCircuit size={17} />
            <span><b>Hazme pensar primero</b><small>{labDefinition ? 'Problema → explicación → caso real → formal → laboratorio → práctica' : 'Problema → explicación → caso real → práctica interactiva'}</small></span>
            {learningMode === 'challenge-first' && <Check size={15} />}
          </button>
        </div>
      </section>

      <div className="concept-stepper">
        {phaseConfigs.map((item, index) => (
          <button key={item.id} className={phase === index ? 'active' : phase > index ? 'done' : ''} onClick={() => { setPhase(index); setRescue(null) }}>
            <span>{phase > index ? <Check size={12} /> : index + 1}</span><small>{item.label}</small>
          </button>
        ))}
      </div>

      <section className="generated-workbench">
        {currentPhase === 'problem' && <>
          <div className="workbench-kicker"><CircleHelp size={17} /> {phase + 1} · {learningMode === 'explain-first' ? 'COMPRUEBA PARA QUÉ SIRVE' : 'PRIMERO NECESITAS EL PROBLEMA'}</div>
          <h2>{learningMode === 'explain-first' ? 'Ahora que conoces la idea, úsala para leer el problema.' : 'Antes de definirlo, haz que la idea sea necesaria.'}</h2>
          <div className="hook-scenario">{session.hook.scenario}</div>
          <h3 className="study-question">{session.hook.question}</h3>
          <textarea className="explanation-area compact" value={hookAnswer} onChange={e => setHookAnswer(e.target.value)} placeholder="Escribe lo que crees, aunque no estés seguro…" />
          {hookAnswer.trim() && <div className="reveal-box"><Lightbulb size={18} /><div><strong>Lo importante</strong><p>{session.hook.reveal}</p></div></div>}
        </>}

        {currentPhase === 'intuition' && <>
          <div className="workbench-kicker"><Lightbulb size={17} /> {phase + 1} · EXPLÍCAMELO FÁCIL</div>
          <div className="explanation-title-row">
            <div>
              <h2>{learningMode === 'explain-first' ? `${concept}, explicado para entenderlo de verdad.` : 'Ahora convierte el problema en una idea sencilla.'}</h2>
              {learningMode === 'explain-first' && <p className="concept-first-intro">Primero quiero que formes una imagen mental clara. La precisión académica viene después.</p>}
            </div>
            <span className={explanationSource === 'ai' ? 'explanation-source ai' : 'explanation-source'}><Sparkles size={12} /> {explaining ? 'Generando…' : explanationSource === 'ai' ? 'Explicación IA' : 'Respaldo local'}</span>
          </div>

          <div className={explanationSource === 'ai' ? 'ai-explanation-status ready' : 'ai-explanation-status'}>
            <div>
              <strong>{explanationSource === 'ai' ? 'Esta parte sí está explicada por IA.' : 'La IA no respondió; estás viendo el respaldo local.'}</strong>
              <span>{explaining ? 'Estoy leyendo el contexto del documento y preparando una explicación más digerible…' : explanationNote || 'Puedes volver a intentar la explicación con IA.'}</span>
            </div>
            <div className="explanation-actions">
              {activeExplanationVariant === 'deep' && <button disabled={explaining} onClick={() => applyAIExplanation(concept, 'default')}><BookOpen size={13} /> Versión rápida</button>}
              <button disabled={explaining} onClick={() => applyAIExplanation(concept, 'simpler')}><Sparkles size={13} /> Más simple</button>
              <button disabled={explaining} onClick={() => applyAIExplanation(concept, 'new-example')}><RotateCcw size={13} /> Otro ejemplo</button>
              <button className="advanced-model-button" disabled={explaining} onClick={() => applyAIExplanation(concept, 'deep')}><BrainCircuit size={13} /> Profundizar con modelo avanzado</button>
            </div>
          </div>

          <div className="intuition-grid enhanced">
            <article className="learning-panel featured explanation-main"><span>QUÉ ES</span><p>{session.intuition.summary}</p></article>
            <article className="learning-panel purpose"><span>PARA QUÉ SIRVE</span><p>{session.intuition.purpose}</p></article>
            <article className="learning-panel example"><span>EJEMPLO CONCRETO</span><p>{session.intuition.example}</p></article>
            <article className="learning-panel"><span>ANALOGÍA</span><p>{session.intuition.analogy}</p></article>
            <article className="learning-panel key-idea"><span>QUÉDATE CON ESTO</span><p>{session.intuition.keyIdea}</p></article>
            <article className="learning-panel warning"><span>ERROR COMÚN</span><p>{session.intuition.misconception}</p></article>
          </div>
          <div className="document-context"><FileText size={15} /><div><strong>Cómo encaja en tu documento</strong><p>{session.intuition.context}</p></div></div>
          <div className="content-provenance">
            <div><FileText size={14} /><span><b>Fuente académica:</b> {material.name}{sourcePages ? ` · págs. ${sourcePages}` : ''}</span></div>
            {explanationSource === 'ai' && explanationAttribution ? <div><Sparkles size={14} /><span><b>Explicación:</b> {attributionLabel} · {modelLabel}{explanationAttribution.depth === 'advanced' ? ' · modelo avanzado' : ' · explicación rápida'}{explanationAttribution.generatedAt ? ` · ${new Date(explanationAttribution.generatedAt).toLocaleDateString('es-MX')}` : ''}</span></div> : <div><BrainCircuit size={14} /><span><b>Explicación:</b> motor local de Comprende</span></div>}
            <div className="provenance-note">Las definiciones se anclan al material. Los ejemplos o conexiones que no estén en el PDF se presentan como ampliación pedagógica de Comprende.</div>
          </div>
          <div className="microaudio-bar"><Headphones size={18} /><div><strong>Microaudio de comprensión · ElevenLabs</strong><span>{speech.loading ? 'Preparando la voz…' : speech.source === 'cache' ? 'Reutilizando el audio guardado en Supabase.' : speech.source === 'generated' ? 'Audio generado y guardado para la próxima vez.' : 'La primera reproducción se genera una vez y después se reutiliza.'}</span>{speech.error && <small className="audio-error-note">{speech.error}</small>}</div>{speech.playing ? <><button className="secondary-button" onClick={() => speech.paused ? speech.resume() : speech.pause()}>{speech.paused ? <Play size={13} /> : <Pause size={13} />} {speech.paused ? 'Seguir' : 'Pausa'}</button><button className="secondary-button" onClick={speech.stop}><Square size={13} /> Detener</button></> : <button className="secondary-button" disabled={speech.loading} onClick={() => speech.speak(audioText)}><Play size={13} /> {speech.loading ? 'Preparando…' : 'Escuchar'}</button>}</div>
        </>}

        {currentPhase === 'visual' && <>
          <div className="workbench-kicker"><BrainCircuit size={17} /> {phase + 1} · VERLO EN ACCIÓN</div>
          <h2>{session.visual.title}</h2>
          <p className="workbench-intro">{session.visual.purpose}</p>
          <div className="world-case-card">
            <div className="world-case-badge"><Sparkles size={14} /> CASO DEL MUNDO REAL</div>
            <h3>{session.visual.worldExample.title}</h3>
            <p>{session.visual.worldExample.context}</p>
            <div className="world-case-decision"><Target size={16} /><span><b>La decisión:</b> {session.visual.worldExample.decision}</span></div>
          </div>
          <div className="visual-flow interactive">
            {session.visual.items.map((item, index) => <div className="visual-flow-item" key={`${item.label}-${index}`}><div className="flow-index">{index + 1}</div><div><strong>{item.label}</strong><p>{item.detail}</p></div>{index < session.visual.items.length - 1 && <ArrowRight className="flow-arrow" size={18} />}</div>)}
          </div>
          <div className="visual-check-card">
            <div><span className="tiny-label">COMPRUÉBALO EN 20 SEGUNDOS</span><h3>{session.visual.check.question}</h3></div>
            <div className="visual-check-options">{session.visual.check.choices.map((choice, index) => {
              const answered = visualAnswer !== null
              const correct = index === session.visual.check.correctIndex
              const selected = index === visualAnswer
              return <button key={choice} disabled={answered} className={answered && correct ? 'correct' : answered && selected ? 'wrong' : ''} onClick={() => setVisualAnswer(index)}><span>{String.fromCharCode(65 + index)}</span><p>{choice}</p>{answered && correct && <Check size={16} />}</button>
            })}</div>
            {visualAnswer !== null && <div className={visualAnswer === session.visual.check.correctIndex ? 'answer-feedback good' : 'answer-feedback'}><strong>{visualAnswer === session.visual.check.correctIndex ? 'Sí, esa es la idea' : 'Mira otra vez el flujo'}</strong><p>{session.visual.check.explanation}</p></div>}
          </div>
        </>}

        {currentPhase === 'formal' && <>
          <div className="workbench-kicker"><BookOpen size={17} /> {phase + 1} · AHORA SÍ, FORMAL</div>
          <h2>Vuelve a la precisión académica.</h2>
          <blockquote className="formal-definition">{session.formal.definition}</blockquote>
          <div className="formal-provenance"><FileText size={13}/><span>Definición anclada a <b>{material.name}</b>{sourcePages ? ` · págs. ${sourcePages}` : ''}</span>{generationAttribution?.model && <><Sparkles size={13}/><span>Sesión organizada con <b>{generationAttribution.provider === 'openai' ? 'OpenAI' : generationAttribution.provider} · {generationAttribution.model}</b></span></>}</div>
          <div className="formal-grid">
            <div><span className="tiny-label">VOCABULARIO CLAVE</span><div className="term-list">{session.formal.terms.map(term => <div key={term.term}><strong>{term.term}</strong><p>{term.meaning}</p></div>)}</div></div>
            <div><span className="tiny-label">EVIDENCIA DE TU DOCUMENTO</span><div className="source-excerpts compact">{session.formal.sourceEvidence.map((excerpt, i) => <blockquote key={i}><span>Fuente {i + 1}</span><p>{excerpt}</p></blockquote>)}</div></div>
          </div>
        </>}

        {currentPhase === 'lab' && <ConceptLab userId={userId} material={material} concept={concept} onMemoryEvent={onMemoryEvent} />}

        {currentPhase === 'guided' && <>
          <div className="workbench-kicker"><Target size={17} /> {phase + 1} · RESUÉLVELO CONMIGO</div>
          <h2>{session.guided.prompt}</h2>
          <div className="guided-case-intro"><div><span className="tiny-label">CASO GUIADO</span><p>{session.guided.scenario}</p></div><div><span className="tiny-label">META</span><p>{session.guided.goal}</p></div></div>
          <div className="guided-interactive-steps">{session.guided.steps.map((item, i) => {
            const selected = guidedAnswers[i]
            const answered = selected !== undefined
            const unlocked = i === 0 || guidedAnswers[i - 1] !== undefined
            const hintOpen = guidedHints.includes(i)
            return <article className={unlocked ? answered ? 'answered' : 'active' : 'locked'} key={i}>
              <div className="guided-step-head"><span>{i + 1}</span><div><small>DECISIÓN {i + 1}</small><strong>{item.prompt}</strong></div>{answered && <Check size={17} />}</div>
              {!unlocked ? <p className="guided-locked-copy">Resuelve la decisión anterior para desbloquear esta parte del caso.</p> : <>
                <div className="guided-choice-grid">{item.choices.map((choice, choiceIndex) => {
                  const correct = choiceIndex === item.correctIndex
                  const isSelected = selected === choiceIndex
                  return <button key={choice} disabled={answered} className={answered && correct ? 'correct' : answered && isSelected ? 'wrong' : ''} onClick={() => setGuidedAnswers(previous => ({ ...previous, [i]: choiceIndex }))}><span>{String.fromCharCode(65 + choiceIndex)}</span><p>{choice}</p>{answered && correct && <Check size={15} />}</button>
                })}</div>
                {!answered && <button className="hint-button" onClick={() => setGuidedHints(current => current.includes(i) ? current.filter(value => value !== i) : [...current, i])}><Lightbulb size={14} /> {hintOpen ? 'Ocultar pista' : 'Necesito una pista'}</button>}
                {hintOpen && !answered && <div className="guided-hint">{item.hint}</div>}
                {answered && <div className={selected === item.correctIndex ? 'guided-explanation good' : 'guided-explanation'}><strong>{selected === item.correctIndex ? 'Buena decisión' : 'Aquí está el giro importante'}</strong><p>{item.explanation}</p></div>}
              </>}
            </article>
          })}</div>
          {guidedComplete && <div className="takeaway-box"><Check size={17} /><span>{session.guided.takeaway}</span></div>}
        </>}

        {currentPhase === 'solo' && <>
          <div className="workbench-kicker"><Gauge size={17} /> {phase + 1} · PRÁCTICA ADAPTATIVA</div>
          <div className="adaptive-practice-head"><div><h2>Ahora sí: úsalo sin que yo te lleve de la mano.</h2><p className="workbench-intro">{session.solo.intro}</p></div><div className="practice-score"><strong>{soloCorrectCount}/{soloAnsweredEntries.length}</strong><span>aciertos</span></div></div>
          {!soloFinished && currentSoloExercise ? <>
            <div className={`difficulty-badge ${currentSoloExercise.level}`}>{currentSoloExercise.level === 'refuerzo' ? 'Refuerzo' : currentSoloExercise.level === 'aplicacion' ? 'Aplicación' : currentSoloExercise.level === 'examen' ? 'Nivel examen' : 'Transferencia'}</div>
            <div className="solo-scenario"><span>ESCENARIO</span><p>{currentSoloExercise.scenario}</p></div>
            <h3 className="adaptive-question">{currentSoloExercise.question}</h3>
            <div className="solo-choices adaptive">{currentSoloExercise.choices.map((choice, i) => {
              const answered = currentSoloAnswer !== undefined
              const correct = i === currentSoloExercise.correctIndex
              const selected = i === currentSoloAnswer
              return <button key={choice} disabled={answered} className={answered && correct ? 'correct' : answered && selected ? 'wrong' : ''} onClick={() => setSoloAnswers(previous => ({ ...previous, [currentSoloExercise.id]: i }))}><span>{String.fromCharCode(65 + i)}</span><p>{choice}</p>{answered && correct && <Check size={17} />}</button>
            })}</div>
            {currentSoloAnswer !== undefined && <div className={currentSoloAnswer === currentSoloExercise.correctIndex ? 'answer-feedback good' : 'answer-feedback'}><strong>{currentSoloAnswer === currentSoloExercise.correctIndex ? 'Vas subiendo de nivel' : currentSoloExercise.level === 'aplicacion' ? 'Bajamos un momento a refuerzo' : 'Usa esta explicación para reajustar'}</strong><p>{currentSoloExercise.explanation}</p><button className="secondary-button practice-next" onClick={goNextSoloExercise}>{currentSoloExercise.level === 'transferencia' ? 'Ver resultado' : 'Siguiente reto'} <ArrowRight size={14} /></button></div>}
          </> : <div className="practice-finish-card"><Trophy size={30} /><span className="tiny-label">RESULTADO DE LA PRÁCTICA</span><h3>{soloCorrectCount >= 3 ? 'Ya estás transfiriendo la idea.' : soloCorrectCount >= 2 ? 'La base está; conviene otra vuelta corta.' : 'Necesitas un refuerzo antes de subir dificultad.'}</h3><p>Resolviste {soloAnsweredEntries.length} retos y acertaste {soloCorrectCount}. Comprende cambió la ruta según tus respuestas en vez de mostrarte siempre la misma pregunta.</p>{currentMemory && <div className="memory-evidence-note"><RefreshCw size={15} /><span>Guardado en memoria: <b>{currentMemory.mastery}%</b> de dominio · próximo repaso <b>{formatReviewDate(currentMemory.nextReviewAt).toLocaleLowerCase('es-MX')}</b>.</span></div>}<button className="secondary-button" onClick={resetSoloPractice}><RotateCcw size={14} /> Repetir práctica</button></div>}
        </>}

        {currentPhase === 'explain' && <>
          <div className="workbench-kicker"><Trophy size={17} /> {phase + 1} · EXPLÍCAMELO TÚ</div>
          <h2>La prueba final es recuperar la idea sin mirar.</h2>
          <p className="workbench-intro">{effectiveTeachBack.prompt}</p>
          <div className="teachback-grid">
            <div><textarea className="explanation-area" value={teachBack} onChange={e => { setTeachBack(e.target.value); setEvaluation(null) }} placeholder="Explícalo con tus palabras…" /><div className="teachback-checklist">{effectiveTeachBack.checklist.map(item => <span key={item}><Check size={12} />{item}</span>)}</div><button className="primary-button" disabled={!teachBack.trim() || evaluating} onClick={evaluate}>{evaluating ? 'Evaluando…' : 'Evaluar mi comprensión'} <ArrowRight size={15} /></button></div>
            {evaluation ? <aside className={evaluation.score >= 75 ? 'evaluation-card good' : 'evaluation-card'}><div className="evaluation-head"><strong>{evaluation.score}%</strong><span>{evaluationSource === 'ai' ? 'Evaluación IA' : 'Evaluación local'}</span></div><h3>{evaluation.verdict}</h3><div className="evaluation-section"><b>Lo que sí está</b>{evaluation.strengths.map(x => <p key={x}>✓ {x}</p>)}</div><div className="evaluation-section"><b>Lo que falta</b>{evaluation.missing.map(x => <p key={x}>• {x}</p>)}</div><div className="evaluation-next"><strong>Siguiente acción</strong><p>{evaluation.nextAction}</p></div>{currentMemory && <div className="evaluation-memory"><RefreshCw size={14} /><span>Memoria actualizada: {currentMemory.mastery}% · repaso {formatReviewDate(currentMemory.nextReviewAt).toLocaleLowerCase('es-MX')}</span></div>}</aside> : <aside className="evaluation-placeholder"><BrainCircuit size={26} /><strong>Yo no voy a calificar redacción.</strong><p>La evaluación busca si entendiste la idea, qué omitiste y cuál debería ser tu siguiente acción.</p></aside>}
          </div>
          {evaluation && <div className="lesson-completion-banner"><div className="lesson-completion-icon"><Check size={24} /></div><div><span className="tiny-label">LECCIÓN COMPLETADA</span><h3>Terminaste {concept}</h3><p>Tu resultado final fue <strong>{evaluation.score}%</strong>. La lección queda marcada como completada y Comprende conservará este estado en tu progreso y sincronización.</p></div><div className="lesson-completion-score"><strong>{evaluation.score}%</strong><span>resultado</span></div></div>}
        </>}
      </section>

      <section className="rescue-panel">
        <div><CircleHelp size={18} /><div><strong>¿No está haciendo clic?</strong><span>No voy a repetir exactamente la misma explicación.</span></div></div>
        <div className="rescue-options">{rescueLabels.map(item => <button className={rescue === item.id ? 'active' : ''} key={item.id} onClick={() => setRescue(rescue === item.id ? null : item.id)}>{item.label}</button>)}</div>
        {rescue && <div className="rescue-answer"><Lightbulb size={17} /><div><p>{session.rescue[rescue]}</p><button className="rescue-advanced-button" disabled={explaining} onClick={() => { setPhase(phaseConfigs.findIndex(item => item.id === 'intuition')); applyAIExplanation(concept, 'deep') }}><BrainCircuit size={14}/> No hizo clic · usar modelo avanzado</button></div></div>}
      </section>

      <div className="workbench-footer generated-footer">
        <button className="ghost-button" disabled={phase === 0} onClick={() => { setPhase(Math.max(0, phase - 1)); setRescue(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><ArrowLeft size={15} /> Anterior</button>
        <span>{phase + 1} / {phaseConfigs.length}</span>
        {phase < phaseConfigs.length - 1 ? <button className="primary-button" onClick={() => { setPhase(phase + 1); setRescue(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Siguiente <ArrowRight size={15} /></button> : !evaluation ? <button className="primary-button completion-required-button" disabled><Check size={15} /> Evalúa tu comprensión para completar</button> : nextDocumentConcept ? <button className="primary-button document-next-button" onClick={() => loadConcept(nextDocumentConcept)}>Siguiente tema: {nextDocumentConcept} <ArrowRight size={15} /></button> : <button className="primary-button" onClick={() => { resetInteraction(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><RotateCcw size={15} /> Repetir sesión</button>}
      </div>
    </div>
  )
}

export default App
