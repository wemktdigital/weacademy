import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/v1/openapi.json
 * Retorna documentação OpenAPI dos endpoints de pipelines
 */
export async function GET(request: NextRequest) {
  try {
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar pipelines ativos que têm API keys
    const { data: pipelines } = await serviceSupabase
      .from('lab_agent_pipelines')
      .select('id, name, description')
      .eq('active', true)
      .order('name')

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Gerar OpenAPI spec
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'WE Academy Pipeline API',
        version: '1.0.0',
        description: 'API pública para executar pipelines de agentes de IA',
        contact: {
          name: 'WE Academy',
          url: 'https://weacademy.com',
        },
      },
      servers: [
        {
          url: baseUrl,
          description: 'Production server',
        },
      ],
      security: [
        {
          ApiKeyAuth: [],
        },
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
            description: 'API Key no formato: Bearer pk_live_xxx ou Bearer pk_test_xxx',
          },
        },
        schemas: {
          PipelineExecutionRequest: {
            type: 'object',
            properties: {
              input: {
                oneOf: [
                  { type: 'string' },
                  { type: 'array', items: { type: 'string' } },
                ],
                description: 'Input message(s) for the pipeline',
                example: 'Create a post about surgery',
              },
              message: {
                type: 'string',
                description: 'Alternative: single message string',
                example: 'Create a post about surgery',
              },
              messages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                    content: { type: 'string' },
                  },
                },
                description: 'Alternative: array of messages',
              },
            },
          },
          PipelineExecutionResponse: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the execution was successful',
              },
              pipeline_id: {
                type: 'string',
                format: 'uuid',
                description: 'ID of the executed pipeline',
              },
              pipeline_name: {
                type: 'string',
                description: 'Name of the executed pipeline',
              },
              output: {
                type: 'string',
                description: 'Final output of the pipeline',
              },
              steps: {
                type: 'array',
                description: 'Output of each step',
                items: {
                  type: 'object',
                  properties: {
                    agent_id: { type: 'string', format: 'uuid' },
                    output: { type: 'string' },
                    latency_ms: { type: 'number' },
                    cost_usd: { type: 'number' },
                  },
                },
              },
              metrics: {
                type: 'object',
                properties: {
                  total_steps: { type: 'number' },
                  total_latency_ms: { type: 'number' },
                  total_cost_usd: { type: 'number' },
                },
              },
            },
          },
          Error: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
      paths: {
        '/api/v1/pipelines/{pipelineId}/execute': {
          get: {
            summary: 'Get pipeline API documentation',
            description: 'Returns documentation for executing a specific pipeline via API',
            operationId: 'getPipelineApiDocs',
            parameters: [
              {
                name: 'pipelineId',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'ID of the pipeline',
              },
            ],
            responses: {
              '200': {
                description: 'Pipeline API documentation',
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
              '404': {
                description: 'Pipeline not found',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
            },
          },
          post: {
            summary: 'Execute pipeline',
            description: 'Execute a pipeline with the provided input',
            operationId: 'executePipeline',
            security: [{ ApiKeyAuth: [] }],
            parameters: [
              {
                name: 'pipelineId',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'ID of the pipeline',
              },
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PipelineExecutionRequest' },
                },
              },
            },
            responses: {
              '200': {
                description: 'Pipeline executed successfully',
                headers: {
                  'X-RateLimit-Limit-Minute': {
                    schema: { type: 'integer' },
                    description: 'Rate limit per minute',
                  },
                  'X-RateLimit-Limit-Hour': {
                    schema: { type: 'integer' },
                    description: 'Rate limit per hour',
                  },
                  'X-RateLimit-Limit-Day': {
                    schema: { type: 'integer' },
                    description: 'Rate limit per day',
                  },
                  'X-RateLimit-Remaining-Minute': {
                    schema: { type: 'integer' },
                    description: 'Remaining requests this minute',
                  },
                  'X-RateLimit-Remaining-Hour': {
                    schema: { type: 'integer' },
                    description: 'Remaining requests this hour',
                  },
                  'X-RateLimit-Remaining-Day': {
                    schema: { type: 'integer' },
                    description: 'Remaining requests this day',
                  },
                },
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/PipelineExecutionResponse' },
                  },
                },
              },
              '401': {
                description: 'Invalid or missing API key',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
              '403': {
                description: 'API key not authorized for this pipeline',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
              '429': {
                description: 'Rate limit exceeded',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        error: { type: 'string' },
                        rate_limit: { type: 'object' },
                      },
                    },
                  },
                },
              },
              '500': {
                description: 'Internal server error',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
            },
          },
        },
      },
      tags: [
        {
          name: 'Pipelines',
          description: 'Pipeline execution endpoints',
        },
      ],
    }

    // Adicionar exemplos de pipelines disponíveis
    if (pipelines && pipelines.length > 0) {
      (openApiSpec.paths as any)['/api/v1/pipelines'] = {
        get: {
          summary: 'List available pipelines',
          description: 'Returns list of pipelines that can be executed via API',
          operationId: 'listPipelines',
          responses: {
            '200': {
              description: 'List of available pipelines',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      pipelines: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string', format: 'uuid' },
                            name: { type: 'string' },
                            description: { type: 'string' },
                            endpoint: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                  example: {
                    pipelines: pipelines.map(p => ({
                      id: p.id,
                      name: p.name,
                      description: p.description,
                      endpoint: `/api/v1/pipelines/${p.id}/execute`,
                    })),
                  },
                },
              },
            },
          },
        },
      }
    }

    return NextResponse.json(openApiSpec, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: any) {
    console.error('[OpenAPI] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

