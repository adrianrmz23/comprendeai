import { useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Gauge,
  History,
  Import,
  Network,
  Search,
  Sparkles,
  Target,
  UploadCloud,
} from 'lucide-react'
import type { StudyMaterial } from './materials'
import type { LearningMemory } from './memory'
import { dueReviews, fragileConcepts, getMemoryRecords, solidConcepts } from './memory'
import {
  documentProgress,
  exportPayload,
  nextRecommendedConcept,
  recentActivity,
  searchGlobal,
  subjectSummaries,
  validateImportPayload,
} from './dashboard'

type DashboardViewProps = {
  materials: StudyMaterial[]
  learningMemory: LearningMemory
  onOpenConcept: (materialId: string, concept: string) => void
  onOpenMap: (materialId: string) => void
  onOpenMaterials: () => void
  onOpenReviews: () => void
  onOpenProgress: () => void
  onImport: (materials: StudyMaterial[], memory: LearningMemory) => void
  onStartDemo: () => void
}

export default function DashboardView({
  materials,
  learningMemory,
  onOpenConcept,
  onOpenMap,
  onOpenMaterials,
  onOpenReviews,
  onOpenProgress,
  onImport,
  onStartDemo,
}: DashboardViewProps) {
  const [query, setQuery] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const importRef = useRef<HTMLInputElement | null>(null)

  const records = getMemoryRecords(learningMemory)
  const due = dueReviews(learningMemory)
  const fragile = fragileConcepts(learningMemory)
  const solid = solidConcepts(learningMemory)
  const next = nextRecommendedConcept(materials, learningMemory)
  const subjects = subjectSummaries(materials, learningMemory)
  const recent = recentActivity(learningMemory)
  const hits = useMemo(() => searchGlobal(materials, learningMemory, query, 10), [materials, learningMemory, query])
  const avgMastery = records.length ? Math.round(records.reduce((sum, r) => sum + r.mastery, 0) / records.length) : 0
  const conceptCount = materials.reduce((sum, m) => sum + (m.semantic?.concepts.length || m.concepts.length), 0)

  const exportData = () => {
    const payload = exportPayload(materials, learningMemory)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `comprende-respaldo-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (file?: File) => {
    if (!file) return
    setImportMessage('')
    try {
      const parsed = JSON.parse(await file.text())
      const validated = validateImportPayload(parsed)
      const shouldReplace = window.confirm('Este respaldo reemplazará los materiales y la memoria local de Comprende en este navegador. ¿Continuar?')
      if (!shouldReplace) return
      onImport(validated.materials, validated.learningMemory)
      setImportMessage(`Respaldo restaurado: ${validated.materials.length} material${validated.materials.length === 1 ? '' : 'es'}.`)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'No pude importar el respaldo.')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <div className="page dashboard-v10">
      <section className="dashboard-hero-v10">
        <div>
          <div className="eyebrow"><Sparkles size={16} /> COMPRENDE 1.4 · TU SISTEMA DE ESTUDIO</div>
          <h1>Hoy no necesitas estudiar todo.<br /><span>Necesitas estudiar lo correcto.</span></h1>
          <p>Tu panel reúne documentos, mapa semántico, práctica, memoria y repaso. Comprende usa la evidencia de lo que realmente puedes recuperar, no solo el tiempo que pasaste leyendo.</p>
        </div>
        <div className="dashboard-hero-status">
          <span>ESTADO DE HOY</span>
          <strong>{due.length ? `${due.length} por repasar` : records.length ? 'Al día' : 'Listo para empezar'}</strong>
          <p>{due.length ? 'Prioriza recuperación antes de añadir contenido nuevo.' : records.length ? `${solid.length} concepto${solid.length === 1 ? '' : 's'} sólido${solid.length === 1 ? '' : 's'} y ${fragile.length} frágil${fragile.length === 1 ? '' : 'es'}.` : 'Sube un PDF o usa la sesión demo para generar tu primera evidencia.'}</p>
        </div>
      </section>

      <section className="dashboard-stats-v10">
        <button onClick={onOpenMaterials}><FolderOpen size={20} /><div><strong>{materials.length}</strong><span>Materiales</span><small>{subjects.length} materia{subjects.length === 1 ? '' : 's'}</small></div></button>
        <button onClick={onOpenMaterials}><Network size={20} /><div><strong>{conceptCount}</strong><span>Conceptos</span><small>detectados en tus documentos</small></div></button>
        <button onClick={onOpenProgress}><Gauge size={20} /><div><strong>{avgMastery}%</strong><span>Dominio medio</span><small>{records.length} con evidencia</small></div></button>
        <button onClick={onOpenReviews}><CalendarClock size={20} /><div><strong>{due.length}</strong><span>Repasos hoy</span><small>{fragile.length} concepto{fragile.length === 1 ? '' : 's'} frágil{fragile.length === 1 ? '' : 'es'}</small></div></button>
      </section>

      <section className="dashboard-main-grid-v10">
        <article className="today-card-v10">
          <div className="section-heading-v10">
            <div><span className="tiny-label">SIGUIENTE MEJOR ACCIÓN</span><h2>{next ? next.concept : materials.length ? 'Elige un concepto para comenzar' : 'Sube tu primer material'}</h2></div>
            <Target size={22} />
          </div>
          {next ? (
            <>
              <span className={`recommendation-kind ${next.kind}`}>{next.reason}</span>
              <p>{next.kind === 'review' ? 'Este concepto debería recuperarse antes de seguir acumulando contenido. Una sesión breve ahora tiene más valor que releer el tema completo.' : 'Es el siguiente concepto esencial disponible en tu ruta pedagógica. Empieza por comprenderlo y después genera evidencia con práctica y explicación.'}</p>
              <div className="today-actions-v10">
                <button className="primary-button" onClick={() => onOpenConcept(next.materialId, next.concept)}>{next.kind === 'review' ? 'Repasar ahora' : 'Estudiar ahora'} <ArrowRight size={16} /></button>
                {next.kind === 'review' && <button className="secondary-button" onClick={onOpenReviews}>Ver toda la cola</button>}
              </div>
            </>
          ) : materials.length ? (
            <><p>Ya tienes materiales procesados. Abre la biblioteca y selecciona un concepto esencial para generar tu primera evidencia.</p><button className="primary-button" onClick={onOpenMaterials}>Abrir materiales <ArrowRight size={16} /></button></>
          ) : (
            <><p>Sube un PDF de tu maestría. Comprende extraerá su estructura, construirá el mapa de aprendizaje y convertirá sus conceptos en sesiones cortas.</p><div className="today-actions-v10"><button className="primary-button" onClick={onOpenMaterials}><UploadCloud size={16} /> Subir material</button><button className="secondary-button" onClick={onStartDemo}>Probar Bayes</button></div></>
          )}
        </article>

        <article className="global-search-v10">
          <div className="section-heading-v10"><div><span className="tiny-label">BÚSQUEDA GLOBAL</span><h2>Encuentra cualquier concepto</h2></div><Search size={21} /></div>
          <label className="dashboard-search-box-v10"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Bayes, HMM, incertidumbre, función de pertenencia…" /></label>
          {!query.trim() ? <div className="search-empty-v10"><p>Busca simultáneamente en nombres de conceptos, descripciones, documentos y materias.</p></div> : hits.length ? (
            <div className="global-search-results-v10">{hits.map(hit => (
              <button key={`${hit.materialId}-${hit.concept}`} onClick={() => onOpenConcept(hit.materialId, hit.concept)}>
                <div><strong>{hit.concept}</strong><span>{hit.subject} · {hit.materialName}</span></div>
                <div className="search-result-meta-v10">{hit.mastery !== null && <b>{hit.mastery}%</b>}<em>{hit.tier === 'essential' ? 'Esencial' : 'Profundidad'}</em><ArrowRight size={14} /></div>
              </button>
            ))}</div>
          ) : <div className="search-empty-v10"><p>No encontré coincidencias en tus materiales actuales.</p></div>}
        </article>
      </section>

      <section className="dashboard-section-v10">
        <div className="section-heading-v10 dashboard-section-title-v10"><div><span className="tiny-label">MATERIAS</span><h2>Tu maestría, vista desde arriba</h2></div><button className="text-button" onClick={onOpenMaterials}>Gestionar materiales <ArrowRight size={14} /></button></div>
        {subjects.length ? <div className="subject-grid-v10">{subjects.map(subject => (
          <article key={subject.subject}>
            <div className="subject-title-v10"><div className="subject-icon-v10"><BookOpen size={18} /></div><div><strong>{subject.subject}</strong><span>{subject.materials} material{subject.materials === 1 ? '' : 'es'} · {subject.essential} esenciales</span></div></div>
            <div className="subject-progress-v10"><span><b>{subject.mastery}%</b> dominio con evidencia</span><div><i style={{ width: `${subject.mastery}%` }} /></div></div>
            <div className="subject-meta-v10"><span>{subject.tracked}/{subject.concepts} conceptos con evidencia</span>{subject.due > 0 ? <b>{subject.due} por repasar</b> : <b className="ok">Al día</b>}</div>
          </article>
        ))}</div> : <div className="dashboard-empty-v10"><BookOpen size={28} /><h3>Tus materias aparecerán aquí</h3><p>Comprende intenta detectar automáticamente la materia desde cada documento que subes.</p></div>}
      </section>

      <section className="dashboard-two-col-v10">
        <div className="dashboard-section-v10">
          <div className="section-heading-v10"><div><span className="tiny-label">PROGRESO POR DOCUMENTO</span><h2>Qué tanto has convertido en conocimiento</h2></div><FileText size={21} /></div>
          {materials.length ? <div className="document-progress-list-v10">{materials.slice(0, 6).map(material => {
            const progress = documentProgress(material, learningMemory)
            return <article key={material.id}>
              <div className="document-progress-head-v10"><div><strong>{material.name}</strong><span>{progress.tracked}/{progress.total || '—'} esenciales con evidencia · dominio medio {progress.average}%</span></div><button onClick={() => onOpenMap(material.id)} title="Abrir mapa"><Network size={16} /></button></div>
              <div className="document-progress-bar-v10"><span style={{ width: `${progress.percent}%` }} /></div>
              <div className="document-progress-foot-v10"><span>{progress.mastered} sólidos</span><b>{progress.percent}% de esenciales dominados</b></div>
            </article>
          })}</div> : <div className="dashboard-empty-v10 compact"><FileText size={25} /><p>Aún no hay documentos para medir.</p></div>}
        </div>

        <div className="dashboard-section-v10">
          <div className="section-heading-v10"><div><span className="tiny-label">ACTIVIDAD RECIENTE</span><h2>Lo último que recuperaste</h2></div><History size={21} /></div>
          {recent.length ? <div className="recent-list-v10">{recent.map(record => (
            <button key={record.id} onClick={() => onOpenConcept(record.materialId, record.concept)}>
              <div className="recent-score-v10">{record.mastery}%</div>
              <div><strong>{record.concept}</strong><span>{record.materialName}</span><small>{new Date(record.lastReviewedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · {record.lastEvent === 'teachback' ? 'Explicación' : record.lastEvent === 'practice' ? 'Práctica' : record.lastEvent === 'lab' ? 'Laboratorio' : 'Repaso'}</small></div>
              <ArrowRight size={14} />
            </button>
          ))}</div> : <div className="dashboard-empty-v10 compact"><BrainCircuit size={25} /><p>La actividad aparece cuando completas práctica o “Explícamelo tú”.</p></div>}
        </div>
      </section>

      <section className="portable-data-v10">
        <div className="portable-copy-v10"><div className="portable-icon-v10"><CheckCircle2 size={20} /></div><div><span className="tiny-label">TUS DATOS SON PORTÁTILES</span><h3>Respalda Comprende antes de cambiar de navegador o equipo</h3><p>Esta versión sigue siendo local-first. El respaldo incluye materiales procesados, mapas semánticos y memoria de aprendizaje en un solo archivo JSON.</p>{importMessage && <strong className="import-message-v10">{importMessage}</strong>}</div></div>
        <div className="portable-actions-v10"><button className="secondary-button" onClick={exportData}><Download size={15} /> Exportar respaldo</button><button className="secondary-button" onClick={() => importRef.current?.click()}><Import size={15} /> Restaurar</button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={e => importData(e.target.files?.[0])} /></div>
      </section>
    </div>
  )
}
