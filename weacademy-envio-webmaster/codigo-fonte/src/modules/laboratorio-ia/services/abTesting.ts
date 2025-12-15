/**
 * Serviço de A/B Testing para Pipelines
 */

import { createClient } from '@supabase/supabase-js'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface ABExperiment {
  id: string
  name: string
  description?: string
  variant_a_pipeline_id: string
  variant_a_version?: string
  variant_b_pipeline_id: string
  variant_b_version?: string
  traffic_split: { a: number; b: number }
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'
  created_by: string
  created_at: string
  started_at?: string
  completed_at?: string
  min_sample_size: number
  max_duration_days: number
  significance_level: number
  winner_variant?: 'a' | 'b' | 'tie' | 'none'
  winner_pipeline_id?: string
  conclusion?: string
  randomization_strategy: 'random' | 'user_id_hash' | 'session_id'
  metrics_to_track: string[]
}

export interface ABExecution {
  id: string
  experiment_id: string
  variant: 'a' | 'b'
  pipeline_id: string
  user_id?: string
  input_messages?: any[]
  output_messages?: any[]
  latency_ms?: number
  cost_usd?: number
  quality_score?: number
  user_satisfaction?: number
  executed_at: string
  session_id?: string
  randomization_key?: string
}

export interface ABMetrics {
  id: string
  experiment_id: string
  variant: 'a' | 'b'
  total_executions: number
  total_users: number
  avg_latency_ms?: number
  avg_cost_usd?: number
  avg_quality_score?: number
  avg_user_satisfaction?: number
  total_cost_usd?: number
  total_latency_ms?: number
  error_count: number
  error_rate: number
  min_latency_ms?: number
  max_latency_ms?: number
  min_cost_usd?: number
  max_cost_usd?: number
  period_start: string
  period_end: string
  updated_at: string
}

export interface ABAnalysisResult {
  variant_a_stats: ABMetrics
  variant_b_stats: ABMetrics
  recommendation: 'a' | 'b' | 'tie'
  confidence_level: number
  significant_difference: boolean
}

/**
 * Cria um novo experimento A/B
 */
export async function createABExperiment(
  name: string,
  variantA: { pipelineId: string; version?: string },
  variantB: { pipelineId: string; version?: string },
  options: {
    userId: string
    description?: string
    trafficSplit?: { a: number; b: number }
    minSampleSize?: number
    maxDurationDays?: number
    randomizationStrategy?: 'random' | 'user_id_hash' | 'session_id'
    metricsToTrack?: string[]
  }
): Promise<ABExperiment> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_ab_experiments')
    .insert({
      name,
      description: options.description,
      variant_a_pipeline_id: variantA.pipelineId,
      variant_a_version: variantA.version || null,
      variant_b_pipeline_id: variantB.pipelineId,
      variant_b_version: variantB.version || null,
      traffic_split: options.trafficSplit || { a: 50, b: 50 },
      status: 'draft',
      created_by: options.userId,
      min_sample_size: options.minSampleSize || 100,
      max_duration_days: options.maxDurationDays || 30,
      randomization_strategy: options.randomizationStrategy || 'random',
      metrics_to_track: options.metricsToTrack || ['latency', 'cost', 'quality'],
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar experimento: ${error.message}`)
  }

  return data as ABExperiment
}

/**
 * Busca experimentos
 */
export async function getABExperiments(
  options?: {
    userId?: string
    status?: ABExperiment['status']
    includeArchived?: boolean
  }
): Promise<ABExperiment[]> {
  let query = serviceSupabase
    .from('lab_pipeline_ab_experiments')
    .select('*')
    .order('created_at', { ascending: false })

  if (options?.userId) {
    query = query.eq('created_by', options.userId)
  }

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  if (!options?.includeArchived) {
    query = query.neq('status', 'cancelled')
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Erro ao buscar experimentos: ${error.message}`)
  }

  return (data || []) as ABExperiment[]
}

/**
 * Busca um experimento específico
 */
export async function getABExperiment(experimentId: string): Promise<ABExperiment | null> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_ab_experiments')
    .select('*')
    .eq('id', experimentId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar experimento: ${error.message}`)
  }

  return data as ABExperiment
}

/**
 * Inicia um experimento
 */
export async function startABExperiment(experimentId: string): Promise<ABExperiment> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_ab_experiments')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', experimentId)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao iniciar experimento: ${error.message}`)
  }

  return data as ABExperiment
}

/**
 * Pausa um experimento
 */
