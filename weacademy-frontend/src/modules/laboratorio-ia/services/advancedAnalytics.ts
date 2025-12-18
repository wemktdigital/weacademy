/**
 * Serviço de Analytics Avançados com IA
 */

import { createClient } from '@supabase/supabase-js'
import { callLLM } from './llmRouter'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface PipelineInsight {
  id: string
  pipeline_id: string
  insight_type: 'bottleneck' | 'cost_optimization' | 'latency_optimization' | 'model_recommendation' | 'step_order_optimization' | 'anomaly_detection' | 'usage_pattern'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  recommendations?: any[]
  estimated_impact?: {
    cost_savings?: number
    latency_reduction?: number
    quality_impact?: number
  }
  related_metrics?: any
  status: 'active' | 'dismissed' | 'resolved' | 'archived'
  generated_at: string
}

export interface PipelineAlert {
  id: string
  pipeline_id: string
  user_id: string
  alert_type: 'cost_spike' | 'latency_spike' | 'error_rate_increase' | 'usage_anomaly' | 'performance_degradation' | 'threshold_exceeded'
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  current_value?: number
  threshold_value?: number
  difference_percent?: number
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed'
  triggered_at: string
}

export interface PipelineOptimization {
  id: string
  pipeline_id: string
  optimization_type: 'model_change' | 'step_order_change' | 'provider_change' | 'parameter_tuning' | 'parallelization' | 'caching' | 'retry_strategy' | 'timeout_adjustment'
  title: string
  description: string
  current_config: any
  recommended_config: any
  estimated_cost_savings_percent?: number
  estimated_latency_reduction_ms?: number
  estimated_quality_impact?: number
  confidence_level: number
  status: 'pending' | 'applied' | 'rejected' | 'testing'
  created_at: string
}

export interface PipelineBottleneck {
  id: string
  pipeline_id: string
  step_order?: number
  agent_id?: string
  avg_latency_ms?: number
  avg_cost_usd?: number
  impact_on_total_latency_percent?: number
  impact_on_total_cost_percent?: number
  recommendations?: any[]
  status: 'active' | 'resolved' | 'archived'
  detected_at: string
}

/**
 * Analisa padrões em execuções de pipeline usando IA
 */
export async function analyzePipelinePatterns(
  pipelineId: string,
  periodDays: number = 7
): Promise<any> {
  try {
    // Buscar métricas históricas
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

    const { data: logs } = await serviceSupabase
      .from('lab_pipeline_logs')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .gte('created_at', periodStart)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (!logs || logs.length === 0) {
      return {
        patterns: [],
        insights: [],
        recommendations: [],
      }
    }

    // Buscar métricas de steps
    const { data: stepMetrics } = await serviceSupabase
      .from('lab_pipeline_step_metrics')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .gte('created_at', periodStart)
      .order('created_at', { ascending: false })

    // Preparar dados para análise de IA
    const analysisData = {
      total_executions: logs.length,
      avg_cost: logs.reduce((sum, log) => sum + (parseFloat(log.total_cost_usd || '0') || 0), 0) / logs.length,
      avg_latency: logs.reduce((sum, log) => sum + (log.total_latency_ms || 0), 0) / logs.length,
      cost_trend: analyzeCostTrend(logs),
      latency_trend: analyzeLatencyTrend(logs),
      step_performance: analyzeStepPerformance(stepMetrics || []),
      time_patterns: analyzeTimePatterns(logs),
      error_patterns: analyzeErrorPatterns(logs),
    }

    // Usar IA para gerar insights
    const aiPrompt = `
Analise os seguintes dados de execução de pipeline e forneça insights acionáveis:

Dados:
${JSON.stringify(analysisData, null, 2)}

Forneça:
1. Padrões detectados
2. Gargalos identificados
3. Oportunidades de otimização
4. Recomendações específicas

Formato JSON:
{
  "patterns": [
    {
      "type": "usage_trend|cost_trend|latency_trend|error_pattern|time_of_day",
      "description": "...",
      "strength": 0.0-1.0,
      "confidence": 0.0-1.0
    }
  ],
  "bottlenecks": [
    {
      "step_order": 1,
      "agent_id": "...",
      "description": "...",
      "impact": "high|medium|low"
    }
  ],
  "optimizations": [
    {
      "type": "model_change|step_order_change|provider_change|parameter_tuning",
      "description": "...",
      "estimated_savings": "...",
      "confidence": 0.0-1.0
    }
  ],
  "insights": [
    {
      "type": "bottleneck|cost_optimization|latency_optimization|model_recommendation",
      "title": "...",
      "description": "...",
      "severity": "low|medium|high|critical",
      "recommendations": ["..."]
    }
  ]
}
`

    const aiResponse = await callLLM({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em análise de dados e otimização de pipelines de IA. Analise os dados fornecidos e forneça insights acionáveis em formato JSON.',
        },
        {
          role: 'user',
          content: aiPrompt,
        },
      ],
      stream: false,
    })

    // Parsear resposta da IA
    let aiAnalysis
    try {
      const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        aiAnalysis = JSON.parse(jsonMatch[0])
      } else {
        aiAnalysis = JSON.parse(aiResponse.content)
      }
    } catch (error) {
      console.warn('[AdvancedAnalytics] Erro ao parsear resposta da IA:', error)
      aiAnalysis = {
        patterns: [],
        bottlenecks: [],
        optimizations: [],
        insights: [],
      }
    }

    return {
      patterns: aiAnalysis.patterns || [],
      bottlenecks: aiAnalysis.bottlenecks || [],
      optimizations: aiAnalysis.optimizations || [],
      insights: aiAnalysis.insights || [],
      raw_data: analysisData,
    }
  } catch (error: any) {
    console.error('[AdvancedAnalytics] Erro ao analisar padrões:', error)
    throw new Error(`Erro ao analisar padrões: ${error.message}`)
  }
}

