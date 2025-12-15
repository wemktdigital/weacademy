/**
 * Serviço de estimativa de custo e latência para pipelines
 */

import { createClient } from '@supabase/supabase-js'
import { MODEL_PRICING } from '../config/pricing'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface CostEstimate {
  estimated_cost_usd: number
  estimated_latency_ms: number
  estimated_total_tokens: number
  steps_count: number
  breakdown?: Array<{
    step_order: number
    agent_id: string
    agent_name?: string
    estimated_cost_usd: number
    estimated_latency_ms: number
    estimated_tokens: number
    confidence: 'high' | 'medium' | 'low' // Confiança baseada em histórico
  }>
}

export interface OptimizationSuggestion {
  type: 'model_downgrade' | 'model_upgrade' | 'remove_step' | 'parallel_execution' | 'cache_result'
  description: string
  potential_savings_usd: number
  impact: 'high' | 'medium' | 'low'
}

/**
 * Estima tokens baseado no tamanho do texto
 */
function estimateTokens(text: string): number {
  // Estimativa simples: ~4 caracteres por token
  return Math.ceil(text.length / 4)
}

/**
 * Estima custo para um step específico baseado em histórico ou cálculo
 */
async function estimateStepCost(
  pipelineId: string,
  agentId: string,
  stepOrder: number,
  provider?: string,
  model?: string,
  inputLength?: number
): Promise<{
  cost: number
  latency: number
  tokens: number
  confidence: 'high' | 'medium' | 'low'
}> {
  // Buscar métricas históricas
  let query = serviceSupabase
    .from('lab_pipeline_step_metrics')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .eq('agent_id', agentId)
    .eq('step_order', stepOrder)

  if (provider) {
    query = query.eq('provider', provider)
  }
  if (model) {
    query = query.eq('model', model)
  }

  const { data: metrics } = await query
    .order('last_execution_at', { ascending: false })
    .limit(1)
    .single()

  if (metrics && metrics.execution_count >= 3) {
    // Tem histórico suficiente: usar média histórica
    return {
      cost: parseFloat(metrics.avg_cost_usd || '0'),
      latency: metrics.avg_latency_ms || 0,
      tokens: (metrics.avg_input_tokens || 0) + (metrics.avg_output_tokens || 0),
      confidence: metrics.execution_count >= 10 ? 'high' : 'medium',
    }
  }

  // Sem histórico ou histórico insuficiente: calcular baseado em modelo/provider
  if (provider && model) {
    const pricingKey = `${provider.toLowerCase()}:${model}`
    const pricing = MODEL_PRICING[pricingKey]

    if (pricing) {
      // Estimar tokens: input aproximado + output esperado
      const inputTokens = estimateTokens(inputLength ? String(inputLength).repeat(inputLength) : '')
      const estimatedInputTokens = inputLength ? Math.ceil(inputLength / 4) : 500
      const estimatedOutputTokens = 200 // Estimativa conservadora de output

      const cost = (estimatedInputTokens / 1_000_000) * pricing.input + 
                   (estimatedOutputTokens / 1_000_000) * pricing.output
      const latency = 2000 // Estimativa de 2 segundos
      const tokens = estimatedInputTokens + estimatedOutputTokens

      return {
        cost,
        latency,
        tokens,
        confidence: 'low', // Baixa confiança sem histórico
      }
    }
  }

  // Fallback: estimativa conservadora
  return {
    cost: 0.001,
    latency: 2000,
    tokens: 700,
    confidence: 'low',
  }
}

/**
 * Estima custo total para um pipeline
 */
export async function estimatePipelineCost(
  pipelineId: string,
  options?: {
    inputMessages?: Array<{ role: string; content: string }>
    inputLength?: number
    useHistorical?: boolean // Se true, usa histórico quando disponível
  }
): Promise<CostEstimate> {
  // Buscar pipeline
  const { data: pipeline, error } = await serviceSupabase
    .from('lab_agent_pipelines')
    .select('steps, name')
    .eq('id', pipelineId)
    .single()

  if (error || !pipeline || !pipeline.steps) {
    throw new Error('Pipeline not found or has no steps')
  }

  const steps = pipeline.steps as Array<{
    order: number
    agent_id: string
    provider?: string
    model?: string
  }>

  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('Pipeline has no valid steps')
  }

  // Calcular tamanho do input se fornecido
  const inputLength = options?.inputMessages
    ? options.inputMessages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0)
    : options?.inputLength || 1000

  // Estimar cada step
  const breakdown: CostEstimate['breakdown'] = []
  let totalCost = 0
  let totalLatency = 0
  let totalTokens = 0

  for (const step of steps) {
    // Buscar informações do agente para nome
    let agentName: string | undefined
    try {
      const { data: agent } = await serviceSupabase
        .from('lab_agents')
        .select('name')
        .eq('id', step.agent_id)
        .single()
      agentName = agent?.name
    } catch (e) {
      // Ignorar erro
    }

    const stepEstimate = await estimateStepCost(
      pipelineId,
      step.agent_id,
      step.order,
      step.provider,
      step.model,
      inputLength
    )

    breakdown.push({
      step_order: step.order,
      agent_id: step.agent_id,
      agent_name: agentName,
      estimated_cost_usd: stepEstimate.cost,
      estimated_latency_ms: stepEstimate.latency,
      estimated_tokens: stepEstimate.tokens,
      confidence: stepEstimate.confidence,
    })

    totalCost += stepEstimate.cost
    totalLatency += stepEstimate.latency
    totalTokens += stepEstimate.tokens
  }

  return {
    estimated_cost_usd: totalCost,
    estimated_latency_ms: totalLatency,
    estimated_total_tokens: totalTokens,
    steps_count: steps.length,
    breakdown,
  }
}

