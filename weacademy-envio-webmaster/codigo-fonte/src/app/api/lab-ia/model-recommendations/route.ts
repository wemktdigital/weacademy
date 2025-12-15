import { NextRequest, NextResponse } from 'next/server'
import { intelligentRoute } from '@/modules/laboratorio-ia/services/intelligentRouter'

export async function POST(request: NextRequest) {
  try {
    const { prompt, messages = [], preferences } = await request.json()

    if (!prompt && (!messages || messages.length === 0)) {
      return NextResponse.json(
        { error: 'Prompt ou mensagens são obrigatórios' },
        { status: 400 }
      )
    }

    // Usar prompt ou última mensagem do usuário
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()
    const promptText = prompt || lastUserMessage?.content || messages[messages.length - 1]?.content

    if (!promptText) {
      return NextResponse.json(
        { error: 'Nenhum prompt encontrado' },
        { status: 400 }
      )
    }

    // Obter recomendações usando routing inteligente com preferências
    const routingResult = intelligentRoute(
      promptText,
      messages,
      preferences ? {
        maxCost: preferences.maxCostUsd || undefined,
        requiresSpeed: preferences.preferSpeed,
        requiresAccuracy: preferences.preferAccuracy,
      } : undefined
    )

    return NextResponse.json({
      success: true,
      recommendation: routingResult.recommended,
      alternatives: routingResult.alternatives,
      fallbackChain: routingResult.fallbackChain,
    })
  } catch (error: any) {
    console.error('[API] Erro ao obter recomendações:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao obter recomendações' },
      { status: 500 }
    )
  }
}

