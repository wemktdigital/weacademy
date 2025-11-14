// Serviço de Otimização Automática de Routing (Fase 2)
// Analisa histórico de performance e ajusta recomendações dinamicamente

import { createClient } from '@supabase/supabase-js'
import { TaskCategory, ModelRecommendation } from './intelligentRouter'

interface ModelPerformanceMetrics {
  provider: string
  model: string
  taskCategory: TaskCategory
  avgLatency: number
  avgCost: number
  successRate: number
  avgQualityScore: number
  totalExecutions: number
  recentExecutions: number  // Últimas 7 dias
}

interface OptimizationResult {
  optimizedRecommendations: ModelRecommendation[]
  improvements: {
    costReduction?: number  // % de redução de custo
    latencyReduction?: number  // % de redução de latência
    qualityImprovement?: number  // % de melhoria de qualidade
  }
  learnedPreferences: {
    preferredModels: Array<{ provider: string; model: string; score: number }>
    avoidedModels: Array<{ provider: string; model: string; reason: string }>
  }
}

export interface ModelInsight {
  provider: string
  model: string
  successRate: number
  avgLatency: number
  avgCost: number
  executions: number
  avgQualityScore?: number
  categories: string[]
  insights?: string[]
}

export interface CategoryInsight {
  category: string
  executions: number
  successRate: number
  avgLatency: number
  avgCost: number
  topModel?: {
    provider: string
    model: string
    successRate: number
  }
}

export interface RoutingAnalyticsData {
  summary: {
    totalExecutions: number
    recentExecutions: number
    monitoredModels: number
    uniqueCategories: number
    avgLatency: number
    avgCost: number
    successRate: number
  }
  improvements: {
    costSavingsPerExecution?: number
    latencyImprovementMs?: number
    successImprovement?: number
    bestCostModel?: { provider: string; model: string; avgCost: number }
    bestLatencyModel?: { provider: string; model: string; avgLatency: number }
    bestSuccessModel?: { provider: string; model: string; successRate: number }
  }
  topModels: ModelInsight[]
  underperformingModels: ModelInsight[]
  categoryInsights: CategoryInsight[]
  recommendations: {
    acceptedCount: number
    categories: Array<{ category: string; count: number }>
    topReasons: string[]
  }
  preferences: {
    topPreferredModels: Array<{ provider: string; model: string; count: number }>
    avoidedModels: Array<{ provider: string; model: string; reason: string }>
  }
  feedback: {
    total: number
    positive: number
    negative: number
    positiveRatio: number
    recentComments: Array<{ provider: string; model: string; rating: number; comment?: string; created_at: string }>
  }
}

interface ModelFeedbackStats {
  provider: string
  model: string
  total: number
  positive: number
  negative: number
  score: number
  lastFeedbackAt: string | null
  lastComment?: string | null
}

/**
 * Obtém métricas de performance agregadas de um modelo para uma categoria de tarefa
 */
export async function getModelPerformanceMetrics(
  provider: string,
  model: string,
  taskCategory: TaskCategory,
  userId?: string
): Promise<ModelPerformanceMetrics | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = supabase
    .from('lab_model_performance')
    .select('*')
    .eq('provider', provider)
    .eq('model', model)
    .eq('task_category', taskCategory)

  // Se userId fornecido, filtrar por usuário
  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return null
  }

  // Calcular métricas agregadas
  const totalExecutions = data.length
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 dias
  const recentExecutions = data.filter(
    (d: any) => new Date(d.created_at).getTime() > recentCutoff
  ).length

  const successful = data.filter((d: any) => d.success === true)
  const successRate = successful.length / totalExecutions

  const avgLatency = data.reduce((sum: number, d: any) => sum + (d.latency_ms || 0), 0) / totalExecutions
  const avgCost = data.reduce((sum: number, d: any) => sum + Number(d.cost_usd || 0), 0) / totalExecutions
  const avgQualityScore = data.reduce((sum: number, d: any) => sum + (d.quality_score || 0), 0) / totalExecutions

  return {
    provider,
    model,
    taskCategory,
    avgLatency,
    avgCost,
    successRate,
    avgQualityScore,
    totalExecutions,
    recentExecutions,
  }
}

