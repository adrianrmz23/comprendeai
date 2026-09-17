export type SpecializedLabType =
  | 'bayes'
  | 'bayesian-network'
  | 'hmm'
  | 'fuzzy'
  | 'conditional-probability'
  | 'distribution'
  | 'monte-carlo'
  | 'naive-bayes'
  | 'dempster-shafer'
  | 'regression'
  | 'classification'

export type LabType = SpecializedLabType | 'generic'

export type LabPracticeMode = 'simulation' | 'visualization' | 'builder' | 'experiment' | 'step_by_step' | 'case'
export type LabEngine = 'specialized' | 'composed' | 'none'
export type GenericLabTemplate =
  | 'parameter-explorer'
  | 'process-stepper'
  | 'relationship-map'
  | 'classification-sort'
  | 'sequence-builder'
  | 'comparison'
  | 'matrix-explorer'
  | 'truth-table'
  | 'concept-simulator'
  | 'none'

export type LabRecommendation = {
  recommended: boolean
  engine?: LabEngine
  labType: LabType | 'none'
  genericTemplate?: GenericLabTemplate
  practiceMode: LabPracticeMode | 'none'
  priority: 'high' | 'medium' | 'low' | 'none'
  reason: string
  confidence: number
}

export type LabNarrative = {
  id: string
  title: string
  context: string
  mission: string
  transferPrompt: string
  provider?: string
  model?: string
  cached?: boolean
}

export type LabDefinition = {
  type: LabType
  title: string
  shortTitle: string
  description: string
  estimatedMinutes: number
  goals: string[]
  practiceMode: LabPracticeMode
}

export type LabResult = {
  score: number
  completed: boolean
  interactions: number
  detail: string
  state?: Record<string, unknown>
}

export type LabProgress = {
  bestScore: number
  attempts: number
  completed: boolean
  updatedAt: string
}

export type LabComponentProps = {
  narrative: LabNarrative
  previousBest?: number
  onComplete: (result: LabResult) => void
}

export type GenericControl = {
  id: string
  label: string
  type: 'slider' | 'toggle' | 'select'
  min?: number
  max?: number
  step?: number
  defaultValue: number | boolean | string
  unit?: string
  options?: string[]
  help?: string
}

export type GenericMetric = {
  id: string
  label: string
  expression: string
  format: 'number' | 'percent' | 'boolean'
  precision: number
  help: string
}

export type GenericBarVisualization = {
  type: 'bars'
  title: string
  items: { label: string; expression: string }[]
}

export type GenericCurveVisualization = {
  type: 'curve'
  title: string
  xControlId: string
  yExpression: string
  xMin: number
  xMax: number
  points: number
}

export type GenericProcessVisualization = {
  type: 'process'
  title: string
  steps: string[]
}

export type GenericRelationVisualization = {
  type: 'relation'
  title: string
  nodes: string[]
  edges: { from: string; to: string; label: string }[]
}

export type GenericTableVisualization = {
  type: 'table'
  title: string
  columns: string[]
  rows: string[][]
}

export type GenericVisualization =
  | GenericBarVisualization
  | GenericCurveVisualization
  | GenericProcessVisualization
  | GenericRelationVisualization
  | GenericTableVisualization

export type GenericChoiceChallenge = {
  type: 'choice'
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

export type GenericOrderChallenge = {
  type: 'order'
  prompt: string
  items: string[]
  explanation: string
}

export type GenericClassifyChallenge = {
  type: 'classify'
  prompt: string
  categories: string[]
  items: { label: string; category: string }[]
  explanation: string
}

export type GenericMatchChallenge = {
  type: 'match'
  prompt: string
  pairs: { left: string; right: string }[]
  explanation: string
}

export type GenericChallenge = GenericChoiceChallenge | GenericOrderChallenge | GenericClassifyChallenge | GenericMatchChallenge

export type GenericLabPlan = {
  id: string
  concept: string
  template: Exclude<GenericLabTemplate, 'none'>
  title: string
  description: string
  objective: string
  estimatedMinutes: number
  context: string
  mission: string
  controls: GenericControl[]
  metrics: GenericMetric[]
  visualizations: GenericVisualization[]
  challenge: GenericChallenge
  transferPrompt: string
  sourceGrounding: string
  provider?: string
  model?: string
  cached?: boolean
  validation?: {
    valid: boolean
    warnings: string[]
  }
}