/**
 * Gera sugestões de otimização baseadas na estimativa
 */
export async function generateOptimizationSuggestions(
  pipelineId: string,
  estimate: CostEstimate
): Promise<OptimizationSuggestion[]> {
  const suggestions: OptimizationSuggestion[] = []

  // Buscar informações do pipeline e agentes
  const { data: pipeline } = await serviceSupabase
    .from('lab_agent_pipelines')
    .select('steps')
    .eq('id', pipelineId)
    .single()

  if (!pipeline || !estimate.breakdown) {
    return suggestions
  }

  // Sugestão 1: Verificar se há modelos caros que podem ser substituídos
  const expensiveSteps = estimate.breakdown.filter(
    step => step.estimated_cost_usd > 0.01
  )

  if (expensiveSteps.length > 0) {
    const totalExpensive = expensiveSteps.reduce((acc, s) => acc + s.estimated_cost_usd, 0)
    suggestions.push({
      type: 'model_downgrade',
      description: `${expensiveSteps.length} step(s) usando modelos caros. Considere downgrade para modelos mais econômicos (ex: gpt-4o-mini ao invés de gpt-4o)`,
      potential_savings_usd: totalExpensive * 0.5, // Estimativa de 50% de economia
      impact: 'high',
    })
  }

  // Sugestão 2: Execução paralela para steps independentes
  if (estimate.steps_count > 2) {
    // Assumir que 30% dos steps podem ser paralelos
    const parallelizableSteps = Math.floor(estimate.steps_count * 0.3)
    if (parallelizableSteps > 1) {
      const timeSaved = estimate.breakdown
        .slice(0, parallelizableSteps)
        .reduce((acc, s) => acc + s.estimated_latency_ms, 0) * 0.5 // 50% de economia de tempo

      suggestions.push({
        type: 'parallel_execution',
        description: `${parallelizableSteps} steps podem ser executados em paralelo, reduzindo latência em ~${Math.round(timeSaved / 1000)}s`,
        potential_savings_usd: 0, // Economia de tempo, não custo direto
        impact: 'medium',
      })
    }
  }

  // Sugestão 3: Verificar steps com baixa confiança (sem histórico)
  const lowConfidenceSteps = estimate.breakdown.filter(s => s.confidence === 'low')
  if (lowConfidenceSteps.length > 0) {
    suggestions.push({
      type: 'cache_result',
      description: `${lowConfidenceSteps.length} step(s) sem histórico. Execute algumas vezes para obter estimativas mais precisas.`,
      potential_savings_usd: 0,
      impact: 'low',
    })
  }

  return suggestions.sort((a, b) => {
    // Ordenar por impacto (high > medium > low)
    const impactOrder = { high: 3, medium: 2, low: 1 }
    return impactOrder[b.impact] - impactOrder[a.impact]
  })
}

/**
 * Compara duas configurações e retorna diferença
 */
export async function compareConfigurations(
  pipelineId: string,
  config1: { provider?: string; model?: string },
  config2: { provider?: string; model?: string }
): Promise<{
  config1_cost: number
  config2_cost: number
  difference_usd: number
  difference_percent: number
  recommendation: string
}> {
  // Usar função SQL se disponível, senão calcular manualmente
  const { data: estimate1 } = await serviceSupabase.rpc('estimate_pipeline_cost', {
    p_pipeline_id: pipelineId,
    p_input_length: 1000,
  })

  // Por enquanto, retornar estimativa simples
  // Em produção, poderia usar diferentes configurações
  
  return {
    config1_cost: estimate1?.[0]?.estimated_cost_usd || 0,
    config2_cost: estimate1?.[0]?.estimated_cost_usd || 0, // Placeholder
    difference_usd: 0,
    difference_percent: 0,
    recommendation: 'Execute ambas as configurações para comparação precisa',
  }
}

/**
 * Verifica se custo estimado excede limites configurados
 */
export async function checkCostAlerts(
  userId: string,
  pipelineId: string,
  estimatedCost: number
): Promise<Array<{
  alert_type: string
  message: string
  severity: 'warning' | 'error'
}>> {
  const { data: alerts } = await serviceSupabase
    .from('lab_pipeline_cost_alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .or(`pipeline_id.is.null,pipeline_id.eq.${pipelineId}`)

  const triggeredAlerts: Array<{
    alert_type: string
    message: string
    severity: 'warning' | 'error'
  }> = []

  for (const alert of alerts || []) {
    if (alert.alert_type === 'cost_limit' && alert.threshold_usd) {
      if (estimatedCost > alert.threshold_usd) {
        triggeredAlerts.push({
          alert_type: alert.alert_type,
          message: `Custo estimado ($${estimatedCost.toFixed(4)}) excede limite configurado ($${alert.threshold_usd.toFixed(4)})`,
          severity: 'error',
        })
      }
    }
  }

  return triggeredAlerts
}

