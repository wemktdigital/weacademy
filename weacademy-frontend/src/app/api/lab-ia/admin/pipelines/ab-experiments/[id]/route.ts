import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import {
  getABExperiment,
  startABExperiment,
  pauseABExperiment,
  completeABExperiment,
  analyzeABExperiment,
  getABMetrics,
  getABExecutions,
} from '@/modules/laboratorio-ia/services/abTesting'

/**
 * GET /api/lab-ia/admin/pipelines/ab-experiments/[id]
 * Busca um experimento específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: experimentId } = await params

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

    const experiment = await getABExperiment(experimentId)

    if (!experiment) {
      return NextResponse.json(
        { error: 'Experimento não encontrado' },
        { status: 404 }
      )
    }

    // Verificar acesso
    if (experiment.created_by !== user.id) {
      // Verificar se é admin
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Buscar métricas e análise se estiver rodando
    let metrics = null
    let analysis = null
    let executions: any[] = []

    if (experiment.status === 'running') {
      try {
        metrics = await getABMetrics(experimentId)
        analysis = await analyzeABExperiment(experimentId).catch(() => null)
        executions = await getABExecutions(experimentId, 50)
      } catch (error) {
        console.warn('Erro ao buscar métricas:', error)
      }
    }

    return NextResponse.json({
      experiment,
      metrics,
      analysis,
      executions,
    })
  } catch (error: any) {
    console.error('[AB Experiments API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/lab-ia/admin/pipelines/ab-experiments/[id]
 * Atualiza status do experimento
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: experimentId } = await params

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
    const { action, winner_variant, conclusion } = body

    let experiment

    switch (action) {
      case 'start':
        experiment = await startABExperiment(experimentId)
        break

      case 'pause':
        experiment = await pauseABExperiment(experimentId)
        break

      case 'complete':
        if (!winner_variant) {
          return NextResponse.json(
            { error: 'winner_variant é obrigatório para completar experimento' },
            { status: 400 }
          )
        }
        experiment = await completeABExperiment(experimentId, winner_variant, conclusion)
        break

      default:
        return NextResponse.json(
          { error: 'Ação inválida. Use: start, pause, complete' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      experiment,
    })
  } catch (error: any) {
    console.error('[AB Experiments API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

