import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/lab-ia/pipelines/schedules/[id]/runs
 * Lista histórico de execuções de um agendamento
 */
export async function GET(
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

    // Verificar se usuário tem acesso ao schedule
    const { data: schedule } = await serviceSupabase
      .from('lab_pipeline_schedules')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Verificar role do usuário
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Verificar se tem acesso (owner ou admin)
    const hasAccess = user.id === schedule.user_id || 
      (profile && profile.role === 'admin')

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Buscar parâmetros
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')

    let query = serviceSupabase
      .from('lab_pipeline_schedule_runs')
      .select('*', { count: 'exact' })
      .eq('schedule_id', id)
      .order('started_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const offset = (page - 1) * limit
    const { data: runs, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('[Schedule Runs API] Erro ao buscar execuções:', error)
      throw error
    }

    return NextResponse.json({
      runs: runs || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('[Schedule Runs API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

