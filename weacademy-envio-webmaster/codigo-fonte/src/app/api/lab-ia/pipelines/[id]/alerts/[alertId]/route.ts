import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * PUT /api/lab-ia/pipelines/[id]/alerts/[alertId]
 * Atualiza status de um alerta
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; alertId: string }> }
) {
  try {
    const { id: pipelineId, alertId } = await params
    
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
    const { status } = body

    if (!status || !['active', 'acknowledged', 'resolved', 'dismissed'].includes(status)) {
      return NextResponse.json(
        { error: 'Status inválido' },
        { status: 400 }
      )
    }

    const updateData: any = { status }
    
    if (status === 'acknowledged' || status === 'resolved') {
      updateData.acknowledged_at = new Date().toISOString()
    }
    
    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString()
    }

    const { data, error } = await serviceSupabase
      .from('lab_pipeline_alerts')
      .update(updateData)
      .eq('id', alertId)
      .eq('pipeline_id', pipelineId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      alert: data,
    })
  } catch (error: any) {
    console.error('[Alerts API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

