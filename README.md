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
