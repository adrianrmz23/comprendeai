import type { GenericLabTemplate, LabDefinition, LabNarrative, LabRecommendation, LabType, SpecializedLabType } from './types'

export const LAB_TYPES: SpecializedLabType[] = [
  'bayes','bayesian-network','hmm','fuzzy','conditional-probability','distribution','monte-carlo','naive-bayes','dempster-shafer','regression','classification',
]

export const definitions: Record<SpecializedLabType, LabDefinition> = {
  bayes: { type:'bayes', title:'Laboratorio de Teorema de Bayes', shortTitle:'Bayes Lab', practiceMode:'experiment', description:'Manipula prevalencia, sensibilidad y falsos positivos para ver cómo cambia la probabilidad posterior.', estimatedMinutes:8, goals:['Distinguir prior y posterior','Interpretar sensibilidad y falsos positivos','Predecir cómo cambia la evidencia'] },
  'bayesian-network': { type:'bayesian-network', title:'Laboratorio de Redes Bayesianas', shortTitle:'Bayesian Network Lab', practiceMode:'builder', description:'Edita probabilidades, activa evidencia y observa cómo una red fija actualiza una hipótesis sin canvas libre.', estimatedMinutes:10, goals:['Leer nodos y dependencias','Modificar una CPT sencilla','Hacer inferencia con evidencia'] },
  hmm: { type:'hmm', title:'Laboratorio de Modelos Ocultos de Markov', shortTitle:'HMM Lab', practiceMode:'step_by_step', description:'Construye una secuencia de observaciones y usa Viterbi para inferir los estados ocultos más probables.', estimatedMinutes:10, goals:['Separar estado oculto y observación','Entender transición y emisión','Interpretar una ruta de Viterbi'] },
  fuzzy: { type:'fuzzy', title:'Laboratorio de Lógica Difusa', shortTitle:'Fuzzy Lab', practiceMode:'simulation', description:'Mueve variables del mundo real y observa grados de pertenencia, reglas activadas y una salida gradual.', estimatedMinutes:9, goals:['Entender grados de pertenencia','Combinar reglas difusas','Comparar salida gradual vs. decisión binaria'] },
  'conditional-probability': { type:'conditional-probability', title:'Laboratorio de Probabilidad Condicional', shortTitle:'Condicional Lab', practiceMode:'experiment', description:'Construye una población con dos eventos y observa cómo cambiar la condición cambia el universo de referencia.', estimatedMinutes:7, goals:['Distinguir P(A|B) de P(B|A)','Trabajar con frecuencias naturales','Reconocer el universo condicionado'] },
  distribution: { type:'distribution', title:'Laboratorio de Distribuciones', shortTitle:'Distribution Lab', practiceMode:'visualization', description:'Mueve media, desviación y un valor de corte para visualizar posición relativa, dispersión y probabilidad acumulada.', estimatedMinutes:8, goals:['Interpretar media y desviación','Leer un puntaje z','Relacionar dispersión con probabilidad'] },
  'monte-carlo': { type:'monte-carlo', title:'Laboratorio de Monte Carlo', shortTitle:'Monte Carlo Lab', practiceMode:'simulation', description:'Aumenta el número de muestras y observa cómo una estimación aleatoria converge hacia un valor estable.', estimatedMinutes:8, goals:['Entender muestreo repetido','Observar convergencia','Relacionar muestra y error'] },
  'naive-bayes': { type:'naive-bayes', title:'Laboratorio de Naive Bayes', shortTitle:'Naive Bayes Lab', practiceMode:'case', description:'Activa evidencias de un mensaje y observa cómo cada característica modifica la probabilidad de una clase.', estimatedMinutes:9, goals:['Interpretar priors','Combinar likelihoods','Comprender la hipótesis de independencia condicional'] },
  'dempster-shafer': { type:'dempster-shafer', title:'Laboratorio de Dempster-Shafer', shortTitle:'Evidence Lab', practiceMode:'experiment', description:'Combina evidencia de dos sensores y separa creencia, plausibilidad, conflicto e ignorancia.', estimatedMinutes:10, goals:['Representar ignorancia explícita','Combinar masas de evidencia','Distinguir creencia y plausibilidad'] },
  regression: { type:'regression', title:'Laboratorio de Regresión Lineal', shortTitle:'Regression Lab', practiceMode:'experiment', description:'Modifica un dato extremo y observa cómo cambian pendiente, intercepto, residuos y R².', estimatedMinutes:9, goals:['Interpretar pendiente','Entender residuos','Observar el efecto de outliers'] },
  classification: { type:'classification', title:'Laboratorio de Métricas de Clasificación', shortTitle:'Classification Lab', practiceMode:'simulation', description:'Mueve el umbral de decisión y observa matriz de confusión, precisión, recall, F1 y accuracy.', estimatedMinutes:9, goals:['Leer una matriz de confusión','Entender el trade-off precisión/recall','Elegir un umbral según el objetivo'] },
}