/**
 * Obtém métricas de performance para todos os modelos de uma categoria
 */
export async function getAllModelMetricsForCategory(
  taskCategory: TaskCategory,
  userId?: string
): Promise<ModelPerformanceMetrics[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = supabase
    .from('lab_model_performance')
    .select('*')
    .eq('task_category', taskCategory)
    .order('created_at', { ascending: false })
    .limit(1000) // Limitar para performance

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return []
  }

  // Agrupar por modelo
  const modelGroups = new Map<string, any[]>()
  data.forEach((record: any) => {
    const key = `${record.provider}:${record.model}`
    if (!modelGroups.has(key)) {
      modelGroups.set(key, [])
    }
    modelGroups.get(key)!.push(record)
  })

  // Calcular métricas para cada modelo
  const metrics: ModelPerformanceMetrics[] = []
  
  for (const [modelId, records] of modelGroups.entries()) {
    const [provider, model] = modelId.split(':')
    if (!provider || !model) continue

    const totalExecutions = records.length
    const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentExecutions = records.filter(
      (r: any) => new Date(r.created_at).getTime() > recentCutoff
    ).length

    const successful = records.filter((r: any) => r.success === true)
    const successRate = successful.length / totalExecutions

    const avgLatency = records.reduce((sum: number, r: any) => sum + (r.latency_ms || 0), 0) / totalExecutions
    const avgCost = records.reduce((sum: number, r: any) => sum + Number(r.cost_usd || 0), 0) / totalExecutions
    const avgQualityScore = records.reduce((sum: number, r: any) => sum + (r.quality_score || 0), 0) / totalExecutions

    metrics.push({
      provider,
      model,
      taskCategory,
      avgLatency,
      avgCost,
      successRate,
      avgQualityScore,
      totalExecutions,
      recentExecutions,
    })
  }

  return metrics
}

/**
 * Otimiza recomendações baseado em histórico de performance
 */