/**
 * Detecta gargalos automaticamente
 */
export async function detectBottlenecks(
  pipelineId: string,
  periodDays: number = 7
): Promise<PipelineBottleneck[]> {
  try {
    const { data, error } = await serviceSupabase.rpc('detect_pipeline_bottlenecks', {
      p_pipeline_id: pipelineId,
      p_period_days: periodDays,
    })

    if (error) {
      throw error
    }

    // Salvar gargalos detectados
    const bottlenecks: PipelineBottleneck[] = []
    for (const bottleneck of data || []) {
      const { data: saved, error: saveError } = await serviceSupabase
        .from('lab_pipeline_bottlenecks')
        .insert({
          pipeline_id: pipelineId,
          step_order: bottleneck.step_order,
          agent_id: bottleneck.agent_id,
          avg_latency_ms: bottleneck.avg_latency_ms,
          avg_cost_usd: bottleneck.avg_cost_usd,
          impact_on_total_latency_percent: bottleneck.impact_latency_percent,
          impact_on_total_cost_percent: bottleneck.impact_cost_percent,
          period_start: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString(),
          period_end: new Date().toISOString(),
          sample_size: (data || []).length,
        })
        .select()
        .single()

      if (!saveError && saved) {
        bottlenecks.push(saved as PipelineBottleneck)
      }
    }

    return bottlenecks
  } catch (error: any) {
    console.error('[AdvancedAnalytics] Erro ao detectar gargalos:', error)
    throw new Error(`Erro ao detectar gargalos: ${error.message}`)
  }
}

/**
 * Detecta anomalias de custo
 */
export async function detectCostAnomalies(
  pipelineId: string,
  periodDays: number = 7,
  thresholdMultiplier: number = 2.0
): Promise<any[]> {
  try {
    const { data, error } = await serviceSupabase.rpc('detect_cost_anomalies', {
      p_pipeline_id: pipelineId,
      p_period_days: periodDays,
      p_threshold_multiplier: thresholdMultiplier,
    })

    if (error) {
      throw error
    }

    return data || []
  } catch (error: any) {
    console.error('[AdvancedAnalytics] Erro ao detectar anomalias:', error)
    throw new Error(`Erro ao detectar anomalias: ${error.message}`)
  }
}

/**
 * Gera recomendações de otimização usando IA
 */
