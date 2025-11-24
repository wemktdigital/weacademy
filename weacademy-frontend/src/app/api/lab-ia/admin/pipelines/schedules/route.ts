import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { pipelineScheduleSchema } from '@/lib/validations/pipelineSchedule.schema'
import { createClient } from '@supabase/supabase-js'
import { calculateNextRun } from '@/modules/laboratorio-ia/services/scheduler'

/**
 * GET /api/lab-ia/admin/pipelines/schedules
 * Lista agendamentos de pipelines
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

    // Usar service role para bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar role do usuário
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Buscar parâmetros
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const pipelineId = searchParams.get('pipeline_id')
    const enabled = searchParams.get('enabled')

    let query = serviceSupabase
      .from('lab_pipeline_schedules')
      .select('*, pipeline:lab_agent_pipelines(id, name, description)', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (pipelineId) {
      query = query.eq('pipeline_id', pipelineId)
    }

    if (enabled !== null) {
      query = query.eq('enabled', enabled === 'true')
    }

    const offset = (page - 1) * limit
    const { data: schedules, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('[Schedules API] Erro ao buscar agendamentos:', error)
      throw error
    }

    return NextResponse.json({
      schedules: schedules || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('[Schedules API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lab-ia/admin/pipelines/schedules
 * Cria novo agendamento
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

    // Usar service role para bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar role do usuário
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validar e parsear body
    const body = await request.json()
    const validatedData = pipelineScheduleSchema.parse(body)

    // Calcular próxima execução se aplicável
    let nextRunAt: Date | null = null
    try {
      nextRunAt = calculateNextRun({
        schedule_type: validatedData.schedule_type,
        schedule_config: validatedData.schedule_config as any,
      })
    } catch (error) {
      console.warn('[Schedules API] Erro ao calcular próxima execução:', error)
      // Não bloquear criação se não for possível calcular (ex: webhook/event)
    }

    // Criar agendamento
    const { data: schedule, error: insertError } = await serviceSupabase
      .from('lab_pipeline_schedules')
      .insert({
        pipeline_id: validatedData.pipeline_id,
        user_id: user.id,
        name: validatedData.name,
        description: validatedData.description,
        schedule_type: validatedData.schedule_type,
        schedule_config: validatedData.schedule_config,
        input_data: validatedData.input_data || null,
        enabled: validatedData.enabled ?? true,
        next_run_at: nextRunAt ? nextRunAt.toISOString() : null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Schedules API] Erro ao criar agendamento:', insertError)
      throw insertError
    }

    // Se for webhook, criar entrada na tabela de webhooks
    if (validatedData.schedule_type === 'webhook' && schedule) {
      const webhookPath = validatedData.schedule_config.webhook_path
      if (webhookPath) {
        // Gerar token secreto aleatório
        const secretToken = Buffer.from(crypto.randomUUID()).toString('base64')
        
        await serviceSupabase
          .from('lab_pipeline_webhooks')
          .insert({
            schedule_id: schedule.id,
            webhook_path: webhookPath,
            secret_token: secretToken,
            enabled: validatedData.enabled ?? true,
          })
      }
    }

    return NextResponse.json({
      success: true,
      schedule,
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Schedules API] Erro ao criar agendamento:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

