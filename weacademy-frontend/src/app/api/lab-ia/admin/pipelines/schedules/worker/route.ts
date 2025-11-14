import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateNextRun } from '@/modules/laboratorio-ia/services/scheduler'

/**
 * POST /api/lab-ia/admin/pipelines/schedules/worker
 * Worker que verifica e executa pipelines agendados
 * Deve ser chamado periodicamente (ex: via Vercel Cron Jobs ou similar)
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autorização do worker (pode usar secret key)
    const workerSecret = request.headers.get('x-worker-secret')
    const expectedSecret = process.env.WORKER_SECRET_KEY

    if (expectedSecret && workerSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Usar service role para bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date()

    // Buscar agendamentos que devem executar agora (cron ou interval)
    const { data: schedules, error: schedulesError } = await serviceSupabase
      .from('lab_pipeline_schedules')
      .select('*')
      .eq('enabled', true)
      .in('schedule_type', ['cron', 'interval'])
      .lte('next_run_at', now.toISOString())
      .is('next_run_at', null) // Não incluir nulls

    if (schedulesError) {
      console.error('[Schedule Worker] Erro ao buscar agendamentos:', schedulesError)
      throw schedulesError
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No schedules to execute',
        executed: 0,
      })
    }

    const executed: string[] = []
    const errors: string[] = []

    // Executar cada agendamento
    for (const schedule of schedules) {
      try {
        // Preparar input do pipeline
        const inputMessages = schedule.input_data?.messages || [
          { role: 'user', content: schedule.input_data?.message || 'Execute pipeline' },
        ]

        // Criar registro de execução
        const { data: run, error: runError } = await serviceSupabase
          .from('lab_pipeline_schedule_runs')
          .insert({
            schedule_id: schedule.id,
            pipeline_id: schedule.pipeline_id,
            user_id: schedule.user_id,
            status: 'running',
            input_messages: inputMessages,
            trigger_type: 'schedule',
          })
          .select()
          .single()

        if (runError) {
          throw runError
        }

        // Executar pipeline (em background)
        const runUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/lab-ia/pipelines/schedules/${schedule.id}/run`
        
        fetch(runUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            input_messages: inputMessages,
            trigger_type: 'schedule',
          }),
        }).catch(error => {
          console.error(`[Schedule Worker] Erro ao disparar execução do schedule ${schedule.id}:`, error)
        })

        // Calcular próxima execução
        try {
          const nextRun = calculateNextRun({
            schedule_type: schedule.schedule_type as any,
            schedule_config: schedule.schedule_config as any,
          }, now)

          // Atualizar schedule com próxima execução e last_run_at
          await serviceSupabase
            .from('lab_pipeline_schedules')
            .update({
              last_run_at: now.toISOString(),
              next_run_at: nextRun ? nextRun.toISOString() : null,
            })
            .eq('id', schedule.id)
        } catch (calcError) {
          console.warn(`[Schedule Worker] Erro ao calcular próxima execução para schedule ${schedule.id}:`, calcError)
          // Ainda atualizar last_run_at mesmo se não conseguir calcular próxima
          await serviceSupabase
            .from('lab_pipeline_schedules')
            .update({ last_run_at: now.toISOString() })
            .eq('id', schedule.id)
        }

        executed.push(schedule.id)
      } catch (error: any) {
        console.error(`[Schedule Worker] Erro ao processar schedule ${schedule.id}:`, error)
        errors.push(`${schedule.id}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      executed: executed.length,
      errors: errors.length,
      schedule_ids: executed,
      error_details: errors,
    })
  } catch (error: any) {
    console.error('[Schedule Worker] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