export async function generateOptimizationRecommendations(
  pipelineId: string,
  periodDays: number = 7
): Promise<PipelineOptimization[]> {
  try {
    // Buscar análise de padrões
    const analysis = await analyzePipelinePatterns(pipelineId, periodDays)

    // Buscar pipeline
    const { data: pipeline } = await serviceSupabase
      .from('lab_agent_pipelines')
      .select('*')
      .eq('id', pipelineId)
      .single()

    if (!pipeline) {
      throw new Error('Pipeline não encontrado')
    }

    // Gerar recomendações baseadas nos insights
    const optimizations: PipelineOptimization[] = []

    for (const optimization of analysis.optimizations || []) {
      const { data: saved, error } = await serviceSupabase
        .from('lab_pipeline_optimizations')
        .insert({
          pipeline_id: pipelineId,
          optimization_type: optimization.type,
          title: optimization.title || `Otimização: ${optimization.type}`,
          description: optimization.description || '',
          current_config: optimization.current_config || {},
          recommended_config: optimization.recommended_config || {},
          estimated_cost_savings_percent: optimization.estimated_savings?.cost_savings_percent || null,
          estimated_latency_reduction_ms: optimization.estimated_savings?.latency_reduction_ms || null,
          estimated_quality_impact: optimization.estimated_savings?.quality_impact || null,
          confidence_level: optimization.confidence || 0.5,
        })
        .select()
        .single()

      if (!error && saved) {
        optimizations.push(saved as PipelineOptimization)
      }
    }

    return optimizations
  } catch (error: any) {
    console.error('[AdvancedAnalytics] Erro ao gerar recomendações:', error)
    throw new Error(`Erro ao gerar recomendações: ${error.message}`)
  }
}

/**
 * Cria alerta proativo
 */
