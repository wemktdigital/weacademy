import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { runPipeline, ProgressCallback } from '@/modules/laboratorio-ia/services/pipelineRunner'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    // Resolver params (pode ser Promise no Next.js 15+)
    const params = await props.params
    const pipelineId = params.id

    console.log('[API][pipelines/test] POST - Pipeline ID recebido:', pipelineId)

    if (!pipelineId) {
      return NextResponse.json(
        { error: 'Pipeline ID é obrigatório', success: false },
        { status: 400 }
      )
    }

    // Autenticação
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user: any = null

    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await supabaseWithToken.auth.getUser(token)
      if (!error && data?.user) {
        user = data.user
      }
    }

    // Fallback para verificação de sessão
    if (!user) {
      try {
        const supabase = await supabaseServer()
        const { data, error } = await supabase.auth.getUser()
        if (!error && data?.user) {
          user = data.user
        }
      } catch (err) {
        console.error('[API][pipelines/test] POST - Erro ao usar supabaseServer:', err)
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      )
    }

    // Verificar role
    const serviceRoleForProfile = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: profile } = await serviceRoleForProfile
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', success: false },
        { status: 403 }
      )
    }

    // Obter dados do request
    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'message é obrigatório', success: false },
        { status: 400 }
      )
    }

    // Buscar pipeline (apenas drafts podem ser testados)
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('[API][pipelines/test] Buscando pipeline com ID:', pipelineId)

    const { data: pipeline, error: pipelineError } = await serviceRoleSupabase
      .from('lab_agent_pipelines')
      .select('*')
      .eq('id', pipelineId)
      .single()

    if (pipelineError || !pipeline) {
      console.error('[API][pipelines/test] Erro ao buscar pipeline:', {
        error: pipelineError,
        pipelineId,
        errorMessage: pipelineError?.message,
        errorCode: pipelineError?.code,
      })
      return NextResponse.json(
        {
          error: 'Pipeline não encontrado',
          details: pipelineError?.message || 'Nenhum pipeline encontrado com o ID fornecido',
          success: false
        },
        { status: 404 }
      )
    }

    console.log('[API][pipelines/test] Pipeline encontrado:', {
      id: pipeline.id,
      name: pipeline.name,
      active: pipeline.active,
      draft: pipeline.draft,
      steps: pipeline.steps?.length,
    })

    // Verificar se é draft (opcional, mas recomendado)
    if (!pipeline.draft) {
      console.warn(`[API][pipelines/test] Pipeline ${pipelineId} não é draft, mas permitindo teste`)
    }

    // Criar stream SSE para progresso em tempo real
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Função auxiliar para enviar evento SSE
          const sendSSE = (chunk: string) => {
            return new TextEncoder().encode(`data: ${chunk}\n\n`)
          }

          // Callback de progresso que envia eventos SSE
          const onProgress: ProgressCallback = (event) => {
            try {
              const eventData = JSON.stringify({
                type: 'progress',
                data: event,
              })
              controller.enqueue(sendSSE(eventData))
            } catch (err) {
              console.error('[API][pipelines/test] Erro ao enviar evento SSE:', err)
            }
          }

          // Executar o pipeline
          console.log(`[API][pipelines/test] Executando teste do pipeline ${pipelineId}`)

          const messages = [
            {
              role: 'user' as const,
              content: message,
            },
          ]

          const result = await runPipeline(pipeline.id, messages, user.id, onProgress, true)

          console.log(`[API][pipelines/test] Pipeline executado com sucesso`)

          // Atualizar last_tested_at
          await serviceRoleSupabase
            .from('lab_agent_pipelines')
            .update({ last_tested_at: new Date().toISOString() })
            .eq('id', pipelineId)

          // Obter detalhes dos agentes para retornar nomes
          const agentDetails = await Promise.all(
            result.results.map(async (stepResult) => {
              try {
                const { data: agent } = await serviceRoleSupabase
                  .from('lab_agents')
                  .select('name, icon')
                  .eq('id', stepResult.agent_id)
                  .single()
                return {
                  agent_id: stepResult.agent_id,
                  agent_name: agent?.name || 'Agente Desconhecido',
                  agent_icon: agent?.icon || '',
                  output: stepResult.output,
                  latency: stepResult.latency,
                  cost: stepResult.cost,
                  metadata: stepResult.metadata || null,
                }
              } catch {
                return {
                  agent_id: stepResult.agent_id,
                  agent_name: 'Agente Desconhecido',
                  agent_icon: '',
                  output: stepResult.output,
                  latency: stepResult.latency,
                  cost: stepResult.cost,
                  metadata: stepResult.metadata || null,
                }
              }
            })
          )

          const collaborationSummaries = result.results
            .filter((stepResult) => stepResult.metadata?.teamKey)
            .map((stepResult) => ({
              teamKey: stepResult.metadata?.teamKey,
              teamName: stepResult.metadata?.teamName,
              strategy: stepResult.metadata?.strategy,
              decision: stepResult.metadata?.decision || null,
              consensusStatus: stepResult.metadata?.consensusStatus || null,
            }))

          // Enviar resultado final
          const finalData = JSON.stringify({
            type: 'done',
            data: {
              success: true,
              steps: agentDetails,
              metrics: {
                steps_executed: result.results.length,
                total_latency_ms: result.totalLatency,
                total_cost_usd: result.totalCost,
              },
              collaborations: collaborationSummaries,
            },
          })
          controller.enqueue(sendSSE(finalData))
          controller.close()
        } catch (error: any) {
          console.error('[API][pipelines/test] Erro no stream:', error)

          // Enviar evento de erro
          const sendSSE = (chunk: string) => {
            return new TextEncoder().encode(`data: ${chunk}\n\n`)
          }
          const errorData = JSON.stringify({
            type: 'error',
            data: {
              error: error.message || 'Erro desconhecido ao testar pipeline',
              details: error.message,
              success: false,
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
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error: any) {
    console.error('Error testing pipeline:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
        success: false,
      },
      { status: 500 }
    )
  }
}

