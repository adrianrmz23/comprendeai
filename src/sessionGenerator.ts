import { findRelevantExcerpts, scoreExplanation, type StudyMaterial } from './materials'

export type InteractiveCheck = {
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
}

export type SessionVisual = {
  title: string
  purpose: string
  worldExample: {
    title: string
    context: string
    decision: string
  }
  items: { label: string; detail: string }[]
  check: InteractiveCheck
}

export type GuidedStep = {
  prompt: string
  choices: string[]
  correctIndex: number
  hint: string
  explanation: string
}

export type SoloExercise = {
  id: string
  level: 'refuerzo' | 'aplicacion' | 'examen' | 'transferencia'
  scenario: string
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
}

export type StudySession = {
  concept: string
  objective: string
  estimatedMinutes: number
  hook: {
    scenario: string
    question: string
    reveal: string
  }
  intuition: {
    summary: string
    purpose: string
    example: string
    analogy: string
    keyIdea: string
    misconception: string
    context: string
  }
  visual: SessionVisual
  formal: {
    definition: string
    terms: { term: string; meaning: string }[]
    sourceEvidence: string[]
  }
  guided: {
    prompt: string
    scenario: string
    goal: string
    steps: GuidedStep[]
    takeaway: string
  }
  solo: {
    intro: string
    startIndex: number
    exercises: SoloExercise[]
  }
  teachBack: {
    prompt: string
    checklist: string[]
  }
  rescue: {
    terms: string
    formula: string
    use: string
    prereq: string
  }
}