const noLab = (reason = 'Este concepto se beneficia más de explicación, práctica o active recall que de una simulación.'): LabRecommendation => ({ recommended:false, engine:'none', labType:'none', genericTemplate:'none', practiceMode:'none', priority:'none', reason, confidence:70 })
const specialized = (labType: SpecializedLabType, practiceMode: LabRecommendation['practiceMode'], reason: string, priority: LabRecommendation['priority']='high', confidence=88): LabRecommendation => ({ recommended:true, engine:'specialized', labType, genericTemplate:'none', practiceMode, priority, reason, confidence })
const composed = (template: Exclude<GenericLabTemplate,'none'>, practiceMode: LabRecommendation['practiceMode'], reason: string, priority: LabRecommendation['priority']='medium', confidence=78): LabRecommendation => ({ recommended:true, engine:'composed', labType:'generic', genericTemplate:template, practiceMode, priority, reason, confidence })

export function inferLabRecommendation(concept: string, description = ''): LabRecommendation {
  const c = `${concept} ${description}`.toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/naive\s+bayes|clasificador\s+bayesiano\s+ingenuo/.test(c)) return specialized('naive-bayes','case','Permite experimentar con priors, evidencia y la hipótesis de independencia condicional.')
  if (/teorema\s+de\s+bayes|inferencia\s+bayesiana|probabilidad\s+posterior/.test(c)) return specialized('bayes','experiment','La intuición mejora al modificar prior, calidad de evidencia y posterior.')
  if (/red(es)?\s+bayesian|grafo\s+probabilistico|tabla\s+de\s+probabilidad\s+condicional|\bcpt\b/.test(c)) return specialized('bayesian-network','builder','Las dependencias y la propagación de evidencia se comprenden mejor manipulando una red.')
  if (/modelo(s)?\s+oculto(s)?\s+de\s+markov|\bhmm\b|viterbi|emision(es)?|estado(s)?\s+oculto/.test(c)) return specialized('hmm','step_by_step','Conviene observar una secuencia y reconstruir estados ocultos paso a paso.')
  if (/logica\s+difusa|fuzzy|funcion(es)?\s+de\s+pertenencia|fuzzificacion|defuzzificacion/.test(c)) return specialized('fuzzy','simulation','Los grados de pertenencia y reglas son más intuitivos al mover entradas continuas.')
  if (/probabilidad\s+condicional|independencia\s+condicional/.test(c)) return specialized('conditional-probability','experiment','Cambiar el universo condicionado hace visible la dirección de una probabilidad condicional.')
  if (/monte\s+carlo|muestreo\s+aleatorio|simulacion\s+estocastica/.test(c)) return specialized('monte-carlo','simulation','La convergencia por muestreo repetido necesita observarse en acción.')
  if (/dempster[-\s]?shafer|teoria\s+de\s+la\s+evidencia|factor(es)?\s+de\s+certeza|creencia\s+y\s+plausibilidad/.test(c)) return specialized('dempster-shafer','experiment','Permite visualizar conflicto e ignorancia al combinar fuentes de evidencia.')
  if (/distribucion\s+normal|distribucion(es)?\s+de\s+probabilidad|variable\s+aleatoria|desviacion\s+estandar|puntaje\s+z|z[-\s]?score/.test(c)) return specialized('distribution','visualization','La forma, dispersión y posición relativa se aprenden mejor de manera visual.')
  if (/regresion\s+lineal|minimos\s+cuadrados|coeficiente\s+de\s+determinacion|\br2\b|residuo(s)?/.test(c)) return specialized('regression','experiment','La relación entre puntos, recta, residuos y outliers es inherentemente visual.')
  if (/matriz\s+de\s+confusion|precision|recall|sensibilidad|especificidad|\bf1\b|curva\s+roc|umbral\s+de\s+clasificacion|metricas\s+de\s+clasificacion/.test(c)) return specialized('classification','simulation','Mover el umbral permite observar directamente los trade-offs entre métricas.')

  // Composer universal: si no existe un motor especializado, asigna una plantilla segura.
  if (/tabla\s+de\s+verdad|proposicion|operador\s+logico|conjuncion|disyuncion|implicacion|logica\s+proposicional/.test(c)) return composed('truth-table','experiment','La lógica se vuelve tangible al cambiar valores de verdad y observar consecuencias.', 'high', 88)
  if (/matriz|vector|transformacion\s+lineal|algebra\s+lineal|componente\s+principal|\bpca\b/.test(c)) return composed('matrix-explorer','visualization','La estructura se comprende mejor observando cómo filas, columnas o vectores transforman información.', 'high', 84)
  if (/ontolog|red\s+semantica|jerarquia|taxonomia|grafo|nodo|arista|relacion(es)?\s+entre/.test(c)) return composed('relationship-map','builder','La estructura conceptual se entiende mejor manipulando y leyendo relaciones explícitas.', 'high', 84)
  if (/algoritmo|busqueda\s+(a\*|bfs|dfs)|descenso\s+de\s+gradiente|backpropagation|propagacion|pipeline|flujo|proceso|etapas|paso\s+a\s+paso/.test(c)) return composed('process-stepper','step_by_step','Seguir el proceso por etapas ayuda a entender qué cambia en cada transición.', 'high', 83)
  if (/clasificar|clasificacion\s+conceptual|categorias|tipos\s+de|distinguir|diferencia\s+entre/.test(c)) return composed('classification-sort','case','Clasificar ejemplos obliga a usar los criterios del concepto y no solo repetirlos.', 'medium', 78)
  if (/secuencia|orden|ciclo|fases|estados|transicion/.test(c)) return composed('sequence-builder','step_by_step','Ordenar estados o fases hace visible la lógica temporal o causal.', 'medium', 77)
  if (/comparar|versus|vs\.?|diferencias|ventajas|desventajas|alternativas/.test(c)) return composed('comparison','case','Comparar casos hace visibles las condiciones en las que cada alternativa cambia.', 'medium', 75)
  if (/funcion|ecuacion|tasa|coeficiente|parametro|optimiza|umbral|variable|modelo\s+matematico/.test(c)) return composed('parameter-explorer','experiment','Modificar parámetros permite observar sensibilidad y relaciones sin depender de memorización.', 'medium', 74)
  if (/modelo|mecanismo|sistema|arquitectura|metodo|tecnica/.test(c)) return composed('concept-simulator','case','Una experiencia componible puede representar entradas, transformación y resultados del concepto.', 'low', 66)
  return noLab()
}

