import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
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
  topAgents: {
    agent_id: string
    count: number
  }[]
  averageLatency: number
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verificar se é admin ou gestor
    const { data: profile } = await supabase
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
    const { count: messageCount } = await supabase
      .from('lab_messages')
      .select('*', { count: 'exact', head: true })

    // Buscar estatísticas de conversas
    const { count: conversationCount } = await supabase
      .from('lab_conversations')
      .select('*', { count: 'exact', head: true })

    // Buscar estatísticas de agentes executados
    const { count: agentCount } = await supabase
      .from('lab_agent_logs')
      .select('*', { count: 'exact', head: true })

    // Buscar custo total e por provedor (assumindo que temos lab_chat_logs)
    // Por enquanto vamos usar lab_agent_logs como proxy
    const { data: costData } = await supabase
      .from('lab_agent_logs')
      .select('provider, cost_usd')

    let totalCost = 0
    const costByProvider: Record<string, number> = {}

    costData?.forEach((row) => {
      const cost = parseFloat(row.cost_usd?.toString() || '0')
      totalCost += cost
      
      if (row.provider) {
        costByProvider[row.provider] = (costByProvider[row.provider] || 0) + cost
      }
    })

    // Buscar agentes mais usados
    const { data: agentUsage } = await supabase
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
    const { data: latencyData } = await supabase
      .from('lab_agent_logs')
      .select('latency_ms')
    
    const latencies = latencyData?.map(row => row.latency_ms).filter(Boolean) || []
    const averageLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0

    const stats: DashboardStats = {
      totalMessages: messageCount || 0,
      totalConversations: conversationCount || 0,
      totalAgentsExecuted: agentCount || 0,
      totalTokens: 0, // TODO: adicionar quando lab_chat_logs estiver implementado
      totalCost: parseFloat(totalCost.toFixed(4)),
      costByProvider: Object.entries(costByProvider).map(([provider, cost]) => ({
        provider,
        cost: parseFloat(cost.toFixed(4)),
      })),
      topAgents,
      averageLatency,
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
