import { NextRequest, NextResponse } from 'next/server'
import { runPipeline, ProgressCallback } from '@/modules/laboratorio-ia/services/pipelineRunner'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Função auxiliar para enviar evento SSE
function sendSSE(chunk: string) {
  return new TextEncoder().encode(`data: ${chunk}\n\n`)
}

export async function POST(request: NextRequest) {
  try {
    console.log('[LAB-IA][API][pipelines/run] Iniciando execução de pipeline')
    
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

    const { pipelineId, messages } = await request.json()

    if (!pipelineId) {
      return NextResponse.json(
        { error: 'pipelineId é obrigatório' },
        { status: 400 }
      )
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages é obrigatório e deve ser um array não vazio' },
        { status: 400 }
      )
    }

    console.log('[LAB-IA][API][pipelines/run] Executando pipeline:', { pipelineId, messagesCount: messages.length })

    // Criar stream SSE para progresso em tempo real
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Callback de progresso que envia eventos SSE
          const onProgress: ProgressCallback = (event) => {
            try {
              const eventData = JSON.stringify({
                type: 'progress',
                data: event,
              })
              controller.enqueue(sendSSE(eventData))
            } catch (err) {
              console.error('[LAB-IA][API][pipelines/run] Erro ao enviar evento SSE:', err)
            }
          }

          // Executar pipeline com callback de progresso
          const result = await runPipeline(pipelineId, messages, user.id, onProgress)

          console.log('[LAB-IA][API][pipelines/run] Pipeline executado com sucesso:', {
            stepsExecuted: result.results.length,
            totalLatency: result.totalLatency,
            totalCost: result.totalCost,
          })

          // Retornar apenas o output final (último resultado)
          const finalOutput = result.results[result.results.length - 1]?.output || ''

          console.log('[LAB-IA][API][pipelines/run] Output final length:', finalOutput?.length)
          console.log('[LAB-IA][API][pipelines/run] Output preview:', finalOutput?.substring(0, 200))

          // Enviar resultado final
          const finalData = JSON.stringify({
            type: 'done',
            data: {
              content: finalOutput,
              metadata: {
                pipelineId,
                stepsExecuted: result.results.length,
                totalLatency: result.totalLatency,
                totalCost: result.totalCost,
                stepResults: result.results.map(r => ({
                  agentId: r.agent_id,
                  latency: r.latency,
                  cost: r.cost,
                metadata: r.metadata || null,
                })),
              collaborations: result.results
                .filter(r => r.metadata?.teamKey)
                .map(r => ({
                  teamKey: r.metadata?.teamKey,
                  teamName: r.metadata?.teamName,
                  strategy: r.metadata?.strategy,
                  decision: r.metadata?.decision || null,
                  consensusStatus: r.metadata?.consensusStatus || null,
                })),
              },
            },
          })
          controller.enqueue(sendSSE(finalData))
          controller.close()
        } catch (error: any) {
          console.error('[LAB-IA][API][pipelines/run] Erro no stream:', error)
          
          // Enviar evento de erro
          const errorData = JSON.stringify({
            type: 'error',
            data: {
              error: error.message || 'Erro desconhecido ao executar pipeline',
              details: error.message,
              type: error.name || 'UnknownError',
            },
          })
          controller.enqueue(sendSSE(errorData))
          controller.close()
        }
      },
    })

    // Retornar response com SSE
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Desabilitar buffering do nginx
      },
    })
  } catch (error: any) {
    console.error('[LAB-IA][API][pipelines/run] Erro ao executar pipeline:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      error: error,
    })
    
    const errorMessage = error.message || 'Erro desconhecido ao executar pipeline'
    const errorStatus = error.status || (error.message?.includes('not found') ? 404 : 500)
    
    return NextResponse.json(
      { 
        error: 'Erro ao executar pipeline',
        details: errorMessage,
        type: error.name || 'UnknownError',
      },
      { status: errorStatus }
    )
  }
}

