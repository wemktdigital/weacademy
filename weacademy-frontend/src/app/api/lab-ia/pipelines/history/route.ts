import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação via header Authorization
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    let user: any = null

    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      )
      const { data, error } = await supabaseWithToken.auth.getUser(token)
      if (!error && data?.user) {
        user = data.user
      }
    }

    // Fallback para verificação de sessão
    if (!user) {
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session) {
        user = sessionData.session.user
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Buscar role do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Verificar se é guest (que não deveria ter acesso)
    if (profile?.role === 'guest') {
      return NextResponse.json(
        { error: 'Acesso negado. Guest não pode usar o Laboratório de IA' },
        { status: 403 }
      )
    }

    const isAdmin = profile?.role === 'admin' || profile?.role === 'gestor_we' || profile?.role === 'gestor'
    
    // Parâmetros de query
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    const pipelineId = searchParams.get('pipeline_id')
    const userId = searchParams.get('user_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const searchQuery = searchParams.get('search')

    // Usar service role para bypass RLS e ter controle total
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Construir query base
    let query = serviceRoleSupabase
      .from('lab_pipeline_logs')
      .select(`
        *,
        pipeline:lab_agent_pipelines(
          id,
          name,
          description
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Aplicar filtros
    if (pipelineId) {
      query = query.eq('pipeline_id', pipelineId)
    }

    // Se não for admin, apenas mostrar logs do próprio usuário
    if (!isAdmin) {
      query = query.eq('user_id', user.id)
    } else if (userId) {
      // Admin pode filtrar por usuário específico
      query = query.eq('user_id', userId)
    }

    // Filtro de data
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Paginação
    query = query.range(offset, offset + limit - 1)

    const { data: logs, error, count } = await query

    if (error) {
      throw error
    }

    // Se houver busca por palavra-chave, filtrar localmente (não eficiente para grandes volumes)
    let filteredLogs = logs || []
    if (searchQuery && searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase()
      filteredLogs = filteredLogs.filter((log: any) => {
        // Buscar no input_messages
        const inputStr = JSON.stringify(log.input_messages || {}).toLowerCase()
        // Buscar no output_messages
        const outputStr = JSON.stringify(log.output_messages || {}).toLowerCase()
        // Buscar no nome do pipeline
        const pipelineName = (log.pipeline?.name || '').toLowerCase()
        
        return inputStr.includes(searchLower) || 
               outputStr.includes(searchLower) || 
               pipelineName.includes(searchLower)
      })
    }
    
    // Buscar dados dos usuários separadamente (apenas se necessário)
    if (isAdmin && filteredLogs.length > 0) {
      const userIds = [...new Set(filteredLogs.map((log: any) => log.user_id).filter(Boolean))]
      if (userIds.length > 0) {
        const { data: usersData } = await serviceRoleSupabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds)
        
        const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]))
        filteredLogs = filteredLogs.map((log: any) => ({
          ...log,
          user: usersMap.get(log.user_id) || null,
        }))
      }
    }

    return NextResponse.json({
      logs: filteredLogs,
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('[LAB-IA][API][pipelines/history] Erro:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao buscar histórico',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

