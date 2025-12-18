import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/modules/laboratorio-ia/services/llmRouter'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { processKnowledgeFiles, enhancePromptWithKnowledge } from '@/modules/laboratorio-ia/services/knowledgeBase'
import { recallGlobal, recallProfile, getRecentSummaries, formatMemoriesForContext, remember } from '@/modules/laboratorio-ia/services/memory'
import { extractMemoriesFromConversation, shouldExtractMemories } from '@/modules/laboratorio-ia/services/memoryExtractor'
import { trackAILabUsage } from '@/lib/analytics'
import { checkUsageLimit, incrementUsage } from '@/lib/subscription-limits'

/**
 * Extrai e salva memórias de forma assíncrona
 * Retorna lista de novas memórias criadas
 */
async function extractMemoriesAndSave(
  userId: string,
  messages: any[],
  agentId: string | null
): Promise<string[]> {
  try {
    // Buscar memórias existentes
    const existingMemories = agentId
      ? (await recallProfile({ userId, agentId })).agent
      : await recallGlobal(userId)

    // Extrair novas memórias
    const newMemories = await extractMemoriesFromConversation({
      userId,
      messages,
      existingMemories,
    })

    if (newMemories.length > 0) {
      console.log('[LAB-IA][API] Extraídas', newMemories.length, 'novas memórias')

      // Salvar cada nova memória
      for (const memory of newMemories) {
        await remember({
          userId,
          agentId,
          key: memory.key,
          value: memory.value,
          importance: memory.importance,
        })
      }

      console.log('[LAB-IA][API] Memórias salvas com sucesso')

      // Retornar chaves das novas memórias para notificação
      return newMemories.map(m => m.key)
    }

    return []
  } catch (error) {
    console.error('[LAB-IA][API] Erro ao extrair e salvar memórias:', error)
    // Não propagar erro para não bloquear resposta
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[LAB-IA][API] Iniciando requisição de chat')

    // Verificar autenticação via header Authorization (padrão usado no frontend)
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user = null
    let error = null

    if (token) {
      console.log('[LAB-IA][API] Tentando autenticar com token do header')
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      } else {
        error = tokenError
      }
    }

    // Fallback para verificação de sessão
    if (!user) {
      console.log('[LAB-IA][API] Tentando autenticar via sessão')
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        user = session.user
      }
    }

    console.log('[LAB-IA][API] User:', user?.id)

    if (!user) {
      console.log('[LAB-IA][API] Usuário não autenticado')
      return NextResponse.json(
        { error: 'Não autenticado', details: error?.message },
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




    const {
      messages,
      provider = 'OpenAI',
      model = 'gpt-5-nano',
      agentId,
      enableIntelligentRouting = false,
      enableFallback = false,
      enableCache = true,
      stream = true,
      preferences,
      conversationId,
      messageId,
    } = await request.json()

    console.log('[LAB-IA][API] Parâmetros:', {
      provider,
      model,
      agentId,
      messagesCount: messages?.length,
      enableIntelligentRouting,
      enableFallback,
      enableCache,
    })

    // [NOVO] INÍCIO DO CONTROLE DE ACESSO
    const usageCheck = await checkUsageLimit(user.id, model)
    if (!usageCheck.allowed) {
      console.warn(`[LAB-IA][API] Bloqueado por limite: ${usageCheck.reason} (${usageCheck.planName})`)
      return NextResponse.json(
        {
          error: 'Limite de uso atingido',
          details: usageCheck.reason === 'limit_exceeded'
            ? `Você atingiu o limite do plano ${usageCheck.planName}.`
            : 'Seu plano não permite usar este modelo.',
          upgrade_url: '/pricing'
        },
        { status: 403 }
      )
    }
    // FIM DO CONTROLE DE ACESSO

    // Validar mensagens
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('[LAB-IA][API] Mensagens inválidas')
      return NextResponse.json(
        { error: 'Mensagens inválidas' },
        { status: 400 }
      )
    }

    // Verificar configurações de memória do usuário
    const { data: userSettings } = await supabase
      .from('lab_user_settings')
      .select('memory_enabled, memory_auto_extract, memory_reference_history')
      .eq('user_id', user.id)
      .single()

    const memoryEnabled = userSettings?.memory_enabled ?? true
    const memoryAutoExtract = userSettings?.memory_auto_extract ?? true
    const memoryReferenceHistory = userSettings?.memory_reference_history ?? false

    // Se há agentId, buscar agente do banco e injetar system prompt com base de conhecimento
    let formattedMessages = [...messages]
    let finalProvider = provider
    let finalModel = model

    // Carregar memórias se estiver habilitado
    let memoryContext = ''
    const usedMemoryKeys: string[] = [] // Inicializar array para chaves de memórias usadas

    if (memoryEnabled) {
      try {
        console.log('[LAB-IA][API] Carregando memórias do usuário...')

        // Buscar memórias globais
        const globalMemories = await recallGlobal(user.id)

        // Se há agentId, buscar memórias do agente também
        let agentMemories: any[] = []
        if (agentId) {
          const profile = await recallProfile({ userId: user.id, agentId })
          agentMemories = profile.agent
        }

        // Combinar memórias (globais + agente)
        const allMemories = [...globalMemories, ...agentMemories]

        if (allMemories.length > 0) {
          // Formatar memórias respeitando limite de tokens
          // formatMemoriesForContext pode preencher usedMemoryKeys com as chaves usadas
          memoryContext = formatMemoriesForContext(allMemories, 1000)
          // Extrair chaves das memórias usadas
          allMemories.forEach(m => usedMemoryKeys.push(m.key))
          console.log('[LAB-IA][API] Memórias carregadas:', allMemories.length)
        }

        // Se memory_reference_history estiver habilitado, buscar resumos recentes
        if (memoryReferenceHistory) {
          const recentSummaries = await getRecentSummaries({
            userId: user.id,
            agentId,
            limit: 2,
          })

          if (recentSummaries.length > 0) {
            const summariesText = recentSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')
            if (memoryContext) {
              memoryContext += `\n\n[Resumos de Conversas Anteriores]\n${summariesText}\nUse esses resumos como contexto adicional.`
            } else {
              memoryContext = `[Resumos de Conversas Anteriores]\n${summariesText}\nUse esses resumos como contexto adicional.`
            }
            console.log('[LAB-IA][API] Resumos recentes carregados:', recentSummaries.length)
          }
        }
      } catch (error: any) {
        console.error('[LAB-IA][API] Erro ao carregar memórias:', error)
        // Continuar sem memórias se houver erro
      }
    }

    if (agentId) {
      // Buscar agente do banco de dados
      const serviceRoleSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: agent, error: agentError } = await serviceRoleSupabase
        .from('lab_agents')
        .select('id, name, prompt, knowledge_base_files, provider, model')
        .eq('id', agentId)
        .eq('active', true)
        .single()

      if (agent && !agentError) {
        console.log('[LAB-IA][API] Agente encontrado:', agent.name)
        console.log('[LAB-IA][API] Arquivos de conhecimento:', agent.knowledge_base_files?.length || 0)
        console.log('[LAB-IA][API] Modelo do agente:', agent.provider, agent.model)

        // Se o agente tem modelo definido, usar o modelo do agente em vez do modelo escolhido pelo usuário
        if (agent.provider && agent.model) {
          finalProvider = agent.provider
          finalModel = agent.model
          console.log('[LAB-IA][API] Usando modelo do agente:', finalProvider, finalModel)
        } else {
          console.log('[LAB-IA][API] Agente não tem modelo definido, usando modelo do usuário:', finalProvider, finalModel)
        }

        let enhancedPrompt = agent.prompt || ''

        // Processar arquivos de conhecimento se existirem
        if (agent.knowledge_base_files && Array.isArray(agent.knowledge_base_files) && agent.knowledge_base_files.length > 0) {
          console.log('[LAB-IA][API] Processando arquivos de conhecimento...')
          try {
            const knowledgeContent = await processKnowledgeFiles(agent.knowledge_base_files)
            if (knowledgeContent && knowledgeContent.trim().length > 0) {
              enhancedPrompt = enhancePromptWithKnowledge(agent.prompt, knowledgeContent)
              console.log('[LAB-IA][API] Conteúdo de conhecimento incorporado:', knowledgeContent.length, 'caracteres')
            }
          } catch (error: any) {
            console.error('[LAB-IA][API] Erro ao processar base de conhecimento:', error)
            // Continuar com prompt original se houver erro
          }
        }

        // Combinar system prompt do agente com memórias se houver
        if (memoryContext) {
          enhancedPrompt = `${enhancedPrompt}\n\n${memoryContext}`
        }

        // Inserir system prompt no início
        formattedMessages.unshift({
          role: 'system',
          content: enhancedPrompt,
        })
      } else {
        console.warn('[LAB-IA][API] Agente não encontrado ou inativo:', agentId)

        // Se não há agente, adicionar memórias como system prompt separado
        if (memoryContext) {
          formattedMessages.unshift({
            role: 'system',
            content: memoryContext,
          })
        }
      }
    } else {
      // Se não há agentId, adicionar memórias como system prompt
      if (memoryContext) {
        formattedMessages.unshift({
          role: 'system',
          content: memoryContext,
        })
      }
    }

    const startTime = Date.now()

    console.log('[LAB-IA][API] Chamando LLM Router...')

    // Chamar LLM Router com o modelo correto (agente ou usuário)
    console.log('[LAB-IA][API] Usando modelo final:', finalProvider, finalModel)
    const response = await callLLM({
      provider: finalProvider,
      model: finalModel,
      messages: formattedMessages,
      stream: stream !== false, // Usar stream por padrão, mas respeitar se for false
      enableIntelligentRouting: enableIntelligentRouting && !agentId, // Não usar routing se agente específico
      enableFallback,
      enableCache,
      preferences: preferences ? {
        maxCostUsd: preferences.maxCostUsd,
        preferSpeed: preferences.preferSpeed,
        preferAccuracy: preferences.preferAccuracy,
      } : undefined,
      userId: user.id, // Passar userId para otimização (Fase 2)
      enableOptimization: true, // Ativar otimização baseada em histórico
      conversationId, // ID da conversa (para operações assíncronas)
      messageId, // ID da mensagem (para operações assíncronas)
    })

    const latency = Date.now() - startTime

    console.log('[LAB-IA][API] LLM Router retornou, latency:', latency, 'ms')

    // Rastrear uso do AI Lab
    try {
      await trackAILabUsage('chat_message', agentId || undefined, {
        provider: response.provider,
        model: response.model,
        latency_ms: latency,
        has_memories: usedMemoryKeys.length > 0,
        memory_count: usedMemoryKeys.length
      })

      // 2. Billing (Incrementar uso no plano)
      // Usamos o modelo retornado (response.model) ou o solicitado (model)
      await incrementUsage(user.id, response.model || model)

    } catch (error) {
      // Ignorar erros de tracking para não bloquear a resposta
      console.warn('[LAB-IA][API] Erro ao rastrear uso:', error)
    }

    // Verificar se o modelo foi alterado pelo routing inteligente
    const modelWasAutoSelected = enableIntelligentRouting &&
      !agentId &&
      (response.provider !== provider || response.model !== model)

    // Log de agente se aplicável
    if (agentId && user) {
      try {
        await supabase.from('lab_agent_logs').insert({
          user_id: user.id,
          agent_id: agentId,
          provider: response.provider,
          model: response.model,
          latency_ms: response.latency,
          cost_usd: response.cost,
          input_tokens: response.inputTokens || null,
          output_tokens: response.outputTokens || null,
        })
      } catch (err) {
        console.error('Erro ao logar agente:', err)
      }
    }

    if (response.stream) {
      console.log('[LAB-IA][API] Retornando stream de resposta')

      // Criar stream wrapper que adiciona metadados no início e converte para SSE
      const encoder = new TextEncoder()
      const originalStream = response.stream

      // Criar novo stream que adiciona metadados primeiro e converte texto para SSE
      const wrappedStream = new ReadableStream({
        async start(controller) {
          try {
            // Enviar metadados primeiro (se modelo foi alterado ou memórias foram usadas)
            if (modelWasAutoSelected || usedMemoryKeys.length > 0) {
              const metadata = {
                type: 'metadata',
                data: {
                  provider: response.provider,
                  model: response.model,
                  originalProvider: provider,
                  originalModel: model,
                  autoSelected: modelWasAutoSelected,
                  taskCategory: response.taskCategory || null,
                  memoriesUsed: usedMemoryKeys.length > 0 ? usedMemoryKeys : undefined,
                },
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`))
            }

            // Extrair memórias de forma assíncrona e enviar notificação via SSE quando prontas
            if (memoryEnabled && memoryAutoExtract && shouldExtractMemories(messages.length)) {
              // Executar extração em background
              extractMemoriesAndSave(user.id, messages, agentId || null)
                .then((newKeys) => {
                  if (newKeys.length > 0) {
                    // Enviar notificação de novas memórias via SSE
                    const memoryNotification = {
                      type: 'memory_created',
                      data: {
                        keys: newKeys,
                        count: newKeys.length,
                        message: `Nova${newKeys.length > 1 ? 's' : ''} memória${newKeys.length > 1 ? 's' : ''} salva${newKeys.length > 1 ? 's' : ''}: ${newKeys.join(', ')}`,
                      },
                    }
                    try {
                      // Tentar enviar notificação (pode falhar se stream já foi fechado)
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(memoryNotification)}\n\n`))
                    } catch (e) {
                      // Stream pode ter sido fechado, não é crítico
                      console.log('[LAB-IA][API] Stream já fechado ao tentar enviar notificação de memória')
                    }
                  }
                })
                .catch((err) => {
                  console.error('[LAB-IA][API] Erro ao extrair memórias:', err)
                })
            }

            // Depois enviar o stream original convertendo para SSE
            const reader = originalStream.getReader()
            const decoder = new TextDecoder()
            let buffer = '' // Buffer para acumular conteúdo que pode conter URL base64 ou HTTP
            let isInBase64Url = false // Flag para indicar que estamos no meio de uma URL base64
            let isInHttpUrl = false // Flag para indicar que estamos no meio de uma URL HTTP (Replicate)
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) {
                  // Processar buffer final
                  if (buffer.trim()) {
                    if (isInBase64Url || isInHttpUrl || buffer.includes('base64,') || buffer.includes('data:image') ||
                      (buffer.includes('![Imagem') && (buffer.includes('https://') || buffer.includes('http://'))) ||
                      (buffer.includes('![Vídeo') && (buffer.includes('https://') || buffer.includes('http://')))) {
                      // Enviar buffer completo como um único evento SSE
                      controller.enqueue(encoder.encode(`data: ${buffer}\n\n`))
                    } else {
                      // Enviar linhas normalmente
                      const lines = buffer.split('\n')
                      for (const line of lines) {
                        if (line.trim()) {
                          controller.enqueue(encoder.encode(`data: ${line}\n\n`))
                        }
                      }
                    }
                  }
                  break
                }

                // Converter chunks de texto para formato SSE
                const text = decoder.decode(value, { stream: true })
                if (text) {
                  // Acumular no buffer
                  buffer += text

                  // Verificar se estamos no meio ou início de uma URL base64 (imagem ou vídeo)
                  const hasImageStartBase64 = buffer.includes('![Imagem gerada](data:') || buffer.includes('![Imagemgerada](data:')
                  const hasVideoStartBase64 = buffer.includes('![Vídeo gerado](data:') || buffer.includes('![Vídeogerado](data:')
                  const hasBase64Start = buffer.includes('base64,')
                  const hasImageEndBase64 = buffer.match(/!\[Imagem\s?gerada\]\(data:[^)]+\)/) ||
                    buffer.match(/!\[Imagemgerada\]\(data:[^)]+\)/)
                  const hasVideoEndBase64 = buffer.match(/!\[Vídeo\s?gerado\]\(data:video\/[^)]+\)/) ||
                    buffer.match(/!\[Vídeogerado\]\(data:video\/[^)]+\)/)

                  // Verificar se estamos no meio ou início de uma URL HTTP (Replicate) - imagens ou vídeos
                  const hasImageStartHttp = buffer.includes('![Imagem gerada](https://') ||
                    buffer.includes('![Imagemgerada](https://') ||
                    buffer.includes('![Imagem gerada](http://') ||
                    buffer.includes('![Imagemgerada](http://') ||
                    (buffer.includes('![Imagem') && (buffer.includes('https://') || buffer.includes('http://')))
                  const hasImageEndHttp = buffer.match(/!\[Imagem\s?gerada\]\(https?:\/\/[^)]+\)/) ||
                    buffer.match(/!\[Imagem\s?\d+\]\(https?:\/\/[^)]+\)/)

                  // Verificar se estamos no meio ou início de uma URL HTTP de vídeo (Replicate)
                  const hasVideoStartHttp = buffer.includes('![Vídeo gerado](https://') ||
                    buffer.includes('![Vídeogerado](https://') ||
                    buffer.includes('![Vídeo gerado](http://') ||
                    buffer.includes('![Vídeogerado](http://') ||
                    (buffer.includes('![Vídeo') && (buffer.includes('https://') || buffer.includes('http://')))
                  const hasVideoEndHttp = buffer.match(/!\[Vídeo\s?gerado\]\(https?:\/\/[^)]+\)/) ||
                    buffer.match(/!\[Vídeo\s?\d+\]\(https?:\/\/[^)]+\)/)

                  // Se encontramos início de URL base64 (imagem ou vídeo) mas não o fechamento, estamos acumulando
                  if ((hasImageStartBase64 || hasVideoStartBase64) && hasBase64Start && !hasImageEndBase64 && !hasVideoEndBase64) {
                    isInBase64Url = true
                    isInHttpUrl = false
                    // Continuar acumulando até encontrar o fechamento
                    continue
                  } else if (hasImageEndBase64 || hasVideoEndBase64) {
                    // Encontramos o fechamento base64 (imagem ou vídeo), enviar tudo como um único evento SSE
                    isInBase64Url = false
                    isInHttpUrl = false
                    controller.enqueue(encoder.encode(`data: ${buffer}\n\n`))
                    buffer = ''
                  } else if (isInBase64Url) {
                    // Ainda acumulando base64, continuar
                    continue
                  } else if ((hasImageStartHttp && !hasImageEndHttp) || (hasVideoStartHttp && !hasVideoEndHttp)) {
                    // Encontramos início de URL HTTP (imagem ou vídeo) mas não o fechamento, estamos acumulando
                    isInHttpUrl = true
                    isInBase64Url = false
                    // Continuar acumulando até encontrar o fechamento
                    continue
                  } else if (hasImageEndHttp || hasVideoEndHttp) {
                    // Encontramos o fechamento HTTP (imagem ou vídeo), enviar tudo como um único evento SSE
                    isInHttpUrl = false
                    isInBase64Url = false
                    controller.enqueue(encoder.encode(`data: ${buffer}\n\n`))
                    buffer = ''
                  } else if (isInHttpUrl) {
                    // Ainda acumulando HTTP, continuar
                    continue
                  } else {
                    // Não é base64 nem HTTP, processar normalmente
                    // Se já está no formato SSE, enviar direto
                    if (buffer.includes('data: ')) {
                      controller.enqueue(encoder.encode(buffer))
                      buffer = ''
                    } else {
                      // Verificar se o buffer contém uma linha completa (terminada com \n)
                      const lastNewlineIndex = buffer.lastIndexOf('\n')
                      if (lastNewlineIndex !== -1) {
                        // Enviar linhas completas
                        const completeLines = buffer.substring(0, lastNewlineIndex + 1)
                        const lines = completeLines.split('\n')
                        for (const line of lines) {
                          if (line.trim() && !line.includes('base64,') && !line.includes('data:image') &&
                            !(line.includes('![Imagem') && (line.includes('https://') || line.includes('http://'))) &&
                            !(line.includes('![Vídeo') && (line.includes('https://') || line.includes('http://')))) {
                            controller.enqueue(encoder.encode(`data: ${line}\n\n`))
                          }
                        }
                        // Manter resto no buffer
                        buffer = buffer.substring(lastNewlineIndex + 1)
                      }
                    }
                  }
                }
              }
            } catch (innerError: any) {
              console.error('[LAB-IA][API] Erro ao ler stream:', innerError)
              // Tentar enviar erro através do stream
              try {
                const errorMessage = `❌ Erro ao processar stream: ${innerError.message || innerError}`
                controller.enqueue(encoder.encode(`data: ${errorMessage}\n\n`))
              } catch (e) {
                // Se não conseguir enviar, apenas logar
                console.error('[LAB-IA][API] Erro ao enviar mensagem de erro:', e)
              }
            } finally {
              reader.releaseLock()
              controller.close()
            }
          } catch (outerError: any) {
            console.error('[LAB-IA][API] Erro no stream wrapper:', outerError)
            // Tentar enviar erro através do stream
            try {
              const errorMessage = `❌ Erro ao processar resposta: ${outerError.message || outerError}`
              controller.enqueue(encoder.encode(`data: ${errorMessage}\n\n`))
            } catch (e) {
              // Se não conseguir enviar, apenas logar
              console.error('[LAB-IA][API] Erro ao enviar mensagem de erro:', e)
            } finally {
              controller.close()
            }
          }
        },
      })

      // Extrair memórias de forma assíncrona (não bloquear resposta)
      if (memoryEnabled && memoryAutoExtract && shouldExtractMemories(messages.length)) {
        // Executar extração em background
        extractMemoriesAndSave(user.id, messages, agentId || null).catch((err) => {
          console.error('[LAB-IA][API] Erro ao extrair memórias:', err)
        })
      }

      // Adicionar XP para uso do Lab IA (1 XP por mensagem do usuário, máximo 5 por dia)
      const serviceRoleSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      try {
        // Contar mensagens do usuário na requisição atual
        const userMessagesCount = messages.filter(m => m.role === 'user').length

        if (userMessagesCount > 0) {
          // Verificar se já recebeu XP do Lab IA hoje
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const todayISO = today.toISOString()

          const { data: todayPoints } = await serviceRoleSupabase
            .from('user_points')
            .select('points')
            .eq('user_id', user.id)
            .eq('source_type', 'lab_ia_usage')
            .gte('created_at', todayISO)

          const todayTotalXP = todayPoints?.reduce((sum, p) => sum + p.points, 0) || 0
          const maxDailyXP = 5 // Máximo 5 XP por dia do Lab IA

          if (todayTotalXP < maxDailyXP) {
            // Adicionar XP (1 por mensagem, até o máximo diário)
            const xpToAdd = Math.min(userMessagesCount, maxDailyXP - todayTotalXP)

            if (xpToAdd > 0) {
              await serviceRoleSupabase.rpc('add_user_points', {
                p_user_id: user.id,
                p_points: xpToAdd,
                p_source_type: 'lab_ia_usage',
                p_source_id: conversationId || null,
                p_metadata: {
                  agent_id: agentId || null,
                  messages_count: userMessagesCount,
                },
              })

              // Atualizar streak
              await serviceRoleSupabase.rpc('update_user_streak', {
                p_user_id: user.id,
              })

              // Verificar achievements (apenas se ainda não verificou hoje)
              const { data: lastCheck } = await serviceRoleSupabase
                .from('user_achievements')
                .select('unlocked_at')
                .eq('user_id', user.id)
                .gte('unlocked_at', todayISO)
                .limit(1)

              if (!lastCheck || lastCheck.length === 0) {
                await serviceRoleSupabase.rpc('check_and_unlock_achievements', {
                  p_user_id: user.id,
                })
              }
            }
          }
        }
      } catch (error) {
        // Ignorar erros de gamificação para não bloquear o Lab IA
        console.error('[LAB-IA][API] Erro ao adicionar XP:', error)
      }

      // Retornar stream
      return new Response(wrappedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    } else {
      console.log('[LAB-IA][API] Retornando resposta completa (não-stream)')

      // Extrair memórias de forma assíncrona (não bloquear resposta)
      let newMemoryKeys: string[] = []
      if (memoryEnabled && memoryAutoExtract && shouldExtractMemories(messages.length)) {
        // Executar extração em background e aguardar para incluir na resposta
        const keys = await extractMemoriesAndSave(user.id, messages, agentId || null).catch((err) => {
          console.error('[LAB-IA][API] Erro ao extrair memórias:', err)
          return []
        })
        newMemoryKeys = keys
      }

      // Retornar resposta completa
      return NextResponse.json({
        content: response.content,
        provider: response.provider,
        model: response.model,
        latency: response.latency,
        cost: response.cost,
        taskCategory: response.taskCategory || null,
        metadata: {
          ...(modelWasAutoSelected ? {
            autoSelected: true,
            originalProvider: provider,
            originalModel: model,
            taskCategory: response.taskCategory || null,
          } : {}),
          ...(usedMemoryKeys.length > 0 ? { memoriesUsed: usedMemoryKeys } : {}),
        },
        ...(newMemoryKeys.length > 0 ? {
          newMemories: {
            keys: newMemoryKeys,
            count: newMemoryKeys.length,
          },
        } : {}),
      })
    }
  } catch (error: any) {
    console.error('[LAB-IA][API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar chat' },
      { status: 500 }
    )
  }
}
