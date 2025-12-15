import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import {
  createABExperiment,
  getABExperiments,
  startABExperiment,
  pauseABExperiment,
  completeABExperiment,
  analyzeABExperiment,
  getABMetrics,
} from '@/modules/laboratorio-ia/services/abTesting'

/**
 * GET /api/lab-ia/admin/pipelines/ab-experiments
 * Lista experimentos A/B
 */
export async function GET(request: NextRequest) {
  try {
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
    const status = searchParams.get('status') as any
    const includeArchived = searchParams.get('include_archived') === 'true'

    const experiments = await getABExperiments({
      userId: user.id,
      status,
      includeArchived,
    })

    // Buscar métricas para cada experimento rodando
    const experimentsWithMetrics = await Promise.all(
      experiments.map(async (exp) => {
        if (exp.status === 'running') {
          try {
            const metrics = await getABMetrics(exp.id)
            const analysis = await analyzeABExperiment(exp.id).catch(() => null)
            return {
              ...exp,
              metrics,
              analysis,
            }
          } catch (error) {
            return exp
          }
        }
        return exp
      })
    )

    return NextResponse.json({
      experiments: experimentsWithMetrics,
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
 * POST /api/lab-ia/admin/pipelines/ab-experiments
 * Cria um novo experimento A/B
 */
export async function POST(request: NextRequest) {
  try {
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
    const {
      name,
      description,
      variant_a_pipeline_id,
      variant_a_version,
      variant_b_pipeline_id,
      variant_b_version,
      traffic_split,
      min_sample_size,
      max_duration_days,
      randomization_strategy,
      metrics_to_track,
    } = body

    if (!name || !variant_a_pipeline_id || !variant_b_pipeline_id) {
      return NextResponse.json(
        { error: 'name, variant_a_pipeline_id e variant_b_pipeline_id são obrigatórios' },
        { status: 400 }
      )
    }

    const experiment = await createABExperiment(
      name,
      {
        pipelineId: variant_a_pipeline_id,
        version: variant_a_version,
      },
      {
        pipelineId: variant_b_pipeline_id,
        version: variant_b_version,
      },
      {
        userId: user.id,
        description,
        trafficSplit: traffic_split || { a: 50, b: 50 },
        minSampleSize: min_sample_size || 100,
        maxDurationDays: max_duration_days || 30,
        randomizationStrategy: randomization_strategy || 'random',
        metricsToTrack: metrics_to_track || ['latency', 'cost', 'quality'],
      }
    )

    return NextResponse.json({
      success: true,
      experiment,
    }, { status: 201 })
  } catch (error: any) {
    console.error('[AB Experiments API] Erro ao criar:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

