import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/lab-ia/webhooks/[path]
 * Recebe webhook e dispara execução de pipeline agendado
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const { path } = await params
    const webhookPath = `/${path}`

    // Usar service role para bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar webhook
    const { data: webhook, error: webhookError } = await serviceSupabase
      .from('lab_pipeline_webhooks')
      .select('*, schedule:lab_pipeline_schedules(*)')
      .eq('webhook_path', webhookPath)
      .eq('enabled', true)
      .single()

    if (webhookError || !webhook || !webhook.schedule) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    const schedule = webhook.schedule as any

    // Verificar secret token se configurado
    const webhookSecret = request.headers.get('x-webhook-secret')
    if (webhook.secret_token && webhook.secret_token !== webhookSecret) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    if (!schedule.enabled) {
      return NextResponse.json({ error: 'Schedule is disabled' }, { status: 400 })
    }

    // Obter body do webhook
    const body = await request.json().catch(() => ({}))
    const headers = Object.fromEntries(request.headers.entries())

    // Trigger execução do pipeline
    const runUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/lab-ia/pipelines/schedules/${schedule.id}/run`
    
    const runResponse = await fetch(runUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, // Usar service role para execução interna
      },
      body: JSON.stringify({
        input_messages: schedule.input_data?.messages || [
          { role: 'user', content: JSON.stringify({ webhook: body, headers }) },
        ],
        trigger_type: 'webhook',
        trigger_data: {
          webhook_path: webhookPath,
          body,
          headers,
        },
      }),
    })

    if (!runResponse.ok) {
      const errorData = await runResponse.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || 'Failed to trigger pipeline')
    }

    const runData = await runResponse.json()

    return NextResponse.json({
      success: true,
      message: 'Pipeline triggered successfully',
      run_id: runData.run_id,
    })
  } catch (error: any) {
    console.error('[Webhook API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