export async function createAlert(
  pipelineId: string,
  userId: string,
  alertType: PipelineAlert['alert_type'],
  title: string,
  message: string,
  severity: PipelineAlert['severity'],
  metrics?: {
    currentValue?: number
    thresholdValue?: number
    differencePercent?: number
  }
): Promise<PipelineAlert> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_alerts')
    .insert({
      pipeline_id: pipelineId,
      user_id: userId,
      alert_type: alertType,
      title,
      message,
      severity,
      current_value: metrics?.currentValue || null,
      threshold_value: metrics?.thresholdValue || null,
      difference_percent: metrics?.differencePercent || null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar alerta: ${error.message}`)
  }

  return data as PipelineAlert
}

/**
 * Verifica e cria alertas proativos
 */
export async function checkAndCreateAlerts(
  pipelineId: string,
  userId: string,
  periodDays: number = 1
): Promise<PipelineAlert[]> {
  const alerts: PipelineAlert[] = []

  try {
    // Verificar anomalias de custo
    const costAnomalies = await detectCostAnomalies(pipelineId, periodDays, 2.0)

    for (const anomaly of costAnomalies) {
      if (anomaly.difference_percent && Math.abs(anomaly.difference_percent) > 100) {
        const alert = await createAlert(
          pipelineId,
          userId,
          'cost_spike',
          `Pico de Custo Detectado`,
          `O custo do pipeline aumentou ${Math.abs(anomaly.difference_percent).toFixed(0)}% em ${anomaly.anomaly_date}`,
          Math.abs(anomaly.difference_percent) > 200 ? 'critical' : 'high',
          {
            currentValue: parseFloat(anomaly.avg_cost?.toString() || '0'),
            thresholdValue: parseFloat(anomaly.expected_cost?.toString() || '0'),
            differencePercent: parseFloat(anomaly.difference_percent?.toString() || '0'),
          }
        )
        alerts.push(alert)
      }
    }

    // Verificar gargalos
    const bottlenecks = await detectBottlenecks(pipelineId, periodDays)

    for (const bottleneck of bottlenecks) {
      if (bottleneck.impact_on_total_latency_percent && bottleneck.impact_on_total_latency_percent > 50) {
        const alert = await createAlert(
          pipelineId,
          userId,
          'performance_degradation',
          `Gargalo Detectado no Step ${bottleneck.step_order}`,
          `O step ${bottleneck.step_order} está consumindo ${bottleneck.impact_on_total_latency_percent.toFixed(0)}% da latência total`,
          bottleneck.impact_on_total_latency_percent > 70 ? 'critical' : 'high',
          {
            currentValue: parseFloat(bottleneck.avg_latency_ms?.toString() || '0'),
            differencePercent: parseFloat(bottleneck.impact_on_total_latency_percent?.toString() || '0'),
          }
        )
        alerts.push(alert)
      }
    }
  } catch (error) {
    console.error('[AdvancedAnalytics] Erro ao verificar alertas:', error)
  }

  return alerts
}

// Funções auxiliares de análise

function analyzeCostTrend(logs: any[]): any {
  const dailyCosts = new Map<string, number[]>()

  for (const log of logs) {
    const date = new Date(log.created_at).toISOString().split('T')[0]
    if (!dailyCosts.has(date)) {
      dailyCosts.set(date, [])
    }
    dailyCosts.get(date)!.push(parseFloat(log.total_cost_usd || '0') || 0)
  }

  const trend = Array.from(dailyCosts.entries())
    .map(([date, costs]) => ({
      date,
      avg_cost: costs.reduce((a, b) => a + b, 0) / costs.length,
      count: costs.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    trend,
    direction: trend.length > 1
      ? (trend[trend.length - 1].avg_cost > trend[0].avg_cost ? 'increasing' : 'decreasing')
      : 'stable',
  }
}

function analyzeLatencyTrend(logs: any[]): any {
  const dailyLatencies = new Map<string, number[]>()

  for (const log of logs) {
    const date = new Date(log.created_at).toISOString().split('T')[0]
    if (!dailyLatencies.has(date)) {
      dailyLatencies.set(date, [])
    }
    dailyLatencies.get(date)!.push(log.total_latency_ms || 0)
  }

  const trend = Array.from(dailyLatencies.entries())
    .map(([date, latencies]) => ({
      date,
      avg_latency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      count: latencies.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    trend,
    direction: trend.length > 1
      ? (trend[trend.length - 1].avg_latency > trend[0].avg_latency ? 'increasing' : 'decreasing')
      : 'stable',
  }
}

function analyzeStepPerformance(stepMetrics: any[]): any {
  const stepPerformance = new Map<number, any>()

  for (const metric of stepMetrics) {
    const order = metric.step_order || 0
    if (!stepPerformance.has(order)) {
      stepPerformance.set(order, {
        step_order: order,
        agent_id: metric.agent_id,
        latencies: [],
        costs: [],
      })
    }
    const step = stepPerformance.get(order)!
    step.latencies.push(metric.latency_ms || 0)
    step.costs.push(parseFloat(metric.cost_usd || '0') || 0)
  }

  return Array.from(stepPerformance.values()).map(step => ({
    step_order: step.step_order,
    agent_id: step.agent_id,
    avg_latency: step.latencies.reduce((a: number, b: number) => a + b, 0) / step.latencies.length,
    avg_cost: step.costs.reduce((a: number, b: number) => a + b, 0) / step.costs.length,
    p95_latency: step.latencies.sort((a: number, b: number) => b - a)[Math.floor(step.latencies.length * 0.05)],
    p99_latency: step.latencies.sort((a: number, b: number) => b - a)[Math.floor(step.latencies.length * 0.01)],
  }))
}

function analyzeTimePatterns(logs: any[]): any {
  const hourlyUsage = new Map<number, number>()
  const dayOfWeekUsage = new Map<number, number>()

  for (const log of logs) {
    const date = new Date(log.created_at)
    const hour = date.getHours()
    const dayOfWeek = date.getDay()

    hourlyUsage.set(hour, (hourlyUsage.get(hour) || 0) + 1)
    dayOfWeekUsage.set(dayOfWeek, (dayOfWeekUsage.get(dayOfWeek) || 0) + 1)
  }

  return {
    hourly: Array.from(hourlyUsage.entries()).map(([hour, count]) => ({ hour, count })),
    day_of_week: Array.from(dayOfWeekUsage.entries()).map(([day, count]) => ({ day, count })),
  }
}

function analyzeErrorPatterns(logs: any[]): any {
  // Por enquanto, retornar estrutura básica
  // Em produção, analisar logs de erro reais
  return {
    error_rate: 0,
    error_types: [],
  }
}

