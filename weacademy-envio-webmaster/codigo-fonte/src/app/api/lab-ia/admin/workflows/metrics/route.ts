import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'

const METRICS_DEFAULT_WINDOW_DAYS = 30

const querySchema = z.object({
  workflow_id: z.string().uuid().optional(),
  workflow_version_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await supabaseServer()
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (token) {
    const {
      data: { user: tokenUser },
      error: tokenError,
    } = await supabase.auth.getUser(token)
    if (!tokenError && tokenUser) {
      return tokenUser
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user || null
}

function sanitizeDate(input?: string | null, fallbackDays?: number) {
  if (input) {
    const parsed = new Date(input)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }
  if (fallbackDays !== undefined) {
    const date = new Date()
    date.setDate(date.getDate() - fallbackDays)
    return date.toISOString()
  }
  return undefined
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const supabase = getServiceClient()
    const { searchParams } = new URL(request.url)

    const parsedParams = querySchema.parse({
      workflow_id: searchParams.get('workflow_id') || undefined,
      workflow_version_id: searchParams.get('workflow_version_id') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    })

    const fromIso = sanitizeDate(parsedParams.from, METRICS_DEFAULT_WINDOW_DAYS)
    const toIso = sanitizeDate(parsedParams.to)

    let metricsQuery = supabase
      .from('lab_workflow_metrics_daily')
      .select('*')
      .order('metric_date', { ascending: true })

    if (parsedParams.workflow_id) {
      metricsQuery = metricsQuery.eq('workflow_id', parsedParams.workflow_id)
    }
    if (parsedParams.workflow_version_id) {
      metricsQuery = metricsQuery.eq('workflow_version_id', parsedParams.workflow_version_id)
    }
    if (fromIso) {
      metricsQuery = metricsQuery.gte('metric_date', fromIso)
    }
    if (toIso) {
      metricsQuery = metricsQuery.lte('metric_date', toIso)
    }

    const { data: metricsData, error: metricsError } = await metricsQuery
    if (metricsError) {
      console.error('[WorkflowMetrics][GET] erro ao buscar métricas:', metricsError)
      return NextResponse.json({ error: 'Erro ao buscar métricas' }, { status: 400 })
    }

    let stageMetricsQuery = supabase
      .from('lab_workflow_stage_metrics_daily')
      .select('*')
      .order('metric_date', { ascending: true })

    if (parsedParams.workflow_version_id) {
      stageMetricsQuery = stageMetricsQuery.eq('workflow_version_id', parsedParams.workflow_version_id)
    }
    if (fromIso) {
      stageMetricsQuery = stageMetricsQuery.gte('metric_date', fromIso)
    }
    if (toIso) {
      stageMetricsQuery = stageMetricsQuery.lte('metric_date', toIso)
    }

    const { data: stageMetricsData, error: stageMetricsError } = await stageMetricsQuery
    if (stageMetricsError) {
      console.error('[WorkflowMetrics][GET] erro ao buscar métricas de estágio:', stageMetricsError)
      return NextResponse.json({ error: 'Erro ao buscar métricas por estágio' }, { status: 400 })
    }

    const metrics = metricsData || []
    const stageMetrics = stageMetricsData || []

    // Resumo agregado
    let totalRuns = 0
    let completedRuns = 0
    let failedRuns = 0
    let cancelledRuns = 0
    let totalCostUsd = 0
    let weightedLatencySum = 0
    let latencyWeight = 0
    let weightedCostSum = 0
    let costWeight = 0

    metrics.forEach((row) => {
      const runs = row.total_runs || 0
      totalRuns += runs
      completedRuns += row.completed_runs || 0
      failedRuns += row.failed_runs || 0
      cancelledRuns += row.cancelled_runs || 0
      totalCostUsd += Number(row.total_cost_usd || 0)

      if (row.avg_latency_ms != null) {
        weightedLatencySum += (row.avg_latency_ms || 0) * runs
        latencyWeight += runs
      }
      if (row.avg_cost_usd != null) {
        weightedCostSum += (row.avg_cost_usd || 0) * runs
        costWeight += runs
      }
    })

    const summary = {
      totalRuns,
      completedRuns,
      failedRuns,
      cancelledRuns,
      successRate: totalRuns > 0 ? completedRuns / totalRuns : 0,
      totalCostUsd,
      avgCostUsd: costWeight > 0 ? weightedCostSum / costWeight : 0,
      avgLatencyMs: latencyWeight > 0 ? weightedLatencySum / latencyWeight : 0,
    }

    // Agregação por estágio
    const stageAggregation = new Map<
      string,
      {
        stage_id: string
        executions: number
        completed_executions: number
        failed_executions: number
        total_cost_usd: number
        weighted_latency_sum: number
        latency_weight: number
      }
    >()

    stageMetrics.forEach((row) => {
      const key = row.stage_id
      if (!stageAggregation.has(key)) {
        stageAggregation.set(key, {
          stage_id: key,
          executions: 0,
          completed_executions: 0,
          failed_executions: 0,
          total_cost_usd: 0,
          weighted_latency_sum: 0,
          latency_weight: 0,
        })
      }
      const entry = stageAggregation.get(key)!
      const executions = row.executions || 0
      entry.executions += executions
      entry.completed_executions += row.completed_executions || 0
      entry.failed_executions += row.failed_executions || 0
      entry.total_cost_usd += Number(row.total_cost_usd || 0)
      if (row.avg_latency_ms != null) {
        entry.weighted_latency_sum += (row.avg_latency_ms || 0) * executions
        entry.latency_weight += executions
      }
    })

    const aggregatedStages = Array.from(stageAggregation.values()).map((entry) => ({
      stage_id: entry.stage_id,
      executions: entry.executions,
      completed_executions: entry.completed_executions,
      failed_executions: entry.failed_executions,
      failure_rate: entry.executions > 0 ? entry.failed_executions / entry.executions : 0,
      total_cost_usd: entry.total_cost_usd,
      avg_latency_ms: entry.latency_weight > 0 ? entry.weighted_latency_sum / entry.latency_weight : null,
    }))

    // Enriquecer com metadados das etapas
    if (aggregatedStages.length > 0) {
      const stageIds = aggregatedStages.map((stage) => stage.stage_id)
      const { data: stagesInfo } = await supabase
        .from('lab_workflow_stages')
        .select('id, stage_key, name, type')
        .in('id', stageIds)

      const stageInfoMap = new Map((stagesInfo || []).map((stage) => [stage.id, stage]))
      aggregatedStages.forEach((stage) => {
        const info = stageInfoMap.get(stage.stage_id)
        if (info) {
          Object.assign(stage, {
            stage_key: info.stage_key,
            stage_name: info.name,
            stage_type: info.type,
          })
        }
      })
    }

    return NextResponse.json({
      summary,
      metrics,
      stageMetrics: aggregatedStages,
      rawStageMetrics: stageMetrics,
      filters: {
        workflow_id: parsedParams.workflow_id || null,
        workflow_version_id: parsedParams.workflow_version_id || null,
        from: fromIso,
        to: toIso,
      },
    })
  } catch (error: any) {
    console.error('[WorkflowMetrics][GET] falha inesperada:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}

