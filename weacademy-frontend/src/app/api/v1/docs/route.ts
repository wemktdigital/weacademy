import { NextResponse } from 'next/server'

/**
 * GET /api/v1/docs
 * Retorna documentação OpenAPI da API de pipelines
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'WE Academy Pipeline API',
      version: '1.0.0',
      description: 'API REST para executar pipelines de IA via integração externa',
      contact: {
        name: 'WE Academy',
      },
    },
    servers: [
      {
        url: `${baseUrl}/api/v1`,
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'wak_xxx',
          description: 'API Key no formato Bearer token. Obtenha sua API key no painel administrativo.',
        },
      },
    },
    paths: {
      '/pipelines/{pipelineId}/execute': {
        get: {
          summary: 'Documentação do pipeline',
          description: 'Retorna informações sobre o pipeline e documentação da API',
          operationId: 'getPipelineDocumentation',
          tags: ['Pipelines'],
          parameters: [
            {
              name: 'pipelineId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid',
              },
              description: 'ID do pipeline',
            },
          ],
          responses: {
            '200': {
              description: 'Informações do pipeline e documentação',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      pipeline: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          description: { type: 'string' },
                          steps_count: { type: 'number' },
                        },
                      },
                      api_documentation: {
                        type: 'object',
                      },
                    },
                  },
                },
              },
            },
            '404': {
              description: 'Pipeline não encontrado',
            },
          },
        },
        post: {
          summary: 'Executar pipeline',
          description: 'Executa um pipeline com as mensagens fornecidas',
          operationId: 'executePipeline',
          tags: ['Pipelines'],
          security: [
            {
              ApiKeyAuth: [],
            },
          ],
          parameters: [
            {
              name: 'pipelineId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid',
              },
              description: 'ID do pipeline',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    messages: {
                      type: 'array',
                      description: 'Array de mensagens para o pipeline',
                      items: {
                        type: 'object',
                        properties: {
                          role: {
                            type: 'string',
                            enum: ['user', 'assistant', 'system'],
                          },
                          content: {
                            type: 'string',
                          },
                        },
                        required: ['role', 'content'],
                      },
                      example: [
                        { role: 'user', content: 'Criar post sobre cirurgia' },
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
                },
                examples: {
                  simple: {
                    summary: 'Mensagem simples',
                    value: {
                      message: 'Criar post sobre cirurgia',
                    },
                  },
                  array: {
                    summary: 'Array de mensagens',
                    value: {
                      messages: [
                        { role: 'user', content: 'Criar post sobre cirurgia' },
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Pipeline executado com sucesso',
              headers: {
                'X-RateLimit-Limit-Minute': {
                  schema: { type: 'string' },
                  description: 'Limite de requests por minuto',
                },
                'X-RateLimit-Remaining-Minute': {
                  schema: { type: 'string' },
                  description: 'Requests restantes neste minuto',
                },
                'X-RateLimit-Reset-Minute': {
                  schema: { type: 'string' },
                  description: 'Data/hora de reset do limite por minuto',
                },
              },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          output: {
                            type: 'array',
                            description: 'Outputs de cada step do pipeline',
                            items: {
                              type: 'object',
                              properties: {
                                agent_id: { type: 'string' },
                                output: { type: 'string' },
                              },
                            },
                          },
                          full_output: {
                            type: 'string',
                            description: 'Output completo concatenado',
                          },
                          metrics: {
                            type: 'object',
                            properties: {
                              total_latency_ms: { type: 'number' },
                              total_cost_usd: { type: 'number' },
                              steps_executed: { type: 'number' },
                            },
                          },
                        },
                      },
                      rate_limit: {
                        type: 'object',
                        properties: {
                          remaining: {
                            type: 'object',
                            properties: {
                              minute: { type: 'number' },
                              hour: { type: 'number' },
                              day: { type: 'number' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Requisição inválida',
            },
            '401': {
              description: 'Não autorizado - API key inválida ou ausente',
            },
            '403': {
              description: 'Proibido - API key não autorizada para este pipeline',
            },
            '429': {
              description: 'Rate limit excedido',
              headers: {
                'X-RateLimit-Limit-Minute': {
                  schema: { type: 'string' },
                },
                'X-RateLimit-Remaining-Minute': {
                  schema: { type: 'string' },
                },
                'X-RateLimit-Reset-Minute': {
                  schema: { type: 'string' },
                },
              },
            },
            '500': {
              description: 'Erro interno do servidor',
            },
          },
        },
      },
    },
  }

  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