function genericDefinition(concept: string, recommendation: LabRecommendation): LabDefinition {
  const label = recommendation.genericTemplate && recommendation.genericTemplate !== 'none' ? recommendation.genericTemplate.replace(/-/g,' ') : 'laboratorio componible'
  return { type:'generic', title:`Auto-Lab: ${concept}`, shortTitle:'Universal Auto-Lab', practiceMode: recommendation.practiceMode === 'none' ? 'case' : recommendation.practiceMode, description:`Comprende 2.0 compone una experiencia ${label} a partir del material, sin generar código arbitrario.`, estimatedMinutes:8, goals:['Experimentar con la estructura del concepto','Tomar una decisión o resolver un reto','Transferir la idea a otra situación'] }
}

export function getLabDefinition(concept: string, recommendation?: LabRecommendation | null): LabDefinition | null {
  const rec = recommendation || inferLabRecommendation(concept)
  if (!rec.recommended || rec.labType === 'none') return null
  if (rec.labType === 'generic' || rec.engine === 'composed') return genericDefinition(concept, rec)
  return definitions[rec.labType as SpecializedLabType] || null
}

export function availableLabs(concepts: Array<string | { label: string; lab?: LabRecommendation }>) {
  const seen = new Set<string>()
  return concepts.flatMap(item => {
    const concept = typeof item === 'string' ? item : item.label
    const recommendation = typeof item === 'string' ? inferLabRecommendation(concept) : (item.lab || inferLabRecommendation(concept))
    const lab = getLabDefinition(concept, recommendation)
    if (!lab) return []
    const key = `${concept}:${lab.type}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ concept, lab, recommendation }]
  })
}

export function localLabNarrative(type: LabType, concept: string): LabNarrative {
  const presets: Partial<Record<SpecializedLabType, LabNarrative>> = {
    bayes:{ id:'bayes-medical-screening-v1', title:'Una prueba positiva no siempre significa “casi seguro”', context:'Una clínica usa una prueba para detectar una enfermedad poco frecuente. Modificarás prevalencia, sensibilidad y falsos positivos para observar cuántos positivos son realmente enfermos.', mission:'Predice primero qué ocurrirá y después comprueba tu intuición con una población de 1,000 personas.', transferPrompt:'¿Qué cambiaría si la misma prueba se aplicara solo a una población de alto riesgo?' },
    'bayesian-network':{ id:'bayesian-network-diagnosis-v1', title:'Diagnóstico con señales que dependen de una causa común', context:'Una condición médica puede provocar fiebre y una prueba positiva. La condición es el nodo padre; fiebre y prueba son evidencia observable. Editarás sus probabilidades y verás cómo cambia la hipótesis.', mission:'Activa evidencia y decide cuál dato mueve más la probabilidad posterior de la condición.', transferPrompt:'¿Qué pasaría si fiebre y prueba no fueran condicionalmente independientes dada la enfermedad?' },
    hmm:{ id:'hmm-weather-v1', title:'Inferir el clima sin poder mirar por la ventana', context:'El clima real está oculto. Solo observas si una persona llega con paraguas o sin paraguas. Las transiciones modelan cómo cambia el clima y las emisiones qué observación es más probable en cada estado.', mission:'Construye una secuencia de observaciones y deja que Viterbi encuentre la secuencia de estados ocultos más probable.', transferPrompt:'¿Cómo cambiaría el resultado si usar paraguas fuera común incluso en días soleados?' },
    fuzzy:{ id:'fuzzy-climate-v1', title:'Un aire acondicionado que no piensa solo en encendido o apagado', context:'La temperatura y la humedad pueden pertenecer parcialmente a varias categorías. Verás cómo esas pertenencias activan reglas y producen una potencia gradual.', mission:'Mueve temperatura y humedad y observa cómo cambia la salida sin saltos bruscos.', transferPrompt:'¿Por qué un control difuso puede sentirse más natural que un umbral fijo?' },
    'conditional-probability':{ id:'conditional-weather-v1', title:'Cambiar la condición cambia la pregunta', context:'Un sistema meteorológico registra días lluviosos y nublados. En vez de mirar todos los días, vas a restringir el universo a los que cumplen una condición y comparar P(lluvia|nubes) con P(nubes|lluvia).', mission:'Modifica las tasas y descubre por qué invertir la condicional cambia el resultado.', transferPrompt:'¿En qué problema de diagnóstico sería peligroso confundir P(A|B) con P(B|A)?' },
    distribution:{ id:'distribution-quality-v1', title:'¿Qué tan raro es un valor dentro de una distribución?', context:'Una línea de producción tiene mediciones aproximadamente normales. Cambiarás media, dispersión y un punto de corte para interpretar qué tan extremo es un valor.', mission:'Mueve la distribución y relaciona el puntaje z con la posición relativa del dato.', transferPrompt:'¿Qué ocurriría con el mismo valor si la variabilidad del proceso se duplicara?' },
    'monte-carlo':{ id:'monte-carlo-pi-v1', title:'Estimar sin resolver la fórmula directamente', context:'Lanzarás puntos pseudoaleatorios sobre un cuadrado que contiene un círculo. La proporción que cae dentro permite aproximar π y observar la convergencia.', mission:'Aumenta las muestras y compara cómo cambia el error de la estimación.', transferPrompt:'¿Por qué Monte Carlo resulta útil cuando un problema tiene demasiadas combinaciones para resolverlo exactamente?' },
    'naive-bayes':{ id:'naive-bayes-spam-v1', title:'Un filtro de spam que combina pistas simples', context:'Un clasificador observa palabras como “gratis”, “oferta” y “reunión”. Cada palabra aporta evidencia sobre spam o correo legítimo y el modelo las combina bajo una hipótesis de independencia.', mission:'Activa palabras y observa cómo cambia la probabilidad posterior de spam.', transferPrompt:'¿Qué podría salir mal si dos características estuvieran fuertemente correlacionadas?' },
    'dempster-shafer':{ id:'dempster-sensors-v1', title:'Dos sensores no están seguros de lo mismo', context:'Dos sensores aportan evidencia sobre la presencia de un objeto, pero cada uno conserva una parte de ignorancia. Combinarás sus masas y observarás conflicto, creencia y plausibilidad.', mission:'Ajusta certeza e ignorancia y compara cómo cambia la evidencia combinada.', transferPrompt:'¿Por qué conservar “no sé” puede ser más honesto que repartir toda la masa entre sí y no?' },
    regression:{ id:'regression-sales-v1', title:'Una sola observación puede inclinar la recta', context:'Un pequeño conjunto relaciona inversión con resultado. Podrás mover un dato extremo y observar cómo cambian pendiente, residuos y R².', mission:'Experimenta con el outlier y decide cuándo la recta deja de representar bien al conjunto.', transferPrompt:'¿Qué harías antes de confiar en una regresión si detectas observaciones influyentes?' },
    classification:{ id:'classification-threshold-v1', title:'El umbral cambia qué errores estás dispuesto a aceptar', context:'Un clasificador entrega puntuaciones de riesgo. Al mover el umbral cambian verdaderos positivos, falsos positivos y las métricas resultantes.', mission:'Busca un umbral que priorice recall y después otro que priorice precisión.', transferPrompt:'¿Elegirías el mismo umbral para detectar fraude que para filtrar spam?' },
  }
  if (type !== 'generic' && presets[type]) return presets[type] as LabNarrative
  return { id:`${type}-local-v1`, title:`Experimenta con ${concept}`, context:`Este laboratorio aterriza ${concept} en una situación manipulable.`, mission:'Cambia las variables o estructura y observa qué relación permanece estable.', transferPrompt:'¿Dónde volverías a encontrar este patrón fuera del ejemplo?' }
}