export async function pauseABExperiment(experimentId: string): Promise<ABExperiment> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_ab_experiments')
    .update({
      status: 'paused',
    })
    .eq('id', experimentId)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao pausar experimento: ${error.message}`)
  }

  return data as ABExperiment
}

/**
 * Completa um experimento e escolhe vencedor
 */
export async function completeABExperiment(
  experimentId: string,
  winnerVariant: 'a' | 'b' | 'tie' | 'none',
  conclusion?: string
): Promise<ABExperiment> {
  const experiment = await getABExperiment(experimentId)
  
  if (!experiment) {
    throw new Error('Experimento não encontrado')
  }

  const winnerPipelineId = winnerVariant === 'a' 
    ? experiment.variant_a_pipeline_id
    : winnerVariant === 'b'
    ? experiment.variant_b_pipeline_id
    : null

  const { data, error } = await serviceSupabase
    .from('lab_pipeline_ab_experiments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      winner_variant: winnerVariant,
      winner_pipeline_id: winnerPipelineId,
      conclusion: conclusion || null,
    })
    .eq('id', experimentId)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao completar experimento: ${error.message}`)
  }

  return data as ABExperiment
}

/**
 * Determina qual variante usar baseado na distribuição de tráfego
 */
export async function getABVariant(
  experimentId: string,
  userId?: string,
  sessionId?: string
): Promise<'a' | 'b'> {
  const { data, error } = await serviceSupabase.rpc('get_ab_variant', {
    p_experiment_id: experimentId,
    p_user_id: userId || null,
    p_session_id: sessionId || null,
  })

  if (error) {
    throw new Error(`Erro ao determinar variante: ${error.message}`)
  }

  return data as 'a' | 'b'
}

/**
 * Registra uma execução do experimento
 */
export async function recordABExecution(
  experimentId: string,
  variant: 'a' | 'b',
  pipelineId: string,
  metrics: {
    userId?: string
    inputMessages?: any[]
    outputMessages?: any[]
    latencyMs?: number
    costUsd?: number
    qualityScore?: number
    userSatisfaction?: number
    sessionId?: string
    randomizationKey?: string
  }
): Promise<ABExecution> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_ab_executions')
    .insert({
      experiment_id: experimentId,
      variant,
      pipeline_id: pipelineId,
      user_id: metrics.userId || null,
      input_messages: metrics.inputMessages || null,
      output_messages: metrics.outputMessages || null,
      latency_ms: metrics.latencyMs || null,
      cost_usd: metrics.costUsd || null,
      quality_score: metrics.qualityScore || null,
      user_satisfaction: metrics.userSatisfaction || null,
      session_id: metrics.sessionId || null,
      randomization_key: metrics.randomizationKey || null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao registrar execução: ${error.message}`)
  }

  // Atualizar métricas agregadas
  await serviceSupabase.rpc('update_ab_metrics', {
    p_experiment_id: experimentId,
  })

  return data as ABExecution
}

/**
 * Busca métricas de um experimento
 */
export async function getABMetrics(experimentId: string): Promise<{
  variantA: ABMetrics | null
  variantB: ABMetrics | null
}> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_ab_metrics')
    .select('*')
    .eq('experiment_id', experimentId)
    .order('period_start', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar métricas: ${error.message}`)
  }

  const metrics = (data || []) as ABMetrics[]

  const variantA = metrics.find(m => m.variant === 'a') || null
  const variantB = metrics.find(m => m.variant === 'b') || null

  return { variantA, variantB }
}

/**
 * Analisa resultados e recomenda vencedor
 */
export async function analyzeABExperiment(experimentId: string): Promise<ABAnalysisResult> {
  const { data, error } = await serviceSupabase.rpc('analyze_ab_experiment', {
    p_experiment_id: experimentId,
  })

  if (error) {
    throw new Error(`Erro ao analisar experimento: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error('Dados insuficientes para análise')
  }

  const result = data[0]

  return {
    variant_a_stats: result.variant_a_stats as ABMetrics,
    variant_b_stats: result.variant_b_stats as ABMetrics,
    recommendation: result.recommendation as 'a' | 'b' | 'tie',
    confidence_level: parseFloat(result.confidence_level),
    significant_difference: result.significant_difference,
  }
}

/**
 * Busca execuções de um experimento
 */
export async function getABExecutions(
  experimentId: string,
  limit: number = 100
): Promise<ABExecution[]> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_ab_executions')
    .select('*')
    .eq('experiment_id', experimentId)
    .order('executed_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Erro ao buscar execuções: ${error.message}`)
  }

  return (data || []) as ABExecution[]
}