export async function optimizeRecommendations(
  baseRecommendations: ModelRecommendation[],
  taskCategory: TaskCategory,
  userId?: string,
  preferences?: {
    maxCost?: number
    preferSpeed?: boolean
    preferAccuracy?: boolean
  }
): Promise<OptimizationResult> {
  // Obter métricas de performance para todos os modelos desta categoria
  const metrics = await getAllModelMetricsForCategory(taskCategory, userId)
  const feedbackStats = await getModelFeedbackStats(taskCategory, userId)

  if (metrics.length === 0 && feedbackStats.size === 0) {
    // Sem histórico, retornar recomendações base sem otimização
    return {
      optimizedRecommendations: baseRecommendations,
      improvements: {},
      learnedPreferences: {
        preferredModels: [],
        avoidedModels: [],
      },
    }
  }

  // Criar mapa de métricas por modelo
  const metricsMap = new Map<string, ModelPerformanceMetrics>()
  metrics.forEach(m => {
    const key = `${m.provider}:${m.model}`
    metricsMap.set(key, m)
  })

  // Otimizar cada recomendação baseado em performance real
  const optimizedRecommendations = baseRecommendations.map(rec => {
    const key = `${rec.provider}:${rec.model}`
    const perf = metricsMap.get(key)

    let optimizedScore = rec.score
    const improvements: string[] = []

    if (perf) {
      // Ajustar score baseado em taxa de sucesso
      if (perf.successRate < 0.7) {
        optimizedScore -= 20
        improvements.push(`Taxa de sucesso baixa (${Math.round(perf.successRate * 100)}%)`)
      } else if (perf.successRate > 0.95) {
        optimizedScore += 10
        improvements.push(`Taxa de sucesso excelente (${Math.round(perf.successRate * 100)}%)`)
      }

      // Ajustar baseado em latência (se preferSpeed)
      if (preferences?.preferSpeed && metrics.length > 0) {
        const avgLatency = metrics.reduce((sum, m) => sum + m.avgLatency, 0) / metrics.length
        if (perf.avgLatency < avgLatency * 0.7) {
          optimizedScore += 8
          improvements.push(`Latência abaixo da média`)
        } else if (perf.avgLatency > avgLatency * 1.5) {
          optimizedScore -= 10
          improvements.push(`Latência acima da média`)
        }
      }

      // Ajustar baseado em custo
      if (preferences?.maxCost) {
        if (perf.avgCost > preferences.maxCost) {
          optimizedScore -= 15
          improvements.push(`Custo acima do limite`)
        } else if (perf.avgCost < preferences.maxCost * 0.5) {
          optimizedScore += 5
          improvements.push(`Custo muito abaixo do limite`)
        }
      }

      // Ajustar baseado em qualidade (se preferAccuracy)
      if (preferences?.preferAccuracy && perf.avgQualityScore > 0 && metrics.length > 0) {
        const avgQuality = metrics.reduce((sum, m) => sum + m.avgQualityScore, 0) / metrics.length
        if (perf.avgQualityScore > avgQuality * 1.2) {
          optimizedScore += 10
          improvements.push(`Qualidade acima da média`)
        }
      }

      // Ajustar baseado em volume de execuções recentes (confiança estatística)
      if (perf.recentExecutions < 5) {
        optimizedScore -= 5
        improvements.push(`Poucos dados recentes`)
      } else if (perf.recentExecutions > 20) {
        optimizedScore += 3
        improvements.push(`Alto volume de uso recente`)
      }
    }

    const feedback = feedbackStats.get(key)
    if (feedback && feedback.total > 0) {
      const feedbackImpact = Math.max(-10, Math.min(10, feedback.score * 20))
      optimizedScore += feedbackImpact
      improvements.push(
        feedback.score >= 0
          ? `Feedback positivo (${feedback.positive}/${feedback.total})`
          : `Feedback negativo (${feedback.negative}/${feedback.total})`
      )
    }

    // Normalizar score entre 0-100
    optimizedScore = Math.max(0, Math.min(100, optimizedScore))

    return {
      ...rec,
      score: Math.round(optimizedScore),
      reason: improvements.length > 0 
        ? `${rec.reason} [${improvements.join(', ')}]`
        : rec.reason,
      estimatedCost: perf?.avgCost,
      estimatedLatency: perf ? Math.round(perf.avgLatency) : undefined,
    }
  }).sort((a, b) => b.score - a.score)

  // Calcular melhorias
  const baseAvgCost = baseRecommendations.find(rec => rec.estimatedCost !== undefined)?.estimatedCost || 0
  const optimizedAvgCost = optimizedRecommendations.find(rec => rec.estimatedCost !== undefined)?.estimatedCost || 0
  const costReduction = baseAvgCost > 0 
    ? ((baseAvgCost - optimizedAvgCost) / baseAvgCost) * 100 
    : undefined

  const baseAvgLatency = baseRecommendations.find(rec => rec.estimatedLatency !== undefined)?.estimatedLatency || 0
  const optimizedAvgLatency = optimizedRecommendations.find(rec => rec.estimatedLatency !== undefined)?.estimatedLatency || 0
  const latencyReduction = baseAvgLatency > 0
    ? ((baseAvgLatency - optimizedAvgLatency) / baseAvgLatency) * 100
    : undefined

  // Identificar modelos preferidos e evitados
  const preferredModels = optimizedRecommendations
    .slice(0, 3)
    .map(rec => ({
      provider: rec.provider,
      model: rec.model,
      score: rec.score,
    }))

  const avoidedModels = metrics
    .filter(m => m.successRate < 0.5 || m.avgCost > (preferences?.maxCost || Infinity))
    .map(m => ({
      provider: m.provider,
      model: m.model,
      reason: m.successRate < 0.5 
        ? `Taxa de sucesso baixa (${Math.round(m.successRate * 100)}%)`
        : `Custo alto ($${m.avgCost.toFixed(4)})`,
    }))

  return {
    optimizedRecommendations,
    improvements: {
      costReduction: costReduction ? Math.round(costReduction * 10) / 10 : undefined,
      latencyReduction: latencyReduction ? Math.round(latencyReduction * 10) / 10 : undefined,
    },
    learnedPreferences: {
      preferredModels,
      avoidedModels,
    },
  }
}

/**
 * Registra performance de um modelo após execução
 */
