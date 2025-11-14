import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/modules/laboratorio-ia/services/llmRouter'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { processKnowledgeFiles, enhancePromptWithKnowledge } from '@/modules/laboratorio-ia/services/knowledgeBase'

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
      const { data: { user: sessionUser } } = await supabase.auth.getSession()
      if (sessionUser?.session) {
        user = sessionUser.user
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
      preferences,
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

    // Validar mensagens
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('[LAB-IA][API] Mensagens inválidas')
      return NextResponse.json(
        { error: 'Mensagens inválidas' },
        { status: 400 }
      )
    }

    // Se há agentId, buscar agente do banco e injetar system prompt com base de conhecimento
    let formattedMessages = [...messages]
    let finalProvider = provider
    let finalModel = model
    
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

        // Inserir system prompt no início
        formattedMessages.unshift({
          role: 'system',
          content: enhancedPrompt,
        })
      } else {
        console.warn('[LAB-IA][API] Agente não encontrado ou inativo:', agentId)
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
      stream: true,
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
    })

    const latency = Date.now() - startTime
    
    console.log('[LAB-IA][API] LLM Router retornou, latency:', latency, 'ms')
    
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
          // Enviar metadados primeiro (se modelo foi alterado)
          if (modelWasAutoSelected) {
            const metadata = {
              type: 'metadata',
              data: {
                provider: response.provider,
                model: response.model,
                originalProvider: provider,
                originalModel: model,
                autoSelected: true,
                taskCategory: response.taskCategory || null,
              },
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`))
          }
          
          // Depois enviar o stream original convertendo para SSE
          const reader = originalStream.getReader()
          const decoder = new TextDecoder()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              
              // Converter chunks de texto para formato SSE
              const text = decoder.decode(value, { stream: true })
              if (text) {
                // Enviar como SSE data
                controller.enqueue(encoder.encode(text))
              }
            }
          } finally {
            reader.releaseLock()
            controller.close()
          }
        },
      })
      
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
      // Retornar resposta completa
      return NextResponse.json({
        content: response.content,
        provider: response.provider,
        model: response.model,
        latency: response.latency,
        cost: response.cost,
          taskCategory: response.taskCategory || null,
        metadata: modelWasAutoSelected ? {
          autoSelected: true,
          originalProvider: provider,
          originalModel: model,
            taskCategory: response.taskCategory || null,
        } : undefined,
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
