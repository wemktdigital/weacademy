import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabaseServer'
import type { Database } from '@/lib/database.types'

type DashboardStats = {
  totalMessages: number
  totalConversations: number
  totalAgentsExecuted: number
  totalTokens: number
  totalCost: number
  costByProvider: {
    provider: string
    cost: number
  }[]
  costByModel: {
    provider: string
    model: string
    totalCost: number
    percentage: number
    executions: number
    avgCost: number
  }[]
  topAgents: {
    agent_id: string
    count: number
  }[]
  averageLatency: number
  costByUser: {
    userId: string
    email: string
    totalCost: number
    percentage: number
    executions: number
    modelsUsed: {
      provider: string
      model: string
      cost: number
      executions: number
    }[]
  }[]
}

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação via header Authorization
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    let user = null

    // Tentar autenticar via token primeiro
    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      )

      const { data: { user: tokenUser }, error: tokenError } = await supabaseWithToken.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      }
    }

    // Fallback para cookies se não autenticou via token
    if (!user) {
      const cookieStore = await cookies()
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            storage: {
              getItem: async (key: string) => cookieStore.get(key)?.value || null,
              setItem: async (key: string, value: string) => {
                // Não implementado - cookies são gerenciados pelo servidor
              },
              removeItem: async (key: string) => {
                // Não implementado - cookies são gerenciados pelo servidor
              },
            },
          },
        }
      )
      
      const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
      if (!authError && cookieUser) {
        user = cookieUser
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verificar se é admin ou gestor usando service role para bypass RLS
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await serviceRoleSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'gestor_we'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Buscar estatísticas de mensagens
    const { count: messageCount } = await serviceRoleSupabase
      .from('lab_messages')
      .select('*', { count: 'exact', head: true })

    // Buscar estatísticas de conversas
    const { count: conversationCount } = await serviceRoleSupabase
      .from('lab_conversations')
      .select('*', { count: 'exact', head: true })

    // Buscar estatísticas de agentes executados
    const { count: agentCount } = await serviceRoleSupabase
      .from('lab_agent_logs')
      .select('*', { count: 'exact', head: true })

    // Buscar custo total e por provedor/modelo
    const { data: costData } = await serviceRoleSupabase
      .from('lab_agent_logs')
      .select('user_id, provider, model, cost_usd')

    // Também buscar custos de pipelines
    const { data: pipelineCostData } = await serviceRoleSupabase
      .from('lab_pipeline_logs')
      .select('user_id, total_cost_usd')

    let totalCost = 0
    const costByProvider: Record<string, number> = {}
    const costByModel: Record<string, { provider: string; model: string; cost: number; executions: number }> = {}

    // Processar custos de agentes
    costData?.forEach((row) => {
      const cost = parseFloat(row.cost_usd?.toString() || '0')
      totalCost += cost
      
      if (row.provider) {
        costByProvider[row.provider] = (costByProvider[row.provider] || 0) + cost
      }

      // Agrupar por modelo
      if (row.provider && row.model) {
        const key = `${row.provider}:${row.model}`
        if (!costByModel[key]) {
          costByModel[key] = {
            provider: row.provider,
            model: row.model,
            cost: 0,
            executions: 0,
          }
        }
        costByModel[key].cost += cost
        costByModel[key].executions += 1
      }
    })

    // Processar custos de pipelines
    pipelineCostData?.forEach((row) => {
      const cost = parseFloat(row.total_cost_usd?.toString() || '0')
      totalCost += cost
    })

    // Buscar agentes mais usados
    const { data: agentUsage } = await serviceRoleSupabase
      .from('lab_agent_logs')
      .select('agent_id')
    
    const agentCounts: Record<string, number> = {}
    agentUsage?.forEach((row) => {
      if (row.agent_id) {
        agentCounts[row.agent_id] = (agentCounts[row.agent_id] || 0) + 1
      }
    })

    const topAgents = Object.entries(agentCounts)
      .map(([agent_id, count]) => ({ agent_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Buscar latência média
    const { data: latencyData } = await serviceRoleSupabase
      .from('lab_agent_logs')
      .select('latency_ms')
    
    const latencies = latencyData?.map(row => row.latency_ms).filter(Boolean) || []
    const averageLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0

    // Buscar tokens totais
    const { data: tokensData } = await serviceRoleSupabase
      .from('lab_agent_logs')
      .select('input_tokens, output_tokens')
    
    let totalTokens = 0
    tokensData?.forEach((row) => {
      const inputTokens = row.input_tokens || 0
      const outputTokens = row.output_tokens || 0
      totalTokens += inputTokens + outputTokens
    })

    // Calcular custos por modelo com percentuais
    const costByModelArray = Object.values(costByModel)
      .map((item) => ({
        provider: item.provider,
        model: item.model,
        totalCost: parseFloat(item.cost.toFixed(4)),
        percentage: totalCost > 0 ? parseFloat(((item.cost / totalCost) * 100).toFixed(2)) : 0,
        executions: item.executions,
        avgCost: parseFloat((item.cost / item.executions).toFixed(4)),
      }))
      .sort((a, b) => b.totalCost - a.totalCost)

    // Calcular custos por usuário
    const costByUserMap: Record<string, {
      totalCost: number
      executions: number
      modelsUsed: Record<string, { provider: string; model: string; cost: number; executions: number }>
    }> = {}

    // Processar custos de agentes por usuário
    costData?.forEach((row) => {
      if (!row.user_id) return
      
      const cost = parseFloat(row.cost_usd?.toString() || '0')
      
      if (!costByUserMap[row.user_id]) {
        costByUserMap[row.user_id] = {
          totalCost: 0,
          executions: 0,
          modelsUsed: {},
        }
      }
      
      costByUserMap[row.user_id].totalCost += cost
      costByUserMap[row.user_id].executions += 1

      // Agrupar modelos por usuário
      if (row.provider && row.model) {
        const modelKey = `${row.provider}:${row.model}`
        if (!costByUserMap[row.user_id].modelsUsed[modelKey]) {
          costByUserMap[row.user_id].modelsUsed[modelKey] = {
            provider: row.provider,
            model: row.model,
            cost: 0,
            executions: 0,
          }
        }
        costByUserMap[row.user_id].modelsUsed[modelKey].cost += cost
        costByUserMap[row.user_id].modelsUsed[modelKey].executions += 1
      }
    })

    // Processar custos de pipelines por usuário
    pipelineCostData?.forEach((row) => {
      if (!row.user_id) return
      
      const cost = parseFloat(row.total_cost_usd?.toString() || '0')
      
      if (!costByUserMap[row.user_id]) {
        costByUserMap[row.user_id] = {
          totalCost: 0,
          executions: 0,
          modelsUsed: {},
        }
      }
      
      costByUserMap[row.user_id].totalCost += cost
    })

    // Buscar emails dos usuários
    const userIds = Object.keys(costByUserMap)
    const userEmailsMap = new Map<string, string>()
    
    if (userIds.length > 0) {
      const { data: allUsers } = await serviceRoleSupabase.auth.admin.listUsers()
      allUsers.users?.forEach(user => {
        if (userIds.includes(user.id)) {
          userEmailsMap.set(user.id, user.email || 'N/A')
        }
      })
    }

    // Criar array de custos por usuário
    const costByUserArray = Object.entries(costByUserMap)
      .map(([userId, data]) => ({
        userId,
        email: userEmailsMap.get(userId) || 'N/A',
        totalCost: parseFloat(data.totalCost.toFixed(4)),
        percentage: totalCost > 0 ? parseFloat(((data.totalCost / totalCost) * 100).toFixed(2)) : 0,
        executions: data.executions,
        modelsUsed: Object.values(data.modelsUsed)
          .map(item => ({
            provider: item.provider,
            model: item.model,
            cost: parseFloat(item.cost.toFixed(4)),
            executions: item.executions,
          }))
          .sort((a, b) => b.cost - a.cost),
      }))
      .sort((a, b) => b.totalCost - a.totalCost)

    const stats: DashboardStats = {
      totalMessages: messageCount || 0,
      totalConversations: conversationCount || 0,
      totalAgentsExecuted: agentCount || 0,
      totalTokens,
      totalCost: parseFloat(totalCost.toFixed(4)),
      costByProvider: Object.entries(costByProvider).map(([provider, cost]) => ({
        provider,
        cost: parseFloat(cost.toFixed(4)),
      })),
      costByModel: costByModelArray,
      topAgents,
      averageLatency,
      costByUser: costByUserArray,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
