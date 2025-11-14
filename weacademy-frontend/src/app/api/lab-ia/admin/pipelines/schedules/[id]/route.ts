import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { pipelineScheduleSchema } from '@/lib/validations/pipelineSchedule.schema'
import { createClient } from '@supabase/supabase-js'
import { calculateNextRun } from '@/modules/laboratorio-ia/services/scheduler'

/**
 * PUT /api/lab-ia/admin/pipelines/schedules/[id]
 * Atualiza agendamento
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    if (!profile || !['admin', 'gestor_we', 'gestor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validar e parsear body
    const body = await request.json()
    const validatedData = pipelineScheduleSchema.partial().parse(body)

    // Calcular próxima execução se schedule foi atualizado
    let nextRunAt: Date | null | undefined = undefined
    if (validatedData.schedule_type && validatedData.schedule_config) {
      try {
        nextRunAt = calculateNextRun({
          schedule_type: validatedData.schedule_type,
          schedule_config: validatedData.schedule_config as any,
        })
      } catch (error) {
        console.warn('[Schedules API] Erro ao calcular próxima execução:', error)
      }
    }

    // Atualizar agendamento
    const updateData: any = {}
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.schedule_type !== undefined) updateData.schedule_type = validatedData.schedule_type
    if (validatedData.schedule_config !== undefined) updateData.schedule_config = validatedData.schedule_config
    if (validatedData.input_data !== undefined) updateData.input_data = validatedData.input_data
    if (validatedData.enabled !== undefined) updateData.enabled = validatedData.enabled
    if (nextRunAt !== undefined) {
      updateData.next_run_at = nextRunAt ? nextRunAt.toISOString() : null
    }

    const { data: schedule, error: updateError } = await serviceSupabase
      .from('lab_pipeline_schedules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[Schedules API] Erro ao atualizar agendamento:', updateError)
      throw updateError
    }

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      schedule,
    })
  } catch (error: any) {
    console.error('[Schedules API] Erro ao atualizar agendamento:', error)
    
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

/**
 * DELETE /api/lab-ia/admin/pipelines/schedules/[id]
 * Deleta agendamento
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    if (!profile || !['admin', 'gestor_we', 'gestor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Deletar agendamento (webhooks serão deletados em cascade)
    const { error: deleteError } = await serviceSupabase
      .from('lab_pipeline_schedules')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[Schedules API] Erro ao deletar agendamento:', deleteError)
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted successfully',
    })
  } catch (error: any) {
    console.error('[Schedules API] Erro ao deletar agendamento:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