function sentenceCase(text: string) {
  const value = text.trim().replace(/\s+/g, ' ')
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function trimSentence(text: string, max = 330) {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 180 ? lastSpace : max)}…`
}

function simplifyAcademic(text: string) {
  return sentenceCase(trimSentence(text, 290)
    .replace(/\bse define como\b/gi, 'es')
    .replace(/\bse refiere a\b/gi, 'habla de')
    .replace(/\bmediante\b/gi, 'usando')
    .replace(/\bpor consiguiente\b/gi, 'por eso')
    .replace(/\ben virtud de\b/gi, 'por')
    .replace(/\bcon respecto a\b/gi, 'sobre')
    .replace(/\bpermite llevar a cabo\b/gi, 'permite hacer'))
}

function conceptFamily(concept: string) {
  const c = concept.toLocaleLowerCase('es-MX')
  if (/bayes|probabilidad|incertidumbre|evidencia|posterior|prior|dempster|certeza/.test(c)) return 'uncertainty'
  if (/red|grafo|nodo|arista|semánt/.test(c)) return 'network'
  if (/ontolog|taxonom|jerarqu/.test(c)) return 'taxonomy'
  if (/algorit|procedim|método|monte carlo|mcmc/.test(c)) return 'process'
  if (/aprendiz|modelo|clasific|predic|markov/.test(c)) return 'model'
  return 'general'
}

function plainExplanationFor(concept: string, source: string) {
  const family = conceptFamily(concept)
  const c = concept.toLocaleLowerCase('es-MX')

  if (/^conocimiento$/.test(c.trim())) {
    return 'En Inteligencia Artificial, conocimiento es información organizada de forma que un sistema pueda usarla para interpretar una situación, relacionar conceptos, aplicar reglas o tomar decisiones. No es solo almacenar datos: implica darles estructura y significado para poder razonar con ellos.'
  }
  if (/representaci[oó]n del conocimiento|sistemas? de representaci[oó]n/.test(c)) {
    return `${concept} es la manera de convertir lo que sabemos sobre un dominio en una estructura que una computadora pueda almacenar, relacionar y utilizar para razonar. Puede hacerlo mediante reglas, redes, ontologías u otras formas de organizar conceptos y relaciones.`
  }
  if (/red(es)? semántic/.test(c)) {
    return `Una red semántica representa conocimiento como una red: los nodos son conceptos y los enlaces indican cómo se relacionan. Sirve para hacer explícitas conexiones como “es un”, “tiene”, “pertenece a” o “se relaciona con”, de modo que la información no quede como datos aislados. En tu material, la idea aparece así: ${simplifyAcademic(source)}`
  }
  if (/bayes/.test(c)) {
    return `El teorema de Bayes sirve para actualizar qué tan probable crees que es una hipótesis cuando aparece evidencia nueva. Combina lo que pensabas antes con qué tan compatible es el nuevo dato con cada posibilidad. En tu material, la idea se conecta con: ${simplifyAcademic(source)}`
  }
  if (/independencia condicional/.test(c)) {
    return `La independencia condicional significa que dos variables pueden dejar de aportarse información entre sí cuando ya conocemos una tercera variable que explica su relación. Es una idea clave para simplificar modelos probabilísticos complejos. En tu material: ${simplifyAcademic(source)}`
  }
  if (/modelo.*oculto.*markov|hmm/.test(c)) {
    return `Un Modelo Oculto de Markov intenta inferir estados que no puedes observar directamente a partir de señales que sí puedes observar y de cómo esos estados cambian con el tiempo. En tu material: ${simplifyAcademic(source)}`
  }
  if (/l[oó]gica difusa/.test(c)) {
    return `La lógica difusa permite trabajar con grados intermedios en lugar de obligar a que algo sea solo verdadero o falso. Es útil cuando las categorías del mundo real tienen límites vagos, como “caliente”, “alto” o “riesgo elevado”. En tu material: ${simplifyAcademic(source)}`
  }
  if (/monte carlo|mcmc/.test(c)) {
    return `${concept} usa muestreo repetido para aproximar respuestas cuando calcularlas exactamente sería difícil o costoso. En lugar de resolver todo de forma cerrada, simula muchos casos y aprende del patrón de resultados. En tu material: ${simplifyAcademic(source)}`
  }
  if (/dempster/.test(c)) {
    return `La teoría de Dempster-Shafer permite separar lo que apoyan las evidencias de lo que todavía ignoramos. No te obliga a repartir toda la incertidumbre entre “sí” y “no”; puede reservar una parte como desconocida. En tu material: ${simplifyAcademic(source)}`
  }
  if (family === 'uncertainty') {
    return `${concept} ayuda a razonar cuando no tienes certeza total: partes de información disponible, incorporas evidencia y ajustas la conclusión en lugar de tratarla como absoluta. En tu material: ${simplifyAcademic(source)}`
  }
  if (family === 'network') {
    return `${concept} se entiende mejor como una estructura de elementos conectados. Lo importante no es solo cada elemento, sino las relaciones entre ellos y la información que esas relaciones permiten representar o recorrer. En tu material: ${simplifyAcademic(source)}`
  }
  if (family === 'taxonomy') {
    return `${concept} sirve para organizar conocimiento mediante categorías, niveles o relaciones entre conceptos. Su valor está en dejar claro qué pertenece a qué y cómo se estructura la información. En tu material: ${simplifyAcademic(source)}`
  }
  if (family === 'process') {
    return `${concept} describe una manera ordenada de transformar una entrada o situación en un resultado mediante pasos, muestreo o decisiones. Para entenderlo, importa reconocer qué recibe, qué hace y qué produce. En tu material: ${simplifyAcademic(source)}`
  }
  if (family === 'model') {
    return `${concept} es una forma de representar o inferir patrones para producir una salida a partir de información de entrada. Para comprenderlo, fíjate en qué señales usa, qué relación modela y qué resultado entrega. En tu material: ${simplifyAcademic(source)}`
  }
  return `En sencillo, ${concept} es una idea que conviene entender por su función y sus relaciones, no solo por su definición. En tu material se expresa así: ${simplifyAcademic(source)}`
}

function purposeFor(concept: string) {
  const c = concept.toLocaleLowerCase('es-MX')
  if (/^conocimiento$/.test(c.trim())) return 'Sirve para que un sistema no solo guarde datos, sino que pueda relacionarlos y utilizarlos para inferir, responder preguntas o tomar decisiones.'
  if (/representaci[oó]n del conocimiento|sistemas? de representaci[oó]n/.test(c)) return 'Sirve para traducir información del mundo real a una forma estructurada que una computadora pueda consultar y usar al razonar.'
  if (/red(es)? semántic/.test(c)) return 'Sirve para representar conceptos y sus relaciones de forma explícita, de modo que sea más fácil recorrer conexiones e inferir información relacionada.'
  if (/bayes/.test(c)) return 'Sirve para actualizar una probabilidad cuando aparece evidencia nueva, sin ignorar lo que ya sabías antes de observarla.'
  if (/independencia condicional/.test(c)) return 'Sirve para simplificar relaciones probabilísticas: una vez conocida cierta causa o contexto, algunas variables dejan de aportar información adicional entre sí.'
  if (/hmm|modelo.*oculto.*markov/.test(c)) return 'Sirve para inferir estados ocultos que cambian con el tiempo usando observaciones indirectas, como voz, clima, actividad o señales de sensores.'
  if (/l[oó]gica difusa/.test(c)) return 'Sirve para tomar decisiones graduales cuando las categorías no tienen límites nítidos, como frío/caliente o bajo/alto.'
  if (/monte carlo|mcmc/.test(c)) return 'Sirve para aproximar probabilidades, riesgos o distribuciones complejas mediante muchas muestras o simulaciones.'
  return `Sirve para entender qué función cumple ${concept} dentro del tema y qué tipo de problema ayuda a describir o resolver.`
}

function exampleFor(concept: string) {
  const c = concept.toLocaleLowerCase('es-MX')
  if (/^conocimiento$/.test(c.trim())) return 'Ejemplo: guardar “un perro pesa 12 kg” es un dato. Saber además que “un perro es un mamífero”, que los mamíferos respiran y que ese perro pertenece a una familia concreta crea relaciones que pueden usarse para responder nuevas preguntas.'
  if (/representaci[oó]n del conocimiento|sistemas? de representaci[oó]n/.test(c)) return 'Ejemplo: un sistema médico puede representar que “influenza es una enfermedad”, “fiebre es un síntoma” y “influenza puede causar fiebre”. Así puede conectar síntomas con posibles enfermedades.'
  if (/red(es)? semántic/.test(c)) return 'Ejemplo: “Canario” se conecta con “Ave” mediante “es un”; “Ave” se conecta con “Alas” mediante “tiene”. La red permite recuperar esas relaciones sin guardar cada frase como texto aislado.'
  if (/bayes/.test(c)) return 'Ejemplo: una prueba médica positiva cambia tu estimación de enfermedad, pero el resultado también depende de qué tan frecuente era la enfermedad antes de hacer la prueba.'
  if (/hmm|modelo.*oculto.*markov/.test(c)) return 'Ejemplo: en reconocimiento de voz, el fonema real es un estado oculto y la señal acústica que llega al micrófono es la observación.'
  if (/l[oó]gica difusa/.test(c)) return 'Ejemplo: un aire acondicionado puede subir la potencia gradualmente cuando la temperatura pasa de templada a caliente, en vez de usar un único corte rígido.'
  if (/monte carlo|mcmc/.test(c)) return 'Ejemplo: una empresa puede simular miles de escenarios de demanda y retrasos para estimar la probabilidad de no cumplir una fecha de entrega.'
  return `Ejemplo: toma una situación de tu documento y pregunta qué cambia cuando aplicas ${concept}; ese cambio revela su función práctica.`
}

function analogyFor(concept: string) {
  switch (conceptFamily(concept)) {
    case 'uncertainty':
      return `Piensa en ${concept} como el trabajo de un detective: no decide por una sola pista; combina lo que ya sabía con la evidencia nueva y reajusta qué explicación parece más probable.`
    case 'network':
      return `Piensa en ${concept} como un mapa del metro: cada punto tiene sentido por sí mismo, pero lo importante aparece cuando ves qué puntos están conectados y por qué ruta viaja la información.`
    case 'taxonomy':
      return `Piensa en ${concept} como organizar una biblioteca: no basta con guardar libros; necesitas categorías y relaciones claras para saber dónde encaja cada cosa y cómo encontrarla después.`
    case 'process':
      return `Piensa en ${concept} como experimentar muchas veces en un laboratorio virtual: cada intento aporta una pequeña pieza y el patrón global te acerca a una respuesta.`
    case 'model':
      return `Piensa en ${concept} como mirar huellas para inferir algo que no puedes ver directamente. La clave está en cómo cambian las señales y qué estado las pudo producir.`
    default:
      return `Piensa en ${concept} como una pieza de un rompecabezas: primero identifica qué problema resuelve, luego con qué otras piezas se conecta y finalmente qué cambia cuando la colocas en el sistema.`
  }
}

function scenarioPack(concept: string) {
  const c = concept.toLocaleLowerCase('es-MX')

  if (/razonamiento bajo incertidumbre|tipos de incertidumbre/.test(c)) {
    return {
      title: 'Un auto autónomo ve algo en la carretera, pero sus sensores no coinciden',
      context: 'Está lloviendo. La cámara cree que hay un peatón, el radar detecta un objeto pero no lo identifica bien y el LIDAR pierde precisión por el clima. El sistema no tiene una verdad perfecta; tiene señales parciales, ruidosas y cambiantes.',
      decision: 'El vehículo debe decidir si frena, reduce velocidad o continúa mientras combina información imperfecta.',
      visualTitle: 'Señales incompletas → incertidumbre → decisión razonable',
      items: [
        { label: '1 · Observaciones', detail: 'Cámara, radar y LIDAR entregan señales distintas y con limitaciones.' },
        { label: '2 · Incertidumbre', detail: 'El sistema representa qué tan confiable es cada señal y qué hipótesis siguen siendo posibles.' },
        { label: '3 · Decisión', detail: 'Combina evidencia y costo del error para actuar de forma prudente sin exigir certeza absoluta.' },
      ],
      check: {
        question: '¿Por qué la lógica clásica “peatón / no peatón” puede quedarse corta en este momento?',
        choices: ['Porque la evidencia es incompleta y ruidosa', 'Porque un auto no puede usar sensores', 'Porque toda incertidumbre es lingüística', 'Porque la velocidad siempre es desconocida'],
        correctIndex: 0,
        explanation: 'El sistema debe actuar antes de tener información perfecta. El razonamiento bajo incertidumbre permite trabajar con grados de creencia, evidencia parcial y diferentes fuentes de incertidumbre.',
      },
      guidedGoal: 'Identificar qué clase de incertidumbre hay y decidir cómo actuar sin esperar certeza total.',
      guidedSteps: [
        { prompt: 'La cámara pierde calidad por la lluvia. ¿Qué descripción encaja mejor?', choices: ['La observación es ruidosa o imperfecta', 'La verdad dejó de existir', 'El sistema ya conoce el objeto con certeza'], correctIndex: 0, hint: 'Distingue el mundo real de la medición que hace el sensor.', explanation: 'La señal de cámara tiene calidad limitada; eso introduce incertidumbre en la evidencia disponible.' },
        { prompt: 'El radar confirma que “hay algo”, pero no qué es. ¿Qué debería hacer el sistema?', choices: ['Combinar esa señal con las demás evidencias', 'Ignorar todos los sensores', 'Elegir al azar entre peatón y bolsa'], correctIndex: 0, hint: 'Ningún sensor tiene que resolver el problema por sí solo.', explanation: 'El razonamiento bajo incertidumbre integra señales parciales en vez de depender de una observación aislada.' },
        { prompt: 'Si el costo de no frenar ante un peatón es muy alto, ¿qué acción es racional mientras persiste la duda?', choices: ['Reducir velocidad o frenar de forma preventiva', 'Acelerar hasta estar seguro', 'No hacer nada porque la probabilidad no es 100%'], correctIndex: 0, hint: 'Una decisión racional también considera las consecuencias de equivocarse.', explanation: 'No hace falta certeza absoluta para actuar. Con evidencia suficiente y un costo de error elevado, una respuesta preventiva puede ser la decisión racional.' },
      ],
      solo: [
        { id: 'rui-r', level: 'refuerzo' as const, scenario: 'Un médico tiene síntomas compatibles con varias enfermedades y aún faltan pruebas.', question: '¿Qué caracteriza la situación?', choices: ['Información incompleta sobre varias hipótesis', 'Certeza absoluta', 'Un problema sin decisiones', 'Solo vaguedad lingüística'], correctIndex: 0, explanation: 'Hay varias explicaciones posibles y evidencia insuficiente para elegir una con certeza.' },
        { id: 'rui-a', level: 'aplicacion' as const, scenario: 'Dos sensores de un robot discrepan sobre la distancia a una pared.', question: '¿Qué estrategia refleja mejor razonamiento bajo incertidumbre?', choices: ['Representar la confianza de las mediciones y combinarlas', 'Escoger siempre el primer sensor', 'Promediar sin considerar calidad', 'Ignorar el conflicto'], correctIndex: 0, explanation: 'La idea central es representar información imperfecta y combinarla de forma racional, no fingir que una señal es perfecta.' },
        { id: 'rui-e', level: 'examen' as const, scenario: 'Un dato faltante podría obtenerse con una prueba adicional.', question: '¿Qué tipo de incertidumbre describe mejor esa falta de conocimiento?', choices: ['Epistémica', 'Aleatoria necesariamente', 'Solo léxica', 'Determinista'], correctIndex: 0, explanation: 'La incertidumbre epistémica proviene de conocimiento incompleto y puede reducirse al obtener más información.' },
        { id: 'rui-t', level: 'transferencia' as const, scenario: 'Un recomendador conoce pocas interacciones de un usuario nuevo.', question: '¿Qué debería hacer en lugar de tratar su preferencia como certeza?', choices: ['Mantener hipótesis con distintos grados de confianza y actualizar con nuevas interacciones', 'Asignar una preferencia fija para siempre', 'Ignorar las nuevas evidencias', 'Elegir productos alfabéticamente'], correctIndex: 0, explanation: 'El mismo patrón aparece fuera de sensores: mantener creencias provisionales y actualizarlas cuando llega nueva evidencia.' },
      ],
    }
  }

  if (/teorema de bayes|\bbayes\b/.test(c)) {
    return {
      title: 'Una prueba médica positiva no significa 99% de enfermedad',
      context: 'Una enfermedad afecta a 1 de cada 1,000 personas. Una prueba detecta al 99% de los enfermos, pero da falso positivo al 5% de los sanos.',
      decision: 'Queremos saber qué tan convincente es realmente un resultado positivo.',
      visualTitle: 'De la prevalencia a la probabilidad posterior',
      items: [
        { label: '1 · Antes', detail: 'La enfermedad es rara: la probabilidad previa es 0.1%.' },
        { label: '2 · Evidencia', detail: 'La prueba sale positiva; también sabemos que existen falsos positivos.' },
        { label: '3 · Después', detail: 'Bayes combina ambas piezas para calcular la probabilidad posterior.' },
      ],
      check: {
        question: '¿Qué dato impide concluir “positivo = 99% de enfermedad”?',
        choices: ['La prevalencia y los falsos positivos', 'El nombre de la prueba', 'La edad del laboratorio', 'El tamaño de la fórmula'],
        correctIndex: 0,
        explanation: 'La sensibilidad sola no basta. La prevalencia y la tasa de falsos positivos cambian cuántos positivos provienen realmente de personas sanas.',
      },
      guidedGoal: 'Calcular la idea sin empezar por memorizar la fórmula.',
      guidedSteps: [
        { prompt: 'Si evaluamos a 10,000 personas, ¿cuántas esperarías enfermas con prevalencia de 0.1%?', choices: ['10', '100', '990'], correctIndex: 0, hint: '0.1% = 0.001. Multiplica 10,000 × 0.001.', explanation: 'Esperamos 10 personas enfermas.' },
        { prompt: 'Con sensibilidad de 99%, ¿aproximadamente cuántos de esos 10 enfermos darán positivo?', choices: ['1', '5', '10'], correctIndex: 2, hint: 'La prueba detecta casi todos los casos verdaderos.', explanation: '99% de 10 es 9.9: aproximadamente 10 verdaderos positivos.' },
        { prompt: 'Si 5% de 9,990 sanos da falso positivo, ¿qué grupo dominará entre los positivos?', choices: ['Los verdaderos positivos', 'Los falsos positivos', 'Serán iguales'], correctIndex: 1, hint: '5% de casi diez mil es mucho mayor que diez.', explanation: 'Habrá cerca de 500 falsos positivos frente a unos 10 verdaderos positivos. Por eso el posterior queda muy por debajo de 99%.' },
      ],
      solo: [
        { id: 'bayes-r', level: 'refuerzo' as const, scenario: 'Una enfermedad es muy rara y una prueba tiene algunos falsos positivos.', question: '¿Qué idea debes mirar antes de interpretar el positivo?', choices: ['La prevalencia previa', 'Solo la sensibilidad', 'Solo el nombre de la enfermedad', 'El orden de las letras'], correctIndex: 0, explanation: 'La prevalencia es la probabilidad previa y cambia muchísimo el significado de la evidencia.' },
        { id: 'bayes-a', level: 'aplicacion' as const, scenario: 'Dos pruebas tienen la misma sensibilidad, pero una tiene menos falsos positivos.', question: '¿Cuál hará que un positivo sea, en general, más convincente?', choices: ['La que tiene más falsos positivos', 'La que tiene menos falsos positivos', 'Siempre son idénticas', 'No depende de la prueba'], correctIndex: 1, explanation: 'Menos falsos positivos significa que una mayor proporción de los positivos proviene de casos verdaderos.' },
        { id: 'bayes-e', level: 'examen' as const, scenario: 'Un filtro antispam observa la palabra “gratis”.', question: '¿Qué representa P(spam | “gratis”)?', choices: ['Probabilidad de ver “gratis” si ya sabes que es spam', 'Probabilidad de spam después de observar “gratis”', 'Probabilidad de que nunca llegue spam', 'Frecuencia total de palabras'], correctIndex: 1, explanation: 'Es una probabilidad posterior: la hipótesis spam condicionada por la evidencia observada.' },
        { id: 'bayes-t', level: 'transferencia' as const, scenario: 'Un detector de fraude recibe una señal nueva sobre una compra.', question: '¿Qué acción refleja pensamiento bayesiano?', choices: ['Ignorar el riesgo previo', 'Actualizar el riesgo previo con la nueva evidencia', 'Convertir todo a verdadero/falso sin probabilidades', 'Usar solo la última señal'], correctIndex: 1, explanation: 'Bayes actualiza una creencia previa con evidencia nueva.' },
      ],
    }
  }

  if (/probabilidad condicional/.test(c)) {
    return {
      title: 'Un filtro de spam cambia su estimación al ver una palabra',
      context: 'Un correo cualquiera puede ser spam, pero al observar ciertas palabras cambia la probabilidad de pertenecer a esa clase.',
      decision: 'La pregunta ya no es “¿qué tan frecuente es el spam?”, sino “¿qué tan probable es spam dado lo que acabo de observar?”.',
      visualTitle: 'Evento → condición observada → probabilidad restringida',
      items: [
        { label: '1 · Universo', detail: 'Empiezas con todos los casos posibles.' },
        { label: '2 · Condición', detail: 'Te quedas solo con los casos donde ocurrió B.' },
        { label: '3 · Pregunta', detail: 'Dentro de ese subconjunto, preguntas cuántos también cumplen A.' },
      ],
      check: { question: '¿Qué significa la barra en P(A|B)?', choices: ['A o B', 'A dado que B ocurrió', 'A multiplicado por B', 'A es igual a B'], correctIndex: 1, explanation: 'La barra se lee “dado que”: restringe el análisis al contexto en el que B ya ocurrió.' },
      guidedGoal: 'Aprender a identificar cuál es el evento y cuál es la condición.',
      guidedSteps: [
        { prompt: 'La pregunta dice: “probabilidad de lluvia dado que está nublado”. ¿Cuál es la condición?', choices: ['Lluvia', 'Cielo nublado', 'El día de la semana'], correctIndex: 1, hint: 'Busca lo que aparece después de “dado que”.', explanation: 'La condición es que el cielo ya está nublado.' },
        { prompt: 'Si entre 100 días nublados llovió en 65, ¿cuál es P(lluvia|nublado)?', choices: ['20%', '65%', '100%'], correctIndex: 1, hint: 'Trabaja solo dentro de los 100 días nublados.', explanation: '65 de los 100 casos que cumplen la condición también tienen lluvia.' },
        { prompt: '¿Por qué esa cifra puede diferir de la probabilidad general de lluvia?', choices: ['Porque la evidencia cambia el subconjunto relevante', 'Porque las probabilidades dejan de existir', 'Porque B siempre causa A'], correctIndex: 0, hint: 'La condición selecciona un contexto distinto.', explanation: 'La probabilidad condicional mide A dentro del grupo donde B ya ocurrió.' },
      ],
      solo: [
        { id: 'pc-r', level: 'refuerzo' as const, scenario: 'P(compra|visitó producto)', question: '¿Qué ya sabemos?', choices: ['Que compró', 'Que visitó el producto', 'Que abandonó el sitio', 'Nada'], correctIndex: 1, explanation: 'Lo que está después de la barra es la condición conocida.' },
        { id: 'pc-a', level: 'aplicacion' as const, scenario: 'De 200 usuarios que vieron una demo, 50 contrataron.', question: '¿Cuál es P(contrata|vio demo)?', choices: ['25%', '50%', '75%', '200%'], correctIndex: 0, explanation: '50/200 = 25%.' },
        { id: 'pc-e', level: 'examen' as const, scenario: 'Compara P(A|B) y P(B|A).', question: '¿Son intercambiables?', choices: ['Sí, siempre', 'No; condicionan universos distintos', 'Solo si A es falso', 'Solo en IA'], correctIndex: 1, explanation: 'Invertir la condición cambia la pregunta y normalmente cambia el valor.' },
        { id: 'pc-t', level: 'transferencia' as const, scenario: 'Un sistema de recomendación sabe que el usuario vio tres productos de fotografía.', question: '¿Qué probabilidad condicional tendría sentido estimar?', choices: ['P(cámara | interés observado)', 'P(interés | cámara vendida mundialmente)', 'P(usuario = producto)', 'Ninguna'], correctIndex: 0, explanation: 'La evidencia observada sirve como condición para actualizar qué producto puede interesar.' },
      ],
    }
  }

  if (/independencia condicional/.test(c)) {
    return {
      title: 'Dos síntomas pueden dejar de informarse entre sí cuando ya conoces la causa',
      context: 'Fiebre y dolor de cabeza pueden aparecer juntos porque ambos dependen de una gripe. Si ya sabes que el paciente tiene gripe, observar fiebre puede aportar poco sobre el dolor de cabeza.',
      decision: 'Queremos saber cuándo una tercera variable explica la relación entre otras dos.',
      visualTitle: 'Relación aparente → condición común → independencia',
      items: [
        { label: 'Fiebre', detail: 'Se observa con frecuencia cuando hay gripe.' },
        { label: 'Gripe conocida', detail: 'Actúa como la condición que explica la relación.' },
        { label: 'Dolor de cabeza', detail: 'Una vez conocida la gripe, fiebre puede dejar de aportar información adicional.' },
      ],
      check: { question: '¿Qué afirmación describe mejor independencia condicional?', choices: ['A y B nunca se relacionan', 'A y B dejan de aportar información mutua una vez conocido C', 'C desaparece del modelo', 'A causa siempre a B'], correctIndex: 1, explanation: 'La independencia es condicional: puede aparecer solo después de fijar el valor de una tercera variable.' },
      guidedGoal: 'Reconocer qué variable está explicando una dependencia.',
      guidedSteps: [
        { prompt: 'En el ejemplo, ¿qué variable funciona como condición C?', choices: ['Fiebre', 'Gripe', 'Dolor de cabeza'], correctIndex: 1, hint: 'Es la causa que ya damos por conocida.', explanation: 'La gripe es la condición que puede explicar ambos síntomas.' },
        { prompt: 'Antes de conocer C, fiebre y dolor de cabeza pueden parecer correlacionados. ¿Por qué?', choices: ['Comparten una causa', 'Son exactamente lo mismo', 'No tienen probabilidades'], correctIndex: 0, hint: 'Piensa en una causa común.', explanation: 'La gripe aumenta la probabilidad de ambos síntomas.' },
        { prompt: '¿Por qué esta idea es útil en redes bayesianas?', choices: ['Permite simplificar dependencias', 'Obliga a conectar todos los nodos', 'Elimina todas las probabilidades'], correctIndex: 0, hint: 'Menos dependencias explícitas hacen el modelo más manejable.', explanation: 'Permite representar distribuciones complejas sin conectar cada variable con todas las demás.' },
      ],
      solo: [
        { id: 'ic-r', level: 'refuerzo' as const, scenario: 'A y B parecen relacionados por una causa C.', question: '¿Qué debes probar conceptualmente?', choices: ['Si al conocer C, A sigue aportando información sobre B', 'Si A y B tienen el mismo nombre', 'Si C es numérico', 'Si A ocurre primero'], correctIndex: 0, explanation: 'Eso distingue una dependencia directa de una relación explicada por C.' },
        { id: 'ic-a', level: 'aplicacion' as const, scenario: 'En Naive Bayes, las palabras de un documento se tratan como independientes dada la clase.', question: '¿Cuál es la condición?', choices: ['La clase', 'El tamaño del texto', 'El alfabeto', 'La fecha'], correctIndex: 0, explanation: 'La independencia se asume después de fijar la clase.' },
        { id: 'ic-e', level: 'examen' as const, scenario: 'Dos variables son independientes dado C.', question: '¿Qué implica?', choices: ['P(A,B|C)=P(A|C)P(B|C)', 'P(A)=P(B)', 'P(C)=0', 'A=B'], correctIndex: 0, explanation: 'Esa factorización expresa formalmente la independencia condicional.' },
        { id: 'ic-t', level: 'transferencia' as const, scenario: 'Un modelo médico conoce el diagnóstico y evalúa dos síntomas.', question: '¿Cuándo podrías modelarlos de forma más simple?', choices: ['Si son aproximadamente independientes dado el diagnóstico', 'Si ambos tienen nombres cortos', 'Si siempre ocurren juntos sin importar la causa', 'Nunca'], correctIndex: 0, explanation: 'Condicionar en la causa puede permitir una factorización más simple.' },
      ],
    }
  }

  if (/redes? bayesianas|inferencia en redes bayesianas/.test(c)) {
    return {
      title: 'Un sistema médico conecta enfermedades, síntomas y pruebas',
      context: 'En lugar de evaluar cada dato aislado, una red representa qué variables dependen de cuáles y usa evidencia observada para actualizar probabilidades.',
      decision: 'Queremos estimar una causa probable a partir de síntomas y resultados de prueba.',
      visualTitle: 'Causa → variables observables → inferencia',
      items: [
        { label: 'Enfermedad', detail: 'Nodo que representa una hipótesis o causa.' },
        { label: 'Síntomas / prueba', detail: 'Nodos observables relacionados mediante dependencias condicionales.' },
        { label: 'Inferencia', detail: 'La evidencia observada actualiza probabilidades de los nodos de interés.' },
      ],
      check: { question: '¿Qué representa una arista en una red bayesiana?', choices: ['Una dependencia causal o condicional modelada', 'Un color decorativo', 'Una certeza absoluta', 'Una página del PDF'], correctIndex: 0, explanation: 'Las aristas codifican dependencias; junto con las CPT definen cómo se relacionan las variables.' },
      guidedGoal: 'Construir mentalmente una mini red y usar evidencia.',
      guidedSteps: [
        { prompt: 'En un sistema de fraude, ¿qué variable tiene sentido como hipótesis central?', choices: ['Fraude', 'Color de la interfaz', 'Número de página'], correctIndex: 0, hint: 'Busca la variable que quieres inferir.', explanation: 'Fraude es una hipótesis natural; otras señales pueden depender de ella.' },
        { prompt: 'Compra en extranjero y monto alto serían…', choices: ['Evidencias observables', 'Sinónimos de fraude', 'Variables inútiles'], correctIndex: 0, hint: 'Son señales que el sistema puede observar.', explanation: 'Funcionan como evidencia asociada probabilísticamente a fraude.' },
        { prompt: 'Si observas ambas señales, ¿qué hace la inferencia?', choices: ['Actualiza P(Fraude|evidencia)', 'Borra el prior', 'Convierte todo a 0 o 1 sin cálculo'], correctIndex: 0, hint: 'La red combina estructura y probabilidades.', explanation: 'La inferencia calcula probabilidades condicionadas a la evidencia observada.' },
      ],
      solo: [
        { id: 'rb-r', level: 'refuerzo' as const, scenario: 'Una red contiene nodos y aristas.', question: '¿Qué representa un nodo?', choices: ['Una variable aleatoria', 'Una flecha', 'Un porcentaje fijo', 'Un algoritmo de ordenamiento'], correctIndex: 0, explanation: 'Los nodos representan variables del dominio.' },
        { id: 'rb-a', level: 'aplicacion' as const, scenario: 'Alarma depende de Robo y Terremoto.', question: '¿Qué tabla necesita Alarma?', choices: ['P(Alarma|Robo,Terremoto)', 'P(Alarma) sin contexto únicamente', 'Una tabla de texto libre', 'Ninguna'], correctIndex: 0, explanation: 'Su CPT debe condicionar en sus nodos padre.' },
        { id: 'rb-e', level: 'examen' as const, scenario: 'Observas que Juan llamó y quieres inferir Robo.', question: '¿Qué proceso realizas?', choices: ['Inferencia probabilística con evidencia', 'Solo clasificación alfabética', 'Defuzzificación', 'Ordenamiento'], correctIndex: 0, explanation: 'La red propaga o elimina variables para calcular la probabilidad de interés.' },
        { id: 'rb-t', level: 'transferencia' as const, scenario: 'Un auto fusiona cámara, radar y LIDAR.', question: '¿Por qué una red probabilística puede ser útil?', choices: ['Combina fuentes ruidosas y sus dependencias', 'Hace que todos los sensores sean perfectos', 'Elimina la incertidumbre física', 'Solo dibuja flechas'], correctIndex: 0, explanation: 'Permite representar incertidumbre y actualizar una estimación conjunta.' },
      ],
    }
  }

  if (/modelo.*oculto.*markov|\bhmm\b/.test(c)) {
    return {
      title: 'Reconocer voz sin observar directamente el fonema',
      context: 'El micrófono capta una señal acústica, pero el estado que realmente interesa —el fonema o palabra— no se observa de forma directa.',
      decision: 'El modelo infiere la secuencia oculta más plausible a partir de las observaciones.',
      visualTitle: 'Estado oculto → emisión observable → transición',
      items: [
        { label: 'Estado oculto', detail: 'Lo que quieres inferir pero no puedes observar directamente.' },
        { label: 'Observación', detail: 'La señal visible o medible generada por el estado.' },
        { label: 'Transición', detail: 'Modela cómo cambia el estado oculto de un momento al siguiente.' },
      ],
      check: { question: 'En reconocimiento de voz, ¿qué sería una observación?', choices: ['La señal acústica', 'El fonema oculto directamente', 'La probabilidad inicial como texto', 'Nada'], correctIndex: 0, explanation: 'La señal acústica es observable; el estado lingüístico que la produjo se infiere.' },
      guidedGoal: 'Separar claramente estados ocultos, observaciones y transiciones.',
      guidedSteps: [
        { prompt: 'Si quieres inferir el clima sin mirar afuera, ¿qué podría ser el estado oculto?', choices: ['Soleado/nublado/lluvioso', 'El paraguas', 'El color de la oficina'], correctIndex: 0, hint: 'Es la variable que no puedes observar directamente.', explanation: 'El clima es el estado oculto.' },
        { prompt: '¿Qué sería una observación útil?', choices: ['Que alguien llegue con paraguas', 'El clima real mirado directamente', 'La fecha del archivo'], correctIndex: 0, hint: 'Busca una señal visible correlacionada con el estado.', explanation: 'El paraguas es una emisión observable asociada al clima.' },
        { prompt: '¿Qué expresa P(lluvioso mañana | soleado hoy)?', choices: ['Probabilidad de transición', 'Probabilidad de emisión', 'Defuzzificación'], correctIndex: 0, hint: 'Relaciona dos estados en momentos consecutivos.', explanation: 'Es una transición entre estados.' },
      ],
      solo: [
        { id: 'hmm-r', level: 'refuerzo' as const, scenario: 'Un sistema observa señales pero no el estado que las genera.', question: '¿Qué idea central describe eso?', choices: ['Estado oculto y emisión', 'Certeza absoluta', 'Solo regresión lineal', 'Taxonomía'], correctIndex: 0, explanation: 'La separación entre estado oculto y observación es la base de HMM.' },
        { id: 'hmm-a', level: 'aplicacion' as const, scenario: 'Quieres saber la secuencia más probable de estados ocultos.', question: '¿Qué tipo de problema es?', choices: ['Decodificación', 'Fuzzificación', 'Aditividad', 'Normalización de Bayes únicamente'], correctIndex: 0, explanation: 'La decodificación busca la secuencia oculta más probable.' },
        { id: 'hmm-e', level: 'examen' as const, scenario: 'Dado un HMM y una secuencia de observaciones, quieres su probabilidad.', question: '¿Qué problema conceptual resuelves?', choices: ['Evaluación', 'Clasificación jerárquica', 'Dempster-Shafer', 'Taxonomía'], correctIndex: 0, explanation: 'La evaluación calcula qué tan probable es observar esa secuencia bajo el modelo.' },
        { id: 'hmm-t', level: 'transferencia' as const, scenario: 'Un robot estima una posición real a partir de sensores ruidosos en el tiempo.', question: '¿Qué característica hace razonable un modelo de estados?', choices: ['Hay un estado latente que evoluciona y produce observaciones', 'Todo es completamente observable', 'No existe temporalidad', 'Las señales son siempre exactas'], correctIndex: 0, explanation: 'La dinámica temporal y la observación indirecta encajan con la lógica de modelos de estado.' },
      ],
    }
  }

  if (/l[oó]gica difusa|conjuntos difusos|funci[oó]n de pertenencia|fuzzificaci[oó]n/.test(c)) {
    return {
      title: 'Un aire acondicionado que no piensa solo en “frío” o “caliente”',
      context: 'La temperatura de 27 °C puede ser “templada” en cierto grado y “caliente” en otro. El controlador usa esos grados para ajustar la potencia suavemente.',
      decision: 'Queremos una salida gradual en vez de un interruptor rígido.',
      visualTitle: 'Valor real → grados de pertenencia → regla → salida',
      items: [
        { label: 'Entrada', detail: 'Un valor nítido, por ejemplo 27 °C.' },
        { label: 'Fuzzificación', detail: 'Convierte el valor en grados de pertenencia a etiquetas como templado/caliente.' },
        { label: 'Decisión', detail: 'Las reglas difusas producen una salida que después puede volver a un valor numérico.' },
      ],
      check: { question: '¿Qué ventaja aporta la lógica difusa aquí?', choices: ['Permite transiciones graduales', 'Obliga a usar solo 0 o 1', 'Hace desaparecer los sensores', 'Convierte temperatura en texto únicamente'], correctIndex: 0, explanation: 'Los grados de pertenencia modelan fronteras suaves entre categorías vagas.' },
      guidedGoal: 'Pasar de una medida concreta a una decisión gradual.',
      guidedSteps: [
        { prompt: 'Si 27 °C pertenece 0.7 a “caliente” y 0.4 a “templado”, ¿puede pertenecer a ambas etiquetas?', choices: ['Sí', 'No, nunca', 'Solo si vale 1'], correctIndex: 0, hint: 'Los conjuntos difusos pueden solaparse.', explanation: 'Una misma entrada puede tener distintos grados de pertenencia.' },
        { prompt: 'Regla: SI temperatura alta Y humedad alta, ENTONCES potencia alta. ¿Qué hace la inferencia?', choices: ['Combina los grados de las condiciones', 'Ignora las entradas', 'Convierte todo a verdadero absoluto'], correctIndex: 0, hint: 'Las reglas operan sobre grados, no solo sobre sí/no.', explanation: 'La inferencia calcula la fuerza con la que se activa cada regla.' },
        { prompt: '¿Para qué sirve la defuzzificación?', choices: ['Convertir la conclusión difusa en una salida numérica', 'Eliminar todas las reglas', 'Crear el PDF'], correctIndex: 0, hint: 'El actuador necesita un valor concreto.', explanation: 'Transforma los resultados difusos en una salida nítida, como porcentaje de potencia.' },
      ],
      solo: [
        { id: 'fz-r', level: 'refuerzo' as const, scenario: 'Una persona de 1.79 m puede ser “alta” en grado 0.9.', question: '¿Qué idea muestra?', choices: ['Grado de pertenencia', 'Probabilidad condicional', 'Estado oculto', 'Axioma de aditividad'], correctIndex: 0, explanation: 'La pertenencia difusa permite valores continuos entre 0 y 1.' },
        { id: 'fz-a', level: 'aplicacion' as const, scenario: 'Un freno autónomo debe aumentar suavemente su fuerza al acercarse a un obstáculo.', question: '¿Qué enfoque encaja mejor?', choices: ['Reglas difusas con grados de cercanía', 'Un único corte rígido siempre', 'Naive Bayes por obligación', 'Ninguno'], correctIndex: 0, explanation: 'La lógica difusa es útil cuando una respuesta gradual refleja mejor el problema.' },
        { id: 'fz-e', level: 'examen' as const, scenario: 'μalto(x)=0.7.', question: '¿Qué representa 0.7?', choices: ['Grado de pertenencia a “alto”', '70% de probabilidad necesariamente', 'Un estado oculto', 'Una frecuencia absoluta'], correctIndex: 0, explanation: 'Es grado de pertenencia, no necesariamente probabilidad.' },
        { id: 'fz-t', level: 'transferencia' as const, scenario: 'Un banco usa etiquetas “riesgo bajo/medio/alto” con fronteras suaves.', question: '¿Qué beneficio obtiene?', choices: ['Modela transiciones graduales entre categorías', 'Elimina toda incertidumbre', 'Obliga a que un cliente pertenezca a una sola etiqueta', 'Convierte reglas en grafos'], correctIndex: 0, explanation: 'Los conjuntos difusos manejan mejor categorías lingüísticas con límites imprecisos.' },
      ],
    }
  }

  if (/monte carlo|mcmc/.test(c)) {
    return {
      title: 'Estimar un riesgo simulando miles de futuros posibles',
      context: 'Una empresa no puede calcular exactamente todas las combinaciones de demanda, retrasos y costos, así que simula muchos escenarios y observa la distribución de resultados.',
      decision: 'Queremos una aproximación útil cuando una solución analítica es difícil.',
      visualTitle: 'Modelo → muchas muestras → distribución de resultados',
      items: [
        { label: '1 · Modelo', detail: 'Defines qué variables pueden cambiar y con qué probabilidades.' },
        { label: '2 · Muestreo', detail: 'Generas muchos escenarios aleatorios posibles.' },
        { label: '3 · Estimación', detail: 'Usas la frecuencia y distribución de resultados para aproximar la respuesta.' },
      ],
      check: { question: '¿Por qué repetir muchas simulaciones?', choices: ['Para aproximar el comportamiento global del sistema', 'Para garantizar que cada escenario ocurra', 'Para eliminar el azar', 'Solo para hacer gráficos'], correctIndex: 0, explanation: 'El muestreo repetido permite estimar cantidades que serían difíciles de calcular directamente.' },
      guidedGoal: 'Entender qué se simula, qué se observa y qué se estima.',
      guidedSteps: [
        { prompt: 'Quieres estimar retrasos de entrega. ¿Qué conviene variar en cada simulación?', choices: ['Demanda, tiempos y fallas según sus distribuciones', 'El nombre de la empresa', 'Nada'], correctIndex: 0, hint: 'Muestrea las fuentes reales de incertidumbre.', explanation: 'Las variables inciertas deben cambiar entre escenarios.' },
        { prompt: 'Después de 10,000 simulaciones, 1,500 incumplen la fecha. ¿Estimación de incumplimiento?', choices: ['15%', '1.5%', '85%'], correctIndex: 0, hint: 'Divide incumplimientos entre simulaciones.', explanation: '1,500 / 10,000 = 15%.' },
        { prompt: '¿Qué mejora normalmente al aumentar el número de muestras?', choices: ['La estabilidad de la estimación', 'La certeza absoluta', 'La velocidad siempre', 'El número de variables observables'], correctIndex: 0, hint: 'Más muestras reducen parte del ruido de muestreo.', explanation: 'La estimación suele estabilizarse, aunque el costo computacional crece.' },
      ],
      solo: [
        { id: 'mc-r', level: 'refuerzo' as const, scenario: 'Simulas muchas veces un sistema incierto.', question: '¿Qué buscas?', choices: ['Aproximar una cantidad o distribución', 'Eliminar toda incertidumbre', 'Memorizar fórmulas', 'Crear relaciones semánticas'], correctIndex: 0, explanation: 'Monte Carlo aproxima resultados mediante muestreo repetido.' },
        { id: 'mc-a', level: 'aplicacion' as const, scenario: 'Un videojuego evalúa millones de posibles jugadas.', question: '¿Qué idea de Monte Carlo aparece?', choices: ['Explorar escenarios por muestreo', 'Convertir todos los estados a texto', 'Usar solo una jugada', 'No usar probabilidades'], correctIndex: 0, explanation: 'El muestreo puede explorar un espacio enorme sin enumerarlo por completo.' },
        { id: 'mc-e', level: 'examen' as const, scenario: 'MCMC genera muestras de una distribución compleja.', question: '¿Qué añade la cadena de Markov?', choices: ['Una forma de recorrer estados para obtener muestras de la distribución objetivo', 'Una certeza matemática sin muestras', 'Un árbol semántico', 'Una regla difusa'], correctIndex: 0, explanation: 'MCMC diseña una cadena cuya distribución estacionaria coincide con la distribución objetivo.' },
        { id: 'mc-t', level: 'transferencia' as const, scenario: 'Un equipo quiere estimar riesgo financiero sin fórmula cerrada.', question: '¿Qué estrategia encaja?', choices: ['Simular muchos escenarios y resumir resultados', 'Elegir un solo escenario promedio', 'Ignorar variables inciertas', 'Clasificar alfabéticamente'], correctIndex: 0, explanation: 'Ese es un uso típico de simulación Monte Carlo.' },
      ],
    }
  }

  if (/dempster|factores? de certeza/.test(c)) {
    return {
      title: 'Dos sensores discrepan y todavía hay información desconocida',
      context: 'Un sensor apoya la hipótesis de intruso, otro aporta evidencia más débil y ninguno cubre todo lo que podría estar ocurriendo.',
      decision: 'Necesitamos representar apoyo, oposición e ignorancia sin fingir que conocemos todo.',
      visualTitle: 'Evidencia → grado de apoyo → espacio de ignorancia',
      items: [
        { label: 'Evidencia disponible', detail: 'Los sensores aportan señales parciales y posiblemente contradictorias.' },
        { label: 'Creencia', detail: 'Parte de la evidencia apoya una hipótesis.' },
        { label: 'Ignorancia explícita', detail: 'Lo no explicado puede conservarse como desconocido en vez de repartirse a la fuerza.' },
      ],
      check: { question: '¿Qué ventaja tiene representar ignorancia explícitamente?', choices: ['No obliga a fingir una certeza que la evidencia no aporta', 'Hace que todas las hipótesis sumen cero', 'Elimina la necesidad de sensores', 'Convierte incertidumbre en lógica clásica'], correctIndex: 0, explanation: 'Separar desconocimiento de evidencia negativa puede representar mejor información incompleta.' },
      guidedGoal: 'Distinguir ausencia de apoyo de evidencia en contra.',
      guidedSteps: [
        { prompt: 'Un sensor apoya “intruso” con 60%, otro 10% “no intruso”, y queda 30% sin resolver. ¿Qué representa ese 30%?', choices: ['Ignorancia', 'Certeza de no intruso', 'Error de suma'], correctIndex: 0, hint: 'No toda la masa tiene que adjudicarse a una hipótesis concreta.', explanation: 'Ese margen representa lo que la evidencia todavía no permite decidir.' },
        { prompt: '¿Es “no tengo evidencia” lo mismo que “tengo evidencia de que es falso”?', choices: ['No', 'Sí siempre', 'Solo en redes semánticas'], correctIndex: 0, hint: 'Ausencia de prueba no equivale a prueba de ausencia.', explanation: 'La distinción es central cuando queremos representar ignorancia.' },
        { prompt: '¿Cuándo resulta útil este enfoque?', choices: ['Cuando fuentes parciales dejan incertidumbre no asignada', 'Solo cuando todo es conocido', 'Solo con datos deterministas'], correctIndex: 0, hint: 'Piensa en sensores incompletos o diagnósticos con información parcial.', explanation: 'Es especialmente útil cuando la evidencia no justifica repartir toda la creencia entre opciones concretas.' },
      ],
      solo: [
        { id: 'ds-r', level: 'refuerzo' as const, scenario: 'La evidencia no alcanza para decidir entre dos hipótesis.', question: '¿Qué puede conservar Dempster-Shafer?', choices: ['Un margen de ignorancia', 'Una certeza inventada', 'Solo 0 o 1', 'Nada'], correctIndex: 0, explanation: 'El marco permite representar explícitamente lo que todavía no se sabe.' },
        { id: 'ds-a', level: 'aplicacion' as const, scenario: 'Cámara y radar aportan evidencia incompleta sobre un objeto.', question: '¿Qué beneficio ofrece representar masas de evidencia?', choices: ['Combinar apoyo sin borrar la incertidumbre restante', 'Hacer perfectos los sensores', 'Evitar cualquier cálculo', 'Convertir el radar en cámara'], correctIndex: 0, explanation: 'La teoría permite combinar evidencia y conservar incertidumbre residual.' },
        { id: 'ds-e', level: 'examen' as const, scenario: 'Creencia en H y creencia en ¬H no suman 1.', question: '¿Qué puede representar la diferencia restante?', choices: ['Ignorancia', 'Un error obligatorio', 'Una probabilidad negativa', 'Una arista'], correctIndex: 0, explanation: 'Ese espacio puede representar información todavía no comprometida.' },
        { id: 'ds-t', level: 'transferencia' as const, scenario: 'Un sistema de seguridad recibe señales débiles y contradictorias.', question: '¿Qué sería más prudente?', choices: ['Separar apoyo, oposición e ignorancia', 'Forzar 100% a la opción más alta', 'Ignorar conflictos', 'Eliminar sensores'], correctIndex: 0, explanation: 'Ese tratamiento evita convertir evidencia insuficiente en certeza artificial.' },
      ],
    }
  }

  if (/naive bayes/.test(c)) {
    return {
      title: 'Clasificar spam combinando palabras como evidencia',
      context: 'El clasificador estima qué tan probable es cada clase y combina evidencias como “gratis”, “oferta” o “reunión” suponiendo independencia condicional dada la clase.',
      decision: 'Queremos elegir la clase con mayor probabilidad posterior.',
      visualTitle: 'Clase previa → evidencias → puntuación posterior',
      items: [
        { label: 'Prior de clase', detail: 'Qué tan frecuente es spam o legítimo antes de mirar las palabras.' },
        { label: 'Características', detail: 'Cada palabra aporta una verosimilitud condicionada a la clase.' },
        { label: 'Posterior', detail: 'Se combinan las evidencias y se elige la clase más probable.' },
      ],
      check: { question: '¿Qué hace “naive” al modelo?', choices: ['Asume independencia condicional entre características dada la clase', 'Ignora Bayes', 'No usa probabilidades', 'Solo funciona con imágenes'], correctIndex: 0, explanation: 'La simplificación central es tratar las características como independientes condicionadas en la clase.' },
      guidedGoal: 'Ver cómo una clasificación se construye a partir de prior y evidencias.',
      guidedSteps: [
        { prompt: 'Si 40% de los correos son spam, ¿qué representa 0.40?', choices: ['P(spam), el prior', 'P(palabra|spam)', 'La precisión del modelo'], correctIndex: 0, hint: 'Es la frecuencia antes de mirar palabras.', explanation: 'Es la probabilidad previa de la clase spam.' },
        { prompt: 'La palabra “gratis” aparece mucho más en spam. ¿Qué aporta?', choices: ['Evidencia a favor de spam', 'Certeza absoluta', 'Una arista causal necesariamente'], correctIndex: 0, hint: 'Compara P(gratis|spam) con P(gratis|legítimo).', explanation: 'Una característica más probable bajo spam favorece esa clase.' },
        { prompt: '¿Qué clase se elige?', choices: ['La de mayor posterior', 'Siempre la más frecuente', 'La primera alfabéticamente'], correctIndex: 0, hint: 'Combina prior y evidencias.', explanation: 'Naive Bayes calcula una puntuación posterior para cada clase y elige la mayor.' },
      ],
      solo: [
        { id: 'nb-r', level: 'refuerzo' as const, scenario: 'Un clasificador usa Bayes.', question: '¿Qué actualiza?', choices: ['Probabilidad de una clase dada la evidencia', 'El nombre del archivo', 'La cantidad de páginas', 'Una función difusa'], correctIndex: 0, explanation: 'La salida central es una probabilidad posterior por clase.' },
        { id: 'nb-a', level: 'aplicacion' as const, scenario: '“excelente” aparece sobre todo en reseñas positivas.', question: '¿Qué efecto debería tener?', choices: ['Aumentar evidencia a favor de clase positiva', 'Forzar clase negativa', 'No influir nunca', 'Eliminar el prior'], correctIndex: 0, explanation: 'Una característica con alta verosimilitud para una clase favorece esa clase.' },
        { id: 'nb-e', level: 'examen' as const, scenario: 'Dos palabras están correlacionadas incluso dentro de una clase.', question: '¿Qué supuesto de Naive Bayes se viola?', choices: ['Independencia condicional', 'Normalización', 'Aditividad exclusiva', 'Defuzzificación'], correctIndex: 0, explanation: 'El supuesto naive considera las características condicionalmente independientes dada la clase.' },
        { id: 'nb-t', level: 'transferencia' as const, scenario: 'Clasificas tickets de soporte por tema usando palabras.', question: '¿Por qué Naive Bayes puede ser una buena línea base?', choices: ['Es simple, probabilístico y funciona bien con texto', 'No necesita datos', 'Siempre es perfecto', 'No usa características'], correctIndex: 0, explanation: 'La simplicidad y el tratamiento probabilístico de características discretas lo hacen útil como baseline de texto.' },
      ],
    }
  }

  const family = conceptFamily(concept)
  const title = family === 'network' ? `Cómo ${concept} conecta elementos en un sistema real` : `Dónde aparece ${concept} fuera del PDF`
  const context = family === 'network'
    ? `Imagina un sistema que necesita conectar entidades y relaciones para responder preguntas. ${concept} organiza esas conexiones para que no queden como datos aislados.`
    : `Imagina que un equipo debe tomar una decisión o explicar un fenómeno usando ${concept}. La idea cobra sentido cuando identificas qué entrada recibe, qué transforma y qué resultado permite obtener.`
  return {
    title,
    context,
    decision: `La pregunta práctica es: ¿qué puedo hacer o explicar gracias a ${concept} que antes no podía?`,
    visualTitle: `Entrada → ${concept} → resultado`,
    items: [
      { label: 'Situación', detail: 'Existe un problema concreto, información disponible o una pregunta que responder.' },
      { label: concept, detail: `La idea organiza, transforma o relaciona la información relevante.` },
      { label: 'Resultado', detail: 'Obtienes una explicación, estructura o decisión que antes no estaba explícita.' },
    ],
    check: { question: `¿Qué demuestra mejor que entendiste ${concept}?`, choices: ['Poder aplicarlo a una situación nueva', 'Repetir el título', 'Memorizar una frase sin contexto', 'Reconocer el color de la tarjeta'], correctIndex: 0, explanation: 'Transferir la idea a un caso nuevo demuestra comprensión más allá del reconocimiento.' },
    guidedGoal: 'Convertir la definición en una decisión o explicación aplicada.',
    guidedSteps: [
      { prompt: '¿Qué problema intenta resolver el caso?', choices: ['Una necesidad concreta del sistema', 'Memorizar el documento', 'Cambiar el nombre del concepto'], correctIndex: 0, hint: 'Busca la pregunta o decisión que existe antes de usar el concepto.', explanation: 'Primero hay que reconocer la necesidad práctica.' },
      { prompt: `¿Qué papel cumple ${concept}?`, choices: ['Aporta una estructura o mecanismo útil', 'Es solo una etiqueta', 'No cambia nada'], correctIndex: 0, hint: 'Piensa en la función, no en la definición literal.', explanation: 'Comprender implica identificar la función que cumple la idea.' },
      { prompt: '¿Qué deberías poder observar después?', choices: ['Un resultado, relación o decisión explicable', 'Solo más texto', 'Nada diferente'], correctIndex: 0, hint: 'La aplicación debe producir algo interpretable.', explanation: 'El resultado hace visible para qué servía el concepto.' },
    ],
    solo: [
      { id: 'gen-r', level: 'refuerzo' as const, scenario: `Tienes que explicar ${concept} sin el PDF.`, question: '¿Qué conviene decir primero?', choices: ['Qué problema aborda y qué función cumple', 'El número de página', 'La tipografía', 'Una frase memorizada sin contexto'], correctIndex: 0, explanation: 'Función y problema forman una base más estable que una definición memorizada.' },
      { id: 'gen-a', level: 'aplicacion' as const, scenario: `Aparece un caso nuevo relacionado con ${concept}.`, question: '¿Qué estrategia demuestra transferencia?', choices: ['Identificar señales del caso y decidir si el concepto aplica', 'Buscar exactamente la misma frase', 'Ignorar el contexto', 'Responder al azar'], correctIndex: 0, explanation: 'La transferencia requiere reconocer la estructura del problema, no la redacción exacta.' },
      { id: 'gen-e', level: 'examen' as const, scenario: `Te preguntan por ${concept} en un examen oral.`, question: '¿Qué respuesta sería más sólida?', choices: ['Definición breve + función + ejemplo + relación', 'Solo el nombre', 'Solo una analogía sin explicación', 'Solo una fórmula sin interpretar'], correctIndex: 0, explanation: 'Combinar significado, función, ejemplo y relación muestra comprensión conceptual.' },
      { id: 'gen-t', level: 'transferencia' as const, scenario: `Debes usar ${concept} en un proyecto distinto al del documento.`, question: '¿Qué buscas primero?', choices: ['Una estructura de problema equivalente', 'La misma palabra exacta', 'El mismo diseño visual', 'La misma página'], correctIndex: 0, explanation: 'Transferir consiste en detectar patrones conceptuales comunes entre contextos distintos.' },
    ],
  }
}

function relatedConcepts(material: StudyMaterial, concept: string, limit = 4) {
  const semantic = material.semantic?.concepts.find(c => c.label.toLocaleLowerCase('es-MX') === concept.toLocaleLowerCase('es-MX'))
  if (semantic) {
    const combined = [...semantic.prerequisites, ...semantic.related, ...(semantic.parent ? [semantic.parent] : [])]
    const unique = [...new Set(combined)].filter(label => label.toLocaleLowerCase('es-MX') !== concept.toLocaleLowerCase('es-MX'))
    if (unique.length) return unique.slice(0, limit)
  }
  return material.concepts
    .map(c => c.label)
    .filter(label => label.toLocaleLowerCase('es-MX') !== concept.toLocaleLowerCase('es-MX'))
    .slice(0, limit)
}

export function buildLocalStudySession(material: StudyMaterial, concept: string): StudySession {
  const excerpts = findRelevantExcerpts(material.text, concept, 5)
  const evidence = excerpts.length ? excerpts : [material.text.slice(0, 700)]
  const central = evidence[0] || `${concept} aparece como un concepto relevante dentro de este material.`
  const related = relatedConcepts(material, concept)
  const real = scenarioPack(concept)

  return {
    concept,
    objective: `Comprender ${concept}, verlo funcionando en un caso real y practicar hasta poder transferirlo a una situación nueva.`,
    estimatedMinutes: 22,
    hook: {
      scenario: real.context,
      question: `Antes de resolverlo: ¿qué tendría que hacer ${concept} para ayudar en esta situación?`,
      reveal: `La meta no es recitar una definición. Debes reconocer cuándo aparece el problema, qué información usa ${concept} y qué cambia después de aplicarlo.`,
    },
    intuition: {
      summary: plainExplanationFor(concept, central),
      purpose: purposeFor(concept),
      example: exampleFor(concept),
      analogy: analogyFor(concept),
      keyIdea: `Quédate con esta pregunta: “¿qué cambia o qué puedo explicar mejor cuando entiendo ${concept}?”`,
      misconception: 'Error común: reconocer el término y creer que eso ya equivale a saber usarlo. En esta sesión vas a comprobarlo con casos y decisiones.',
      context: `El motor local usa como referencia este fragmento: ${simplifyAcademic(central)}`,
    },
    visual: {
      title: real.visualTitle,
      purpose: 'Este paso ya no es un resumen visual: sirve para ver el concepto funcionando dentro de una situación concreta antes de entrar a la práctica.',
      worldExample: { title: real.title, context: real.context, decision: real.decision },
      items: real.items,
      check: real.check,
    },
    formal: {
      definition: trimSentence(central, 470),
      terms: [
        { term: concept, meaning: 'Concepto central de esta sesión.' },
        ...related.slice(0, 3).map(label => ({ term: label, meaning: 'Concepto relacionado detectado en el mapa del documento; úsalo para construir conexiones.' })),
      ],
      sourceEvidence: evidence.slice(0, 3),
    },
    guided: {
      prompt: `Resolvamos juntos un caso real de ${concept}.`,
      scenario: real.context,
      goal: real.guidedGoal,
      steps: real.guidedSteps,
      takeaway: `Si puedes justificar cada decisión del caso, ya no estás leyendo ${concept}: estás empezando a usarlo.`,
    },
    solo: {
      intro: `Empiezas en aplicación. Si fallas, Comprende baja a un refuerzo breve; si aciertas, sube a examen y transferencia.`,
      startIndex: 1,
      exercises: real.solo,
    },
    teachBack: {
      prompt: `Explícame ${concept} como si yo fuera un compañero que faltó a clase. Incluye qué es, para qué sirve, una conexión con otra idea y un ejemplo del mundo real distinto al que acabas de practicar.`,
      checklist: [
        `Definiste ${concept} con tus palabras.`,
        'Explicaste para qué sirve o qué problema aborda.',
        `Lo conectaste con ${related[0] || 'algún concepto previo'}.`,
        'Incluiste un ejemplo nuevo o una consecuencia práctica.',
      ],
    },
    rescue: {
      terms: 'Ignora por un momento los nombres técnicos. Vuelve al caso real y describe quién observa qué, qué decisión necesita tomar y qué resultado espera. Después vuelve a poner las etiquetas formales.',
      formula: 'No memorices símbolos todavía. Explica qué representa cada entrada, qué evidencia cambia y qué debería pasar con el resultado cuando una entrada aumenta o disminuye.',
      use: `Regresa a “Verlo en acción”. La señal práctica es la pregunta que el caso necesita responder. Si ${concept} ayuda a responder esa pregunta, ya tienes una pista clara de cuándo usarlo.`,
      prereq: `Revisa primero ${related[0] || 'el concepto que aparece justo antes en el mapa'}. Si no puedes explicarlo con un ejemplo, abre su repaso de 3 minutos antes de continuar.`,
    },
  }
}

export type RecallEvaluation = {
  score: number
  verdict: string
  strengths: string[]
  missing: string[]
  misconception: string
  nextAction: string
}

export function evaluateRecallLocally(answer: string, material: StudyMaterial, concept: string, session: StudySession): RecallEvaluation {
  const source = session.formal.sourceEvidence.join(' ') || material.text.slice(0, 1400)
  const score = scoreExplanation(answer, source, concept)
  const lower = answer.toLocaleLowerCase('es-MX')
  const related = relatedConcepts(material, concept, 3)
  const strengths: string[] = []
  const missing: string[] = []

  if (answer.trim().split(/\s+/).length >= 35) strengths.push('Desarrollaste la idea con suficiente detalle para poder evaluarla.')
  else missing.push('Amplía la explicación: intenta llegar al menos a 35–50 palabras propias.')

  if (lower.includes(concept.toLocaleLowerCase('es-MX'))) strengths.push('Nombraste explícitamente el concepto central.')
  else missing.push(`Nombra ${concept} y explica su función, no solo el tema general.`)

  if (related.some(term => lower.includes(term.toLocaleLowerCase('es-MX')))) strengths.push('Conectaste la idea con otro concepto del material.')
  else missing.push(`Añade una conexión con ${related[0] || 'un concepto relacionado'}.`)

  const transferWords = ['ejemplo', 'caso', 'podría', 'sirve', 'aplica', 'cuando', 'sistema', 'situación']
  if (transferWords.some(word => lower.includes(word))) strengths.push('Incluiste señales de transferencia hacia una situación concreta.')
  else missing.push('Añade un ejemplo propio o explica cuándo usarías el concepto en el mundo real.')

  return {
    score,
    verdict: score >= 82 ? 'La idea ya se sostiene sin la fuente' : score >= 67 ? 'Vas bien, pero todavía hay huecos' : 'Aún dependes demasiado del reconocimiento',
    strengths: strengths.length ? strengths : ['Ya intentaste recuperar la idea sin copiar; ese esfuerzo sí cuenta como aprendizaje.'],
    missing: missing.length ? missing : ['Ahora añade un ejemplo propio para comprobar transferencia.'],
    misconception: score >= 70 ? 'No detecto una señal fuerte de confusión con esta evaluación local.' : 'La evaluación local no puede distinguir todavía si el problema es conceptual o de redacción; compara tu explicación con la evidencia fuente.',
    nextAction: score >= 80 ? 'Haz una situación de transferencia o vuelve mañana para un repaso espaciado.' : 'Regresa a “Verlo en acción” y “Formal”, espera un minuto y vuelve a explicarlo sin mirar.',
  }
}
