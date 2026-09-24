# Comprende 2.0 — Universal Learning Engine

Comprende 2.0 cierra la arquitectura universal de aprendizaje. El usuario solo sube un PDF. El sistema extrae el texto, construye el mapa semántico, ordena los prerrequisitos, decide cómo enseñar cada concepto y selecciona automáticamente entre tres rutas:

1. **Lab especializado**: usa uno de los motores matemáticos/algorítmicos ya programados.
2. **Auto-Lab componible**: si el tema es nuevo, la IA genera únicamente una configuración declarativa que Comprende renderiza con componentes seguros.
3. **Sin Lab**: si un laboratorio no aporta valor, mantiene explicación, caso, práctica y active recall sin forzar una simulación.

## Qué añade 2.0

### Generic Lab Composer
El motor componible puede crear experiencias a partir de:

- sliders, toggles y selects;
- métricas calculadas con un DSL matemático seguro;
- barras y curvas SVG;
- procesos paso a paso;
- mapas de relaciones;
- tablas/matrices/comparaciones;
- retos de opción, ordenamiento, clasificación y matching.

La IA **no genera JSX, JavaScript ni código ejecutable**. Para relaciones cuantitativas solo puede usar un DSL interpretado por Comprende con operadores y funciones permitidos. El plan pasa por un validador antes de renderizarse; si falla, se intenta reparar una vez y, si vuelve a fallar, el cliente usa un laboratorio local seguro.

### Pedagogical Lab Planner
El análisis semántico de cada concepto decide:

- `engine`: `specialized`, `composed` o `none`;
- `labType`: motor especializado, `generic` o `none`;
- `genericTemplate`: tipo de composición sugerida;
- `practiceMode`;
- prioridad, motivo y confianza.

Plantillas componibles actuales:

- `parameter-explorer`
- `process-stepper`
- `relationship-map`
- `classification-sort`
- `sequence-builder`
- `comparison`
- `matrix-explorer`
- `truth-table`
- `concept-simulator`

### Universal Auto-Lab Engine
Al entrar a una sesión, Comprende inserta automáticamente la fase **Laboratorio** cuando corresponde. Para temas futuros no hace falta modificar el proyecto si pueden representarse con el compositor genérico.

Ejemplos:

- lógica proposicional → truth-table;
- ontologías/redes semánticas → relationship-map;
- BFS/DFS/A*/algoritmos → process-stepper;
- matrices/PCA → matrix-explorer;
- descenso de gradiente/parámetros → parameter-explorer;
- taxonomías/tipos → classification-sort.

## Labs especializados incluidos

- Teorema de Bayes
- Probabilidad condicional
- Redes Bayesianas
- Naive Bayes
- Modelos Ocultos de Markov
- Lógica Difusa
- Monte Carlo
- Dempster-Shafer
- Distribuciones
- Regresión lineal
- Métricas de clasificación

## Proveedores

El diseño de escenarios y Auto-Labs usa el router existente:

1. CheaperInference, si está configurado.
2. DeepSeek directo, si está configurado.
3. OpenAI como fallback.
4. Plan local seguro si todos fallan.

La matemática de los Labs especializados siempre se ejecuta en TypeScript. Los Labs componibles usan el intérprete seguro del DSL; nunca evalúan código generado por un modelo.

## Variables de entorno

Consulta `.env.example`. La configuración relevante para Labs puede quedar así:

```env
LAB_AI_PROVIDER=auto

CHEAPINFERENCE_API_KEY=...
CHEAPINFERENCE_BASE_URL=https://api.cheaperinference.com/v1
CHEAPINFERENCE_MODEL=...

# Opcional: fallback directo
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## Supabase

No existe una migración 004 para Comprende 2.0. Se reutilizan:

- `comprende_v1_ai_artifacts` para cachear mapas, escenarios y planes genéricos;
- `comprende_v1_lab_attempts` para intentos;
- `comprende_v1_lab_progress` para mejor resultado/progreso.

`lab_type` ya es texto, por lo que acepta `generic` sin cambios de esquema.

## Flujo final

```text
Subir PDF
   ↓
PDF.js + páginas
   ↓
BGE-M3 / chunks semánticos
   ↓
Mapa pedagógico
   ↓
Planner de experiencia
   ├─ Lab especializado
   ├─ Auto-Lab componible
   └─ Sin laboratorio
   ↓
Sesión adaptativa
   ↓
Memoria + repaso + Supabase
```

## Desarrollo

```bash
npm install
npm run dev
```

Validación de producción:

```bash
npm run build
```


## 2.0.3 — análisis semántico robusto

El mapa semántico limita el tamaño del JSON estructurado y reintenta automáticamente con más presupuesto cuando OpenAI devuelve una respuesta incompleta por límite de tokens. Esto evita que PDFs largos caigan al mapa local por errores `Unterminated string in JSON`.

## 2.0.4 — Orden del documento

La secuencia de estudio ahora usa el orden en que el PDF desarrolla los temas como fuente de verdad. Los prerrequisitos siguen visibles como ayudas de repaso, pero ya no pueden reordenar la ruta. El selector de conceptos, la vista de materiales y el botón final de cada sesión también siguen esa secuencia.

Para documentos analizados con versiones anteriores, usa **Reanalizar mapa** una vez para regenerar la ruta con esta regla.


## 2.0.6 — Lecciones completadas

- Una lección queda marcada como completada al finalizar y evaluar `Explícamelo tú`.
- Se guarda `completedAt`, `completionScore` y el número de cierres de sesión dentro de la memoria por concepto.
- El mapa del documento muestra ✓ y el porcentaje de cierre en cada tema completado.
- Materiales muestra cuántas lecciones del documento ya están completadas.
- La sesión muestra un banner claro `Lección completada` con el resultado final.
- El paso al siguiente tema se habilita después de la evaluación final, evitando avanzar sin cerrar la lección.
- El estado se sincroniza automáticamente con Supabase dentro de `learning_memory`; no requiere migración SQL nueva.


## 2.0.6 — Ruta limpia y prueba final contextual

- El selector principal muestra únicamente los temas de la ruta del documento.
- Los conceptos de profundidad se consideran subtemas opcionales y se exploran desde el mapa.
- La prueba final solo exige conexiones con temas anteriores que ya fueron completados.
- En el primer tema nunca se pide relacionar la explicación con un concepto posterior.
- No hace falta reanalizar un PDF para aplicar esta corrección: se resuelve en la capa de sesión/evaluación.