export async function recordModelPerformance({
  provider,
  model,
  taskCategory,
  latency,
  cost,
  success,
  qualityScore,
  userId,
}: {
  provider: string
  model: string
  taskCategory: TaskCategory
  latency: number
  cost: number
  success: boolean
  qualityScore?: number
  userId?: string
}): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase
    .from('lab_model_performance')
    .insert({
      provider,
      model,
      task_category: taskCategory,
      latency_ms: latency,
      cost_usd: cost,
      success,
      quality_score: qualityScore || null,
      prompt_hash: '', // Será preenchido se necessário
      user_id: userId || null,
    })

  if (error) {
    console.error('[Optimization] Erro ao registrar performance:', error)
    // Não lançar erro - não é crítico
  }
}

/**
 * Aprende preferências do usuário por tipo de tarefa baseado em histórico
 */
export async function learnUserPreferences(
  userId: string,
  taskCategory: TaskCategory
): Promise<{
  preferredModels: Array<{ provider: string; model: string; score: number }>
  averageCost: number
  averageLatency: number
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Buscar histórico de recomendações aceitas pelo usuário
  // Nota: Se accepted_at não é null, significa que foi aceito
  const { data: history } = await supabase
    .from('lab_model_recommendations_history')
    .select('*')
    .eq('user_id', userId)
    .eq('task_category', taskCategory)
    .eq('accepted', true)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!history || history.length === 0) {
    return {
      preferredModels: [],
      averageCost: 0,
      averageLatency: 0,
    }
  }

  // Contar aceitações por modelo
  const modelCounts = new Map<string, number>()
  history.forEach(h => {
    const key = `${h.recommended_provider}:${h.recommended_model}`
    modelCounts.set(key, (modelCounts.get(key) || 0) + 1)
  })

  // Calcular scores baseados em frequência de aceitação
  const preferredModels = Array.from(modelCounts.entries())
    .map(([key, count]) => {
      const [provider, model] = key.split(':')
      const score = Math.min(100, (count / history.length) * 100) // Score baseado em % de aceitação
      return { provider, model, score }
    })
    .sort((a, b) => b.score - a.score)

  // Calcular médias (se tivermos dados de performance)
  const metrics = await getAllModelMetricsForCategory(taskCategory, userId)
  const averageCost = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.avgCost, 0) / metrics.length
    : 0
  const averageLatency = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.avgLatency, 0) / metrics.length
    : 0

  return {
    preferredModels,
    averageCost,
    averageLatency,
  }
}

