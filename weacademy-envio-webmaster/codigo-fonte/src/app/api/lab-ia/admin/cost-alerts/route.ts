import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const costAlertSchema = z.object({
  pipeline_id: z.string().uuid().optional().nullable(),
  alert_type: z.enum(['cost_limit', 'cost_spike', 'daily_limit', 'weekly_limit']),
  threshold_usd: z.number().positive().optional(),
  threshold_percent: z.number().positive().max(1000).optional(),
  enabled: z.boolean().default(true),
  notification_email: z.boolean().default(false),
  notification_in_app: z.boolean().default(true),
}).refine(
  (data) => {
    // Pelo menos um threshold deve ser fornecido
    return data.threshold_usd !== undefined || data.threshold_percent !== undefined
  },
  { message: 'threshold_usd ou threshold_percent deve ser fornecido' }
)

/**
 * GET /api/lab-ia/admin/cost-alerts
 * Lista alertas de custo do usuário
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

    // Buscar parâmetros
    const { searchParams } = new URL(request.url)
    const pipelineId = searchParams.get('pipeline_id')

    let query = serviceSupabase
      .from('lab_pipeline_cost_alerts')
      .select('*, pipeline:lab_agent_pipelines(id, name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (pipelineId) {
      query = query.eq('pipeline_id', pipelineId)
    }

    const { data: alerts, error } = await query

    if (error) {
      console.error('[Cost Alerts API] Erro ao buscar:', error)
      throw error
    }

    return NextResponse.json({
      alerts: alerts || [],
    })
  } catch (error: any) {
    console.error('[Cost Alerts API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lab-ia/admin/cost-alerts
 * Cria novo alerta de custo
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

    // Validar e parsear body
    const body = await request.json()
    const validatedData = costAlertSchema.parse(body)

    // Criar alerta
    const { data: alert, error: insertError } = await serviceSupabase
      .from('lab_pipeline_cost_alerts')
      .insert({
        user_id: user.id,
        pipeline_id: validatedData.pipeline_id || null,
        alert_type: validatedData.alert_type,
        threshold_usd: validatedData.threshold_usd || null,
        threshold_percent: validatedData.threshold_percent || null,
        enabled: validatedData.enabled ?? true,
        notification_email: validatedData.notification_email ?? false,
        notification_in_app: validatedData.notification_in_app ?? true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Cost Alerts API] Erro ao criar:', insertError)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      alert,
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Cost Alerts API] Erro ao criar:', error)
    
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

