import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import {
  analyzePipelinePatterns,
  detectBottlenecks,
  detectCostAnomalies,
  generateOptimizationRecommendations,
  checkAndCreateAlerts,
} from '@/modules/laboratorio-ia/services/advancedAnalytics'

/**
 * GET /api/lab-ia/pipelines/[id]/analytics
 * Busca analytics avançados de um pipeline
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pipelineId } = await params
    
    // Autenticar usuário
    const supabase = await supabaseServer()
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user
    if (token) {
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      }
    }

    if (!user) {
      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !sessionUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = sessionUser
    }

    const { searchParams } = new URL(request.url)
    const periodDays = parseInt(searchParams.get('period_days') || '7')
    const includePatterns = searchParams.get('include_patterns') !== 'false'
    const includeBottlenecks = searchParams.get('include_bottlenecks') !== 'false'
    const includeOptimizations = searchParams.get('include_optimizations') !== 'false'
    const includeAnomalies = searchParams.get('include_anomalies') !== 'false'

    // Buscar analytics
    const analytics: any = {}

    // Análise de padrões (com IA)
    if (includePatterns) {
      try {
        analytics.patterns = await analyzePipelinePatterns(pipelineId, periodDays)
      } catch (error: any) {
        console.warn('[Analytics API] Erro ao analisar padrões:', error)
        analytics.patterns = null
      }
    }

    // Gargalos
    if (includeBottlenecks) {
      try {
        analytics.bottlenecks = await detectBottlenecks(pipelineId, periodDays)
      } catch (error: any) {
        console.warn('[Analytics API] Erro ao detectar gargalos:', error)
        analytics.bottlenecks = []
      }
    }

    // Anomalias de custo
    if (includeAnomalies) {
      try {
        analytics.anomalies = await detectCostAnomalies(pipelineId, periodDays, 2.0)
      } catch (error: any) {
        console.warn('[Analytics API] Erro ao detectar anomalias:', error)
        analytics.anomalies = []
      }
    }

    // Recomendações de otimização
    if (includeOptimizations) {
      try {
        analytics.optimizations = await generateOptimizationRecommendations(pipelineId, periodDays)
      } catch (error: any) {
        console.warn('[Analytics API] Erro ao gerar recomendações:', error)
        analytics.optimizations = []
      }
    }

    return NextResponse.json({
      success: true,
      analytics,
      period_days: periodDays,
    })
  } catch (error: any) {
    console.error('[Analytics API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lab-ia/pipelines/[id]/analytics
 * Gera insights e alertas para um pipeline
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pipelineId } = await params
    
    // Autenticar usuário
    const supabase = await supabaseServer()
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user
    if (token) {
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      }
    }

    if (!user) {
      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !sessionUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = sessionUser
    }

    const body = await request.json()
    const periodDays = body.period_days || 7

    // Verificar e criar alertas proativos
    const alerts = await checkAndCreateAlerts(pipelineId, user.id, periodDays)

    // Gerar recomendações de otimização
    const optimizations = await generateOptimizationRecommendations(pipelineId, periodDays)

    return NextResponse.json({
      success: true,
      alerts,
      optimizations,
    })
  } catch (error: any) {
    console.error('[Analytics API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