export async function getRoutingAnalytics(userId: string): Promise<RoutingAnalyticsData> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: performance } = await supabase
    .from('lab_model_performance')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5000)

  const { data: history } = await supabase
    .from('lab_model_recommendations_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)

  const { data: feedback } = await supabase
    .from('lab_model_feedback')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000)

  const performanceRecords = performance || []
  const historyRecords = history || []
  const feedbackRecords = feedback || []

  const totalExecutions = performanceRecords.length
  const recentExecutions = performanceRecords.filter(record => {
    const createdAt = record.created_at ? new Date(record.created_at).getTime() : 0
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return createdAt > cutoff
  }).length

  const monitoredModelsSet = new Set<string>()
  let totalLatency = 0
  let totalCost = 0
  let successCount = 0
  let qualitySum = 0
  let qualityCount = 0

  const modelAggregates = new Map<string, {
    provider: string
    model: string
    executions: number
    successCount: number
    latencySum: number
    costSum: number
    qualitySum: number
    qualityCount: number
    categories: Set<string>
  }>()

  const categoryAggregates = new Map<string, {
    executions: number
    successCount: number
    latencySum: number
    costSum: number
    models: Map<string, { executions: number; successCount: number }>
  }>()

  const feedbackByModel = new Map<string, ModelFeedbackStats>()
  let feedbackPositive = 0
  let feedbackNegative = 0

  performanceRecords.forEach(record => {
    const provider = record.provider
    const model = record.model
    const key = `${provider}:${model}`
    const latency = Number(record.latency_ms || 0)
    const cost = Number(record.cost_usd || 0)
    const success = record.success === true
    const category = record.task_category || 'outro'
    const quality = record.quality_score

    monitoredModelsSet.add(key)

    totalLatency += latency
    totalCost += cost
    if (success) successCount += 1
    if (quality !== null && quality !== undefined) {
      qualitySum += Number(quality)
      qualityCount += 1
    }

    if (!modelAggregates.has(key)) {
      modelAggregates.set(key, {
        provider,
        model,
        executions: 0,
        successCount: 0,
        latencySum: 0,
        costSum: 0,
        qualitySum: 0,
        qualityCount: 0,
        categories: new Set<string>(),
      })
    }

    const aggregate = modelAggregates.get(key)!
    aggregate.executions += 1
    aggregate.latencySum += latency
    aggregate.costSum += cost
    aggregate.categories.add(category)
    if (success) {
      aggregate.successCount += 1
    }
    if (quality !== null && quality !== undefined) {
      aggregate.qualitySum += Number(quality)
      aggregate.qualityCount += 1
    }

    if (!categoryAggregates.has(category)) {
      categoryAggregates.set(category, {
        executions: 0,
        successCount: 0,
        latencySum: 0,
        costSum: 0,
        models: new Map<string, { executions: number; successCount: number }>(),
      })
    }

    const categoryAggregate = categoryAggregates.get(category)!
    categoryAggregate.executions += 1
    categoryAggregate.latencySum += latency
    categoryAggregate.costSum += cost
    if (success) {
      categoryAggregate.successCount += 1
    }

    if (!categoryAggregate.models.has(key)) {
      categoryAggregate.models.set(key, { executions: 0, successCount: 0 })
    }
    const categoryModel = categoryAggregate.models.get(key)!
    categoryModel.executions += 1
    if (success) {
      categoryModel.successCount += 1
    }
  })

  const avgLatency = totalExecutions > 0 ? totalLatency / totalExecutions : 0
  const avgCost = totalExecutions > 0 ? totalCost / totalExecutions : 0
  const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0

  feedbackRecords.forEach(record => {
    const key = `${record.provider}:${record.model}`
    if (!feedbackByModel.has(key)) {
      feedbackByModel.set(key, {
        provider: record.provider,
        model: record.model,
        total: 0,
        positive: 0,
        negative: 0,
        score: 0,
        lastFeedbackAt: null,
        lastComment: null,
      })
    }

    const stats = feedbackByModel.get(key)!
    stats.total += 1
    if (record.rating > 0) {
      stats.positive += 1
      feedbackPositive += 1
    } else if (record.rating < 0) {
      stats.negative += 1
      feedbackNegative += 1
    }
    stats.score = (stats.positive - stats.negative) / stats.total

    if (!stats.lastFeedbackAt || new Date(record.created_at).getTime() > new Date(stats.lastFeedbackAt).getTime()) {
      stats.lastFeedbackAt = record.created_at
      stats.lastComment = record.comment
    }
  })

  const modelInsights: ModelInsight[] = Array.from(modelAggregates.values()).map(aggregate => {
    const avgLatencyModel = aggregate.executions > 0 ? aggregate.latencySum / aggregate.executions : 0
    const avgCostModel = aggregate.executions > 0 ? aggregate.costSum / aggregate.executions : 0
    const successRateModel = aggregate.executions > 0 ? (aggregate.successCount / aggregate.executions) * 100 : 0
    const avgQuality = aggregate.qualityCount > 0 ? aggregate.qualitySum / aggregate.qualityCount : undefined

    return {
      provider: aggregate.provider,
      model: aggregate.model,
      executions: aggregate.executions,
      successRate: successRateModel,
      avgLatency: avgLatencyModel,
      avgCost: avgCostModel,
      avgQualityScore: avgQuality,
      categories: Array.from(aggregate.categories),
    }
  })

  const topModels = modelInsights
    .filter(model => model.executions >= 3)
    .sort((a, b) => {
      if (b.successRate === a.successRate) {
        return a.avgCost - b.avgCost
      }
      return b.successRate - a.successRate
    })
    .slice(0, 5)

  const underperformingModels = modelInsights
    .filter(model => model.executions >= 3)
    .map(model => {
      const issues: string[] = []
      if (model.successRate < 70) {
        issues.push(`Baixa taxa de sucesso (${model.successRate.toFixed(1)}%)`)
      }
      if (avgLatency > 0 && model.avgLatency > avgLatency * 1.3) {
        issues.push('Latência acima da média')
      }
      if (avgCost > 0 && model.avgCost > avgCost * 1.3) {
        issues.push('Custo acima da média')
      }
      const feedbackStats = feedbackByModel.get(`${model.provider}:${model.model}`)
      if (feedbackStats && feedbackStats.total >= 2 && feedbackStats.negative > feedbackStats.positive) {
        issues.push(`Feedback negativo (${feedbackStats.negative}/${feedbackStats.total})`)
      }
      if (issues.length > 0) {
        return { ...model, insights: issues }
      }
      return null
    })
    .filter((model): model is ModelInsight & { insights: string[] } => model !== null)
    .sort((a, b) => (a.successRate - b.successRate))
    .slice(0, 5)

  const categoryInsights: CategoryInsight[] = Array.from(categoryAggregates.entries()).map(([category, aggregate]) => {
    const avgLatencyCategory = aggregate.executions > 0 ? aggregate.latencySum / aggregate.executions : 0
    const avgCostCategory = aggregate.executions > 0 ? aggregate.costSum / aggregate.executions : 0
    const successRateCategory = aggregate.executions > 0 ? (aggregate.successCount / aggregate.executions) * 100 : 0

    let topModel: CategoryInsight['topModel'] = undefined
    let bestSuccess = 0

    aggregate.models.forEach((modelStats, key) => {
      const successRateModel = modelStats.executions > 0 ? (modelStats.successCount / modelStats.executions) * 100 : 0
      if (successRateModel > bestSuccess && modelStats.executions >= 2) {
        const [provider, model] = key.split(':')
        topModel = {
          provider,
          model,
          successRate: successRateModel,
        }
        bestSuccess = successRateModel
      }
    })

    return {
      category,
      executions: aggregate.executions,
      successRate: successRateCategory,
      avgLatency: avgLatencyCategory,
      avgCost: avgCostCategory,
      topModel,
    }
  }).sort((a, b) => b.executions - a.executions)

  const bestCostModel = modelInsights.length > 0
    ? modelInsights.reduce<ModelInsight | null>((best, current) => {
        if (current.executions < 3) return best
        if (!best || current.avgCost < best.avgCost) {
          return current
        }
        return best
      }, null)
    : null

  const bestLatencyModel = modelInsights.length > 0
    ? modelInsights.reduce<ModelInsight | null>((best, current) => {
        if (current.executions < 3) return best
        if (!best || current.avgLatency < best.avgLatency) {
          return current
        }
        return best
      }, null)
    : null

  const bestSuccessModel = modelInsights.length > 0
    ? modelInsights.reduce<ModelInsight | null>((best, current) => {
        if (current.executions < 3) return best
        if (!best || current.successRate > best.successRate) {
          return current
        }
        return best
      }, null)
    : null

  const costSavingsPerExecution = bestCostModel && avgCost > bestCostModel.avgCost
    ? avgCost - bestCostModel.avgCost
    : undefined

  const latencyImprovementMs = bestLatencyModel && avgLatency > bestLatencyModel.avgLatency
    ? avgLatency - bestLatencyModel.avgLatency
    : undefined

  const successImprovement = bestSuccessModel && successRate < bestSuccessModel.successRate
    ? bestSuccessModel.successRate - successRate
    : undefined

  const recommendationCategories = new Map<string, number>()
  const recommendationReasons = new Map<string, number>()
  const preferredModelCounts = new Map<string, number>()

  historyRecords.forEach(record => {
    const category = record.task_category || 'sem categoria'
    recommendationCategories.set(category, (recommendationCategories.get(category) || 0) + 1)

    if (record.recommendation_reason) {
      recommendationReasons.set(
        record.recommendation_reason,
        (recommendationReasons.get(record.recommendation_reason) || 0) + 1
      )
    }

    const key = `${record.recommended_provider}:${record.recommended_model}`
    preferredModelCounts.set(key, (preferredModelCounts.get(key) || 0) + 1)
  })

  const topPreferredModels = Array.from(preferredModelCounts.entries())
    .map(([key, count]) => {
      const [provider, model] = key.split(':')
      return { provider, model, count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const avoidedModels = underperformingModels.map(model => {
    const key = `${model.provider}:${model.model}`
    const feedbackInfo = feedbackStats.get(key)
    const baseReason = model.insights?.join(', ') || 'Performance abaixo do esperado'
    const feedbackReason = feedbackInfo && feedbackInfo.total > 0
      ? `${baseReason}${feedbackInfo.lastComment ? ` — Comentário recente: "${feedbackInfo.lastComment}"` : ''}`
      : baseReason
    return {
      provider: model.provider,
      model: model.model,
      reason: feedbackReason,
    }
  })

  if (avoidedModels.length === 0 && feedbackStats.size > 0) {
    feedbackStats.forEach(stats => {
      if (stats.score < 0) {
        avoidedModels.push({
          provider: stats.provider,
          model: stats.model,
          reason: `Feedback negativo (${stats.negative}/${stats.total})${stats.lastComment ? ` — "${stats.lastComment}"` : ''}`,
        })
      }
    })
  }

  return {
    summary: {
      totalExecutions,
      recentExecutions,
      monitoredModels: monitoredModelsSet.size,
      uniqueCategories: categoryAggregates.size,
      avgLatency,
      avgCost,
      successRate,
    },
    improvements: {
      costSavingsPerExecution,
      latencyImprovementMs,
      successImprovement,
      bestCostModel: bestCostModel
        ? { provider: bestCostModel.provider, model: bestCostModel.model, avgCost: bestCostModel.avgCost }
        : undefined,
      bestLatencyModel: bestLatencyModel
        ? { provider: bestLatencyModel.provider, model: bestLatencyModel.model, avgLatency: bestLatencyModel.avgLatency }
        : undefined,
      bestSuccessModel: bestSuccessModel
        ? { provider: bestSuccessModel.provider, model: bestSuccessModel.model, successRate: bestSuccessModel.successRate }
        : undefined,
    },
    topModels,
    underperformingModels,
    categoryInsights,
    recommendations: {
      acceptedCount: historyRecords.length,
      categories: Array.from(recommendationCategories.entries()).map(([category, count]) => ({ category, count })),
      topReasons: Array.from(recommendationReasons.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([reason]) => reason),
    },
    preferences: {
      topPreferredModels,
      avoidedModels,
    },
    feedback: {
      total: feedbackRecords.length,
      positive: feedbackPositive,
      negative: feedbackNegative,
      positiveRatio: feedbackRecords.length > 0 ? (feedbackPositive / feedbackRecords.length) * 100 : 0,
      recentComments: feedbackRecords
        .filter(record => record.comment && record.comment.trim().length > 0)
        .slice(-5)
        .map(record => ({
          provider: record.provider,
          model: record.model,
          rating: Number(record.rating),
          comment: record.comment,
          created_at: record.created_at,
        })),
    },
  }
}

async function getModelFeedbackStats(
  taskCategory: TaskCategory,
  userId?: string
): Promise<Map<string, ModelFeedbackStats>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = supabase
    .from('lab_model_feedback')
    .select('*')
    .eq('task_category', taskCategory)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error || !data) {
    return new Map()
  }

  const stats = new Map<string, ModelFeedbackStats>()

  data.forEach(record => {
    const key = `${record.provider}:${record.model}`
    if (!stats.has(key)) {
      stats.set(key, {
        provider: record.provider,
        model: record.model,
        total: 0,
        positive: 0,
        negative: 0,
        score: 0,
        lastFeedbackAt: null,
        lastComment: null,
      })
    }

    const entry = stats.get(key)!
    entry.total += 1
    if (record.rating > 0) {
      entry.positive += 1
    } else if (record.rating < 0) {
      entry.negative += 1
    }
    entry.score = (entry.positive - entry.negative) / entry.total

    if (!entry.lastFeedbackAt || new Date(record.created_at).getTime() > new Date(entry.lastFeedbackAt).getTime()) {
      entry.lastFeedbackAt = record.created_at
      entry.lastComment = record.comment
    }
  })

  return stats
}

