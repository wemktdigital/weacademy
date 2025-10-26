import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/modules/laboratorio-ia/services/llmRouter'
import { supabase } from '@/lib/supabase'
import { getAgentById } from '@/modules/laboratorio-ia/agents'

export async function POST(request: NextRequest) {
  try {
    const { 
      messages, 
      provider = 'OpenAI', 
      model = 'gpt-5-nano',
      agentId 
    } = await request.json()

    // Validar mensagens
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Mensagens inválidas' },
        { status: 400 }
      )
    }

    // Se há agentId, buscar agente e injetar system prompt
    let formattedMessages = [...messages]
    if (agentId) {
      const agent = getAgentById(agentId)
      if (agent) {
        // Inserir system prompt no início
        formattedMessages.unshift({
          role: 'system',
          content: agent.prompt,
        })
      }
    }

    const startTime = Date.now()

    // Chamar LLM Router
    const response = await callLLM({
      provider,
      model,
      messages: formattedMessages,
      stream: true,
    })

    const latency = Date.now() - startTime

    // Log de agente se aplicável
    if (agentId) {
      // Buscar userId (assumindo que está no header ou auth)
      const authHeader = request.headers.get('authorization')
      // Por enquanto, log sem userId - ajustar depois
      try {
        await supabase.from('lab_agent_logs').insert({
          agent_id: agentId,
          provider,
          model,
          latency_ms: latency,
          cost_usd: 0, // Será calculado depois se necessário
        })
      } catch (err) {
        console.error('Erro ao logar agente:', err)
      }
    }

    if (!response.stream) {
      return NextResponse.json(
        { error: 'Stream não disponível' },
        { status: 500 }
      )
    }

    // Retornar stream
    return new Response(response.stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Erro na API de chat:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar chat' },
      { status: 500 }
    )
  }
}
