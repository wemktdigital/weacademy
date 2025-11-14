import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { runPipeline } from '@/modules/laboratorio-ia/services/pipelineRunner'

/**
 * POST /api/lab-ia/pipelines/schedules/[id]/run
 * Executa pipeline agendado manualmente (ou via trigger)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Autenticar usuário (ou verificar webhook secret)
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

    // Usar service role para bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar agendamento
    const { data: schedule, error: scheduleError } = await serviceSupabase
      .from('lab_pipeline_schedules')
      .select('*')
      .eq('id', id)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Se não há usuário autenticado, verificar se é webhook
    if (!user) {
      // Verificar webhook secret se aplicável
      const webhookSecret = request.headers.get('x-webhook-secret')
      if (schedule.schedule_type === 'webhook') {
        const { data: webhook } = await serviceSupabase
          .from('lab_pipeline_webhooks')
          .select('secret_token')
          .eq('schedule_id', id)
          .eq('enabled', true)
          .single()

        if (!webhook || webhook.secret_token !== webhookSecret) {
          return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
        }
      } else {
        // Para outros tipos, requer autenticação
        const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
        if (sessionError || !sessionUser) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        user = sessionUser
      }
    }

    if (!schedule.enabled) {
      return NextResponse.json({ error: 'Schedule is disabled' }, { status: 400 })
    }

    // Preparar input do pipeline
    const body = await request.json().catch(() => ({}))
    const inputMessages = body.input_messages || schedule.input_data?.messages || [
      { role: 'user', content: schedule.input_data?.message || 'Execute pipeline' },
    ]

    // Criar registro de execução
    const { data: run, error: runError } = await serviceSupabase
      .from('lab_pipeline_schedule_runs')
      .insert({
        schedule_id: id,
        pipeline_id: schedule.pipeline_id,
        user_id: schedule.user_id,
        status: 'running',
        input_messages: inputMessages,
        trigger_type: body.trigger_type || 'schedule',
        trigger_data: body.trigger_data || null,
      })
      .select()
      .single()

    if (runError) {
      console.error('[Schedule Run API] Erro ao criar registro de execução:', runError)
      throw runError
    }

    // Executar pipeline em background (não bloquear resposta)
    const startTime = Date.now()
    
    // Usar setImmediate para executar após resposta
    setImmediate(async () => {
      try {
        const result = await runPipeline(
          schedule.pipeline_id,
          inputMessages,
          schedule.user_id,
          undefined, // onProgress
          false // allowDraft
        )

        const duration = Date.now() - startTime

        // Atualizar registro de execução
        await serviceSupabase
          .from('lab_pipeline_schedule_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            duration_ms: duration,
            output_messages: result.results.map(r => ({
              agent_id: r.agent_id,
              output: r.output,
              latency_ms: r.latency,
              cost_usd: r.cost,
            })),
            total_cost_usd: result.totalCost,
          })
          .eq('id', run.id)

        // Atualizar last_run_at do schedule
        await serviceSupabase
          .from('lab_pipeline_schedules')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', id)
      } catch (error: any) {
        console.error('[Schedule Run API] Erro ao executar pipeline:', error)
        
        // Atualizar registro com erro
        await serviceSupabase
          .from('lab_pipeline_schedule_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            error_message: error.message || 'Unknown error',
          })
          .eq('id', run.id)
      }
    })

    // Retornar resposta imediata
    return NextResponse.json({
      success: true,
      run_id: run.id,
      status: 'running',
      message: 'Pipeline execution started',
    })
  } catch (error: any) {
    console.error('[Schedule Run API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

