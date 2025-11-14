import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runPipeline } from '@/modules/laboratorio-ia/services/pipelineRunner'
import { validateApiKey, checkRateLimit, recordApiUsage } from '@/modules/laboratorio-ia/services/apiKeyManager'

/**
 * POST /api/v1/pipelines/[id]/execute
 * Executa um pipeline via API pública
 * Requer autenticação via API key no header: Authorization: Bearer wak_xxx
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  let apiKeyData: any = null

  try {
    const { id: pipelineId } = await params

    // Extrair API key do header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'API key required. Use Authorization: Bearer wak_xxx header',
        },
        { status: 401 }
      )
    }

    const apiKey = authHeader.replace('Bearer ', '').trim()

    // Validar API key
    const validation = await validateApiKey(apiKey)
    if (!validation.valid || !validation.apiKeyData) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: validation.error || 'Invalid API key',
        },
        { status: 401 }
      )
    }

    apiKeyData = validation.apiKeyData

    // Verificar se API key está autorizada para este pipeline
    if (apiKeyData.pipeline_id !== pipelineId) {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: 'API key is not authorized for this pipeline',
        },
        { status: 403 }
      )
    }

    // Verificar rate limiting
    const rateLimitCheck = await checkRateLimit(apiKeyData.id)
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: rateLimitCheck.error || 'Too many requests',
          rate_limit: {
            remaining: rateLimitCheck.remaining,
            reset_at: {
              minute: rateLimitCheck.resetAt.minute.toISOString(),
              hour: rateLimitCheck.resetAt.hour.toISOString(),
              day: rateLimitCheck.resetAt.day.toISOString(),
            },
          },
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit-Minute': String(apiKeyData.rate_limits.per_minute),
            'X-RateLimit-Remaining-Minute': String(rateLimitCheck.remaining.minute),
            'X-RateLimit-Reset-Minute': rateLimitCheck.resetAt.minute.toISOString(),
            'X-RateLimit-Limit-Hour': String(apiKeyData.rate_limits.per_hour),
            'X-RateLimit-Remaining-Hour': String(rateLimitCheck.remaining.hour),
            'X-RateLimit-Reset-Hour': rateLimitCheck.resetAt.hour.toISOString(),
          },
        }
      )
    }

    // Obter input do body
    const body = await request.json().catch(() => ({}))
    const inputMessages = body.messages || body.input || [{
      role: 'user',
      content: body.message || body.text || 'Execute pipeline',
    }]

    // Validar que input_messages é um array
    if (!Array.isArray(inputMessages)) {
      return NextResponse.json(
        { error: 'Invalid input', message: 'messages must be an array' },
        { status: 400 }
      )
    }

    // Executar pipeline
    const result = await runPipeline(
      pipelineId,
      inputMessages,
      apiKeyData.user_id,
      undefined, // onProgress (SSE não suportado em API pública por enquanto)
      false // allowDraft
    )

    const responseTime = Date.now() - startTime

    // Registrar uso da API (em background para não bloquear resposta)
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    recordApiUsage(
      apiKeyData.id,
      pipelineId,
      'POST',
      `/api/v1/pipelines/${pipelineId}/execute`,
      200,
      {
        responseTimeMs: responseTime,
        costUsd: result.totalCost,
        ipAddress,
        userAgent,
      }
    ).catch(error => {
      console.error('[Pipeline API] Erro ao registrar uso:', error)
    })

    // Retornar resposta
    return NextResponse.json({
      success: true,
      data: {
        output: result.results.map(r => ({
          agent_id: r.agent_id,
          output: r.output,
        })),
        full_output: result.results.map(r => r.output).join('\n\n---\n\n'),
        metrics: {
          total_latency_ms: result.totalLatency,
          total_cost_usd: result.totalCost,
          steps_executed: result.results.length,
        },
      },
      rate_limit: {
        remaining: {
          minute: rateLimitCheck.remaining.minute - 1,
          hour: rateLimitCheck.remaining.hour - 1,
          day: rateLimitCheck.remaining.day - 1,
        },
      },
    }, {
      headers: {
        'X-RateLimit-Limit-Minute': String(apiKeyData.rate_limits.per_minute),
        'X-RateLimit-Remaining-Minute': String(rateLimitCheck.remaining.minute - 1),
        'X-RateLimit-Reset-Minute': rateLimitCheck.resetAt.minute.toISOString(),
      },
    })
  } catch (error: any) {
    const responseTime = Date.now() - startTime

    // Registrar uso com erro
    if (apiKeyData) {
      const ipAddress = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown'
      const userAgent = request.headers.get('user-agent') || 'unknown'

      recordApiUsage(
        apiKeyData.id,
        (await params).id,
        'POST',
        `/api/v1/pipelines/${(await params).id}/execute`,
        error.status || 500,
        {
          responseTimeMs: responseTime,
          ipAddress,
          userAgent,
        }
      ).catch(err => {
        console.error('[Pipeline API] Erro ao registrar uso:', err)
      })
    }

    console.error('[Pipeline API] Erro:', error)

    const statusCode = error.message?.includes('not found') ? 404 :
                      error.message?.includes('inactive') ? 400 : 500

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: statusCode }
    )
  }
}

/**
 * GET /api/v1/pipelines/[id]/execute
 * Retorna informações sobre o pipeline e documentação da API
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pipelineId } = await params

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar pipeline
    const { data: pipeline, error } = await serviceSupabase
      .from('lab_agent_pipelines')
      .select('id, name, description, active, steps')
      .eq('id', pipelineId)
      .single()

    if (error || !pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    if (!pipeline.active) {
      return NextResponse.json({ error: 'Pipeline is inactive' }, { status: 400 })
    }

    // Retornar documentação da API
    return NextResponse.json({
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        steps_count: pipeline.steps?.length || 0,
      },
      api_documentation: {
        endpoint: `/api/v1/pipelines/${pipelineId}/execute`,
        method: 'POST',
        authentication: {
          type: 'Bearer Token',
          header: 'Authorization: Bearer wak_xxx',
        },
        request_body: {
          messages: {
            type: 'array',
            description: 'Array de mensagens para o pipeline',
            example: [
              { role: 'user', content: 'Execute pipeline' },
            ],
          },
          input: {
            type: 'array',
            description: 'Alias para messages',
          },
          message: {
            type: 'string',
            description: 'Mensagem simples (será convertida para array)',
          },
        },
        response: {
          success: {
            type: 'boolean',
          },
          data: {
            output: {
              type: 'array',
              description: 'Outputs de cada step do pipeline',
            },
            full_output: {
              type: 'string',
              description: 'Output completo concatenado',
            },
            metrics: {
              total_latency_ms: 'number',
              total_cost_usd: 'number',
              steps_executed: 'number',
            },
          },
          rate_limit: {
            remaining: {
              minute: 'number',
              hour: 'number',
              day: 'number',
            },
          },
        },
      },
    })
  } catch (error: any) {
    console.error('[Pipeline API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

