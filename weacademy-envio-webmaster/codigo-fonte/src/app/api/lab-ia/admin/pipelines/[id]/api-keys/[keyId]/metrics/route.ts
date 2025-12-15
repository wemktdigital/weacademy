import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/lab-ia/admin/pipelines/[id]/api-keys/[keyId]/metrics
 * Retorna métricas de uso de uma API key
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  try {
    const { id: pipelineId, keyId } = await params

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
    const period = searchParams.get('period') || 'day' // hour, day, week, month

    // Calcular intervalo de tempo
    const now = new Date()
    let startDate: Date
    
    switch (period) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    // Buscar métricas
    const { data: usage, error: usageError } = await serviceSupabase
      .from('lab_pipeline_api_usage')
      .select('*')
      .eq('api_key_id', keyId)
      .eq('pipeline_id', pipelineId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (usageError) {
      console.error('[API Metrics] Erro ao buscar métricas:', usageError)
      throw usageError
    }

    // Calcular estatísticas
    const totalRequests = usage?.length || 0
    const successfulRequests = usage?.filter(u => u.success).length || 0
    const failedRequests = totalRequests - successfulRequests
    const totalCost = usage?.reduce((sum, u) => sum + (u.cost_usd || 0), 0) || 0
    const avgResponseTime = usage && usage.length > 0
      ? usage.reduce((sum, u) => sum + (u.response_time_ms || 0), 0) / usage.length
      : 0

    // Agrupar por status code
    const requestsByStatus: Record<number, number> = {}
    usage?.forEach(u => {
      const status = u.status_code || 500
      requestsByStatus[status] = (requestsByStatus[status] || 0) + 1
    })

    // Agrupar por timestamp (para gráficos)
    const requestsOverTime: Array<{ timestamp: string; count: number }> = []
    if (usage && usage.length > 0) {
      // Agrupar por hora/dia dependendo do período
      const interval = period === 'hour' ? 60 * 1000 : period === 'day' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      
      const grouped = new Map<string, number>()
      usage.forEach(u => {
        const timestamp = new Date(u.created_at)
        const rounded = new Date(Math.floor(timestamp.getTime() / interval) * interval)
        const key = rounded.toISOString()
        grouped.set(key, (grouped.get(key) || 0) + 1)
      })

      requestsOverTime.push(...Array.from(grouped.entries()).map(([timestamp, count]) => ({
        timestamp,
        count,
      })).sort((a, b) => a.timestamp.localeCompare(b.timestamp)))
    }

    return NextResponse.json({
      period,
      metrics: {
        total_requests: totalRequests,
        successful_requests: successfulRequests,
        failed_requests: failedRequests,
        success_rate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
        total_cost_usd: totalCost,
        average_response_time_ms: Math.round(avgResponseTime),
        requests_by_status: requestsByStatus,
        requests_over_time: requestsOverTime,
      },
    })
  } catch (error: any) {
    console.error('[API Metrics] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

