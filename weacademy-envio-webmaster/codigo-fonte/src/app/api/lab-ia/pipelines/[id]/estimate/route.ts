import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { 
  estimatePipelineCost, 
  generateOptimizationSuggestions,
  checkCostAlerts 
} from '@/modules/laboratorio-ia/services/costEstimator'

/**
 * POST /api/lab-ia/pipelines/[id]/estimate
 * Estima custo e latência de um pipeline antes de executar
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pipelineId } = await params

    // Autenticar usuário (opcional para estimativa)
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
      if (!sessionError && sessionUser) {
        user = sessionUser
      }
    }

    // Obter input do body (opcional)
    const body = await request.json().catch(() => ({}))
    const inputMessages = body.messages || body.input || []
    const inputLength = body.input_length || 
      (inputMessages.length > 0 
        ? inputMessages.reduce((acc: number, msg: any) => acc + (msg.content?.length || 0), 0)
        : 1000)

    // Calcular estimativa
    const estimate = await estimatePipelineCost(pipelineId, {
      inputMessages: Array.isArray(inputMessages) ? inputMessages : [],
      inputLength,
      useHistorical: true,
    })

    // Gerar sugestões de otimização
    const suggestions = await generateOptimizationSuggestions(pipelineId, estimate)

    // Verificar alertas de custo (se usuário autenticado)
    let alerts: any[] = []
    if (user) {
      alerts = await checkCostAlerts(user.id, pipelineId, estimate.estimated_cost_usd)
    }

    // Salvar estimativa no banco (se usuário autenticado)
    if (user) {
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      await serviceSupabase
        .from('lab_pipeline_cost_estimates')
        .insert({
          pipeline_id: pipelineId,
          user_id: user.id,
          estimated_cost_usd: estimate.estimated_cost_usd,
          estimated_latency_ms: estimate.estimated_latency_ms,
          estimated_total_tokens: estimate.estimated_total_tokens,
          input_message_length: inputLength,
          configuration_snapshot: { steps_count: estimate.steps_count },
        })
    }

    return NextResponse.json({
      success: true,
      estimate: {
        cost_usd: estimate.estimated_cost_usd,
        latency_ms: estimate.estimated_latency_ms,
        total_tokens: estimate.estimated_total_tokens,
        steps_count: estimate.steps_count,
        breakdown: estimate.breakdown,
      },
      suggestions,
      alerts,
      formatted: {
        cost: `$${estimate.estimated_cost_usd.toFixed(4)}`,
        latency: `${(estimate.estimated_latency_ms / 1000).toFixed(1)}s`,
        tokens: estimate.estimated_total_tokens.toLocaleString(),
      },
    })
  } catch (error: any) {
    console.error('[Cost Estimate API] Erro:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/lab-ia/pipelines/[id]/estimate
 * Retorna histórico de estimativas vs. custos reais (para análise de precisão)
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

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar estimativas com comparações reais
    const { data: estimates, error } = await serviceSupabase
      .from('lab_pipeline_cost_estimates')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .eq('user_id', user.id)
      .not('actual_cost_usd', 'is', null) // Apenas estimativas que foram comparadas com execução real
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      throw error
    }

    // Calcular precisão média
    let totalAccuracy = 0
    let count = 0

    for (const est of estimates || []) {
      if (est.actual_cost_usd && est.estimated_cost_usd) {
        const accuracy = 100 - Math.abs(est.cost_difference_percent || 0)
        totalAccuracy += accuracy
        count++
      }
    }

    const avgAccuracy = count > 0 ? totalAccuracy / count : 0

    return NextResponse.json({
      estimates: estimates || [],
      accuracy: {
        average: avgAccuracy,
        count,
      },
    })
  } catch (error: any) {
    console.error('[Cost Estimate API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

