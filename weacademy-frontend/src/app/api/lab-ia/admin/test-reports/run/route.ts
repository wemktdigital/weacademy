import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'
import * as fs from 'fs'
import * as path from 'path'

interface TestResult {
  provider: string
  model: string
  displayName: string
  status: 'success' | 'error' | 'skipped'
  latency?: number
  error?: string
  responsePreview?: string
  timestamp: string
}

/**
 * POST /api/lab-ia/admin/test-reports/run
 * Executa testes em todos os modelos LLM e gera relatório
 */
export async function POST(request: NextRequest) {
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
        { error: 'Não autenticado' },
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
        { error: 'Acesso negado. Apenas administradores podem executar testes.' },
        { status: 403 }
      )
    }

    // Obter token para usar nas chamadas de API
    // O token já vem no header Authorization, usar ele diretamente
    if (!token) {
      return NextResponse.json(
        { error: 'Token de autenticação não fornecido' },
        { status: 401 }
      )
    }
    
    const authToken = token

    // Filtrar modelos de texto (pular vídeo por padrão)
    const textModels = AVAILABLE_MODELS.filter(
      m => m.capabilities?.output?.includes('text')
    )

    // Criar stream para enviar progresso em tempo real
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const results: TestResult[] = []
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        try {
          // Enviar evento inicial
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'start',
              total: textModels.length,
              message: 'Iniciando testes...',
            })}\n\n`)
          )

          // Testar cada modelo
          for (let i = 0; i < textModels.length; i++) {
            const modelConfig = textModels[i]
            
            // Enviar evento de progresso
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                current: i + 1,
                total: textModels.length,
                model: modelConfig.displayName,
                provider: modelConfig.provider,
                message: `Testando ${modelConfig.displayName}...`,
              })}\n\n`)
            )
            
            try {
              const startTime = Date.now()
              
              const response = await fetch(`${baseUrl}/api/lab-ia/chat`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                  messages: [
                    {
                      role: 'user',
                      content: 'Responda apenas com "OK" se você está funcionando corretamente.',
                    },
                  ],
                  provider: modelConfig.provider,
                  model: modelConfig.model,
                  stream: false,
                }),
              })

              const latency = Date.now() - startTime

              if (!response.ok) {
                const contentType = response.headers.get('content-type') || ''
                let errorData: any = { error: `HTTP ${response.status} ${response.statusText}` }
                
                if (contentType.includes('application/json')) {
                  try {
                    errorData = await response.json()
                  } catch {
                    const text = await response.text()
                    errorData = { error: text || `HTTP ${response.status}` }
                  }
                } else {
                  const text = await response.text()
                  errorData = { error: text || `HTTP ${response.status}` }
                }
                
                const result: TestResult = {
                  provider: modelConfig.provider,
                  model: modelConfig.model,
                  displayName: modelConfig.displayName,
                  status: 'error',
                  error: errorData.error || `HTTP ${response.status}`,
                  latency,
                  timestamp: new Date().toISOString(),
                }
                
                results.push(result)
                
                // Enviar evento de resultado
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'result',
                    result,
                    current: i + 1,
                    total: textModels.length,
                  })}\n\n`)
                )
              } else {
                const contentType = response.headers.get('content-type') || ''
                let data: any = {}
                
                // Tentar parsear como JSON primeiro
                if (contentType.includes('application/json')) {
                  try {
                    data = await response.json()
                  } catch (parseError) {
                    // Se falhar, tentar como texto
                    const text = await response.text()
                    data = { content: text }
                  }
                } else {
                  // Se não for JSON, ler como texto
                  const text = await response.text()
                  data = { content: text }
                }
                
                const result: TestResult = {
                  provider: modelConfig.provider,
                  model: modelConfig.model,
                  displayName: modelConfig.displayName,
                  status: 'success',
                  latency,
                  responsePreview: data.content?.substring(0, 100) || 'Sem conteúdo',
                  timestamp: new Date().toISOString(),
                }
                
                results.push(result)
                
                // Enviar evento de resultado
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'result',
                    result,
                    current: i + 1,
                    total: textModels.length,
                  })}\n\n`)
                )
              }
            } catch (error: any) {
              const result: TestResult = {
                provider: modelConfig.provider,
                model: modelConfig.model,
                displayName: modelConfig.displayName,
                status: 'error',
                error: error.message || 'Erro desconhecido',
                timestamp: new Date().toISOString(),
              }
              
              results.push(result)
              
              // Enviar evento de resultado
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'result',
                  result,
                  current: i + 1,
                  total: textModels.length,
                })}\n\n`)
              )
            }

            // Aguardar entre testes para não sobrecarregar APIs
            if (i < textModels.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }

          // Calcular estatísticas
          const successful = results.filter(r => r.status === 'success')
          const failed = results.filter(r => r.status === 'error')
          
          const summary = {
            total: results.length,
            success: successful.length,
            failed: failed.length,
            successRate: Math.round(successful.length / results.length * 100),
          }

          // Salvar relatório em arquivo
          const reportsDir = path.join(process.cwd(), 'test-reports')
          if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true })
          }
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const reportPath = path.join(reportsDir, `llm-models-test-${timestamp}.json`)
          
          const report = {
            timestamp: new Date().toISOString(),
            summary,
            results,
          }
          
          fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

          // Salvar também um relatório legível em texto
          const textReportPath = path.join(reportsDir, `llm-models-test-${timestamp}.txt`)
          let textReport = 'RELATÓRIO DE TESTE - MODELOS LLM\n'
          textReport += '='.repeat(70) + '\n\n'
          textReport += `Data: ${new Date().toLocaleString('pt-BR')}\n`
          textReport += `Total: ${results.length} modelos\n`
          textReport += `Sucesso: ${successful.length} (${Math.round(successful.length / results.length * 100)}%)\n`
          textReport += `Falhas: ${failed.length} (${Math.round(failed.length / results.length * 100)}%)\n\n`
          
          textReport += 'RESULTADOS DETALHADOS:\n'
          textReport += '-'.repeat(70) + '\n'
          results.forEach(r => {
            textReport += `\n${r.displayName} (${r.provider}/${r.model})\n`
            textReport += `  Status: ${r.status === 'success' ? '✅ Sucesso' : '❌ Erro'}\n`
            if (r.latency) textReport += `  Latência: ${r.latency}ms\n`
            if (r.error) textReport += `  Erro: ${r.error}\n`
            if (r.responsePreview) textReport += `  Preview: ${r.responsePreview}\n`
          })
          
          fs.writeFileSync(textReportPath, textReport)

          // Enviar evento de conclusão
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'done',
              summary,
              reportPath: `llm-models-test-${timestamp}.json`,
              message: `Testes concluídos: ${successful.length}/${results.length} modelos testados com sucesso`,
            })}\n\n`)
          )
        } catch (error: any) {
          // Enviar evento de erro
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error.message || 'Erro desconhecido',
            })}\n\n`)
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('[Admin][Test Reports][Run] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao executar testes' },
      { status: 500 }
    )
  }
}

