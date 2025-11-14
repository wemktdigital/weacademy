import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import Replicate from 'replicate'
import { generateVideo } from '@/modules/laboratorio-ia/services/imageProcessing'
import { getCachedResponse, cacheResponse } from './responseCache'
import { intelligentRoute, RoutingResult, TaskCategory } from './intelligentRouter'
import { recordModelPerformance } from './routingOptimizer'
import { MODEL_PRICING, ModelPricing } from '@/modules/laboratorio-ia/config/pricing'

interface LLMCallOptions {
  provider: string
  model: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
  enableIntelligentRouting?: boolean  // Ativar routing inteligente automático
  enableFallback?: boolean  // Ativar fallback automático se falhar
  enableCache?: boolean  // Ativar cache de respostas
  fallbackChain?: Array<{ provider: string; model: string }>  // Cadeia de fallback customizada
  preferences?: {
    maxCostUsd?: number | null
    preferSpeed?: boolean
    preferAccuracy?: boolean
  }  // Preferências do usuário para routing
  userId?: string  // ID do usuário para otimização e tracking
  enableOptimization?: boolean  // Ativar otimização baseada em histórico (Fase 2)
}

interface LLMResponse {
  provider: string
  model: string
  content: string
  latency: number
  cost: number
  inputTokens?: number
  outputTokens?: number
  stream?: ReadableStream
  taskCategory?: TaskCategory
}

// Preços por 1M tokens (input/output separados)
const DEFAULT_PRICING: ModelPricing = { input: 0, output: 0 }

function estimateTokens(text: string): number {
  // Estimativa simples: ~4 caracteres por token
  return Math.ceil(text.length / 4)
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export async function callLLM({
  provider,
  model,
  messages,
  stream = true,
  enableIntelligentRouting = false,
  enableFallback = false,
  enableCache = true,
  fallbackChain = [],
  preferences,
  userId,
  enableOptimization = true,
}: LLMCallOptions): Promise<LLMResponse> {
  const startTime = Date.now()

  // Validar mensagens antes de processar - garantir que todas tenham content válido
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Nenhuma mensagem fornecida')
  }

  const validMessages = messages.filter(
    msg => msg && msg.content !== null && msg.content !== undefined && String(msg.content).trim().length > 0
  )

  if (validMessages.length === 0) {
    throw new Error('Nenhuma mensagem válida (todas estão vazias ou null)')
  }

  // Converter mensagens válidas para formato padrão (garantir que content seja string)
  const sanitizedMessages = validMessages.map(msg => ({
    role: msg.role || 'user',
    content: String(msg.content || ''),
  }))

  // Obter prompt principal (última mensagem do usuário)
  const lastUserMessage = sanitizedMessages.filter(m => m.role === 'user').pop()
  const prompt = lastUserMessage?.content || sanitizedMessages[sanitizedMessages.length - 1].content

  // Routing Inteligente: se ativado, determinar melhor modelo automaticamente
  let routingResult: RoutingResult | null = null
  let finalProvider = provider
  let finalModel = model
  let taskCategory: TaskCategory = 'chat' // Default

  if (enableIntelligentRouting) {
    // Detectar categoria da tarefa para otimização
    const { analyzePrompt } = await import('./intelligentRouter')
    const characteristics = analyzePrompt(prompt, sanitizedMessages)
    taskCategory = characteristics.category

    routingResult = await intelligentRoute(
      prompt,
      sanitizedMessages,
      preferences ? {
        maxCost: preferences.maxCostUsd || undefined,
        requiresSpeed: preferences.preferSpeed,
        requiresAccuracy: preferences.preferAccuracy,
      } : undefined,
      userId,
      enableOptimization
    )
    finalProvider = routingResult.recommended.provider
    finalModel = routingResult.recommended.model
    
    // Se fallback está ativado, usar a cadeia de fallback do routing
    if (enableFallback && routingResult.fallbackChain.length > 0) {
      fallbackChain = routingResult.fallbackChain
    }
    
    console.log(`[callLLM] Routing inteligente: ${provider}:${model} → ${finalProvider}:${finalModel}`, {
      reason: routingResult.recommended.reason,
      score: routingResult.recommended.score,
      optimized: enableOptimization && userId ? 'sim' : 'não',
    })
  }

  // Verificar cache antes de fazer chamada
  if (enableCache && !stream) {
    const cached = getCachedResponse(prompt, finalProvider, finalModel)
    if (cached) {
      console.log(`[callLLM] Cache hit para ${finalProvider}:${finalModel}`)
      return {
        provider: cached.provider,
        model: cached.model,
        content: cached.response,
        latency: cached.latency,
        cost: cached.cost,
      }
    }
  }

  // Tentar chamar o modelo principal
  let lastError: Error | null = null
  const modelsToTry = fallbackChain.length > 0 
    ? [{ provider: finalProvider, model: finalModel }, ...fallbackChain]
    : [{ provider: finalProvider, model: finalModel }]

  for (let i = 0; i < modelsToTry.length; i++) {
    const modelToTry = modelsToTry[i]
    try {
      const result = await callModel(modelToTry.provider, modelToTry.model, sanitizedMessages, stream, startTime)
      
      // Armazenar no cache se não for streaming
      if (enableCache && !stream && result.content) {
        cacheResponse(prompt, result.provider, result.model, result.content, result.cost, result.latency)
      }

      // Se foi routing inteligente e mudou modelo, marcar no resultado
      if (enableIntelligentRouting && (finalProvider !== provider || finalModel !== model)) {
        console.log(`[callLLM] Modelo alterado automaticamente: ${provider}:${model} → ${result.provider}:${result.model}`)
      }

      // Registrar performance para otimização (Fase 2)
      if (userId && enableOptimization) {
        // Registrar de forma assíncrona (não bloquear resposta)
        recordModelPerformance({
          provider: result.provider,
          model: result.model,
          taskCategory,
          latency: result.latency,
          cost: result.cost,
          success: true,
          userId,
        }).catch(err => {
          console.error('[callLLM] Erro ao registrar performance (não crítico):', err)
        })
      }

      return enableIntelligentRouting ? { ...result, taskCategory } : result
    } catch (error: any) {
      lastError = error
      console.warn(`[callLLM] Falha ao chamar ${modelToTry.provider}:${modelToTry.model}:`, error.message)
      
      // Registrar falha para otimização (Fase 2)
      if (userId && enableOptimization) {
        recordModelPerformance({
          provider: modelToTry.provider,
          model: modelToTry.model,
          taskCategory,
          latency: Date.now() - startTime,
          cost: 0,
          success: false,
          userId,
        }).catch(err => {
          console.error('[callLLM] Erro ao registrar performance de falha (não crítico):', err)
        })
      }
      
      // Se não é o último modelo na cadeia e fallback está ativado, tentar próximo
      if (enableFallback && i < modelsToTry.length - 1) {
        console.log(`[callLLM] Tentando fallback para próximo modelo na cadeia...`)
        continue
      }
      
      // Se não tem fallback ou é o último modelo, lançar erro
      break
    }
  }

  // Se chegou aqui, todas as tentativas falharam
  throw new Error(
    `Falha ao chamar modelo${enableFallback ? 's (tentados todos os fallbacks)' : ''}: ${lastError?.message || 'Erro desconhecido'}`
  )
}

/**
 * Chama o modelo específico (método interno)
 */
async function callModel(
  provider: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  switch (provider.toLowerCase()) {
    case 'openai':
      return await callOpenAI(model, messages, stream, startTime)
    
    case 'google':
      return await callGemini(model, messages, stream, startTime)
    
    case 'deepseek':
      return await callDeepSeek(model, messages, stream, startTime)
    
    case 'grok':
      return await callGrok(model, messages, stream, startTime)
    
    case 'anthropic':
      return await callClaude(model, messages, stream, startTime)
    
    case 'replicate':
      return await callReplicate(model, messages, stream, startTime)
    
    case 'pubmed':
      return await callPubMed(model, messages, stream, startTime)
    
    default:
      throw new Error(`Provedor não suportado: ${provider}`)
  }
}

async function callOpenAI(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  // Verificar se é um modelo de geração de vídeo (Sora 2)
  if (model === 'sora-2' || model === 'sora-2-pro') {
    return await callSora2(model, messages, stream, startTime)
  }

  // Verificar se é um modelo de geração de imagem (GPT-Image-1)
  if (model === 'gpt-image-1' || model === 'gpt-image-1-mini') {
    return await callImageGeneration(model, messages, stream, startTime)
  }

  // Verificar se é um modelo de transcrição de áudio
  if (model === 'gpt-4o-mini-transcribe' || model === 'gpt-4o-transcribe' || model === 'gpt-4o-transcribe-diarize') {
    return await callTranscribe(model, messages, stream, startTime)
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurado')
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  // Converter e validar mensagens para formato OpenAI
  // Garantir que todas as mensagens tenham content válido (string não-null)
  const formattedMessages = messages
    .filter(msg => msg && msg.content !== null && msg.content !== undefined)
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: String(msg.content || ''), // Sempre converter para string válida
    }))
  
  if (formattedMessages.length === 0) {
    throw new Error('Nenhuma mensagem válida para enviar ao LLM')
  }

  // Alguns modelos (ex.: gpt-5-nano) não suportam temperature customizado.
  // Evitamos passar temperature para usar o default do modelo.
  const completion = await openai.chat.completions.create({
    model,
    messages: formattedMessages as any,
    stream,
  })

  const latency = Date.now() - startTime

  if (stream) {
    // Retornar stream
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion as any) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(encoder.encode(content))
            }
          }
        } catch (error) {
          console.error('Erro no stream OpenAI:', error)
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    return {
      provider: 'OpenAI',
      model,
      content: '',
      latency,
      cost: 0, // Será calculado depois com base no tamanho final
      stream: readable,
    }
  } else {
    // Resposta completa
    const content = (completion as any).choices[0]?.message?.content || ''
    const usage = (completion as any).usage || {}
    const inputTokens = usage.prompt_tokens || estimateTokens(messages.map(m => m.content).join(' '))
    const outputTokens = usage.completion_tokens || estimateTokens(content)
    
    const pricing = MODEL_PRICING[`openai:${model}`] || MODEL_PRICING['openai:gpt-4o-mini'] || DEFAULT_PRICING
    const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

    console.log(`[callOpenAI] Custo calculado:`, {
      model,
      inputTokens,
      outputTokens,
      pricing,
      cost,
    })

    return {
      provider: 'OpenAI',
      model,
      content,
      latency,
      cost,
      inputTokens,
      outputTokens,
    }
  }
}

async function callGemini(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurado')
  }

  console.log('[callGemini] Iniciando chamada:', { model, messagesCount: messages.length, stream })

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const geminiModel = genAI.getGenerativeModel({ model })

    // Filtrar mensagens do sistema
    const filteredMessages = messages.filter(msg => msg.role !== 'system')
    
    if (filteredMessages.length === 0) {
      throw new Error('Nenhuma mensagem válida após filtrar sistema')
    }

    // Verificar se a última mensagem é do usuário
    const lastMessage = filteredMessages[filteredMessages.length - 1]
    if (lastMessage.role !== 'user') {
      throw new Error('A última mensagem deve ser do usuário')
    }

    const currentMessage = lastMessage.content

    // Se há apenas uma mensagem ou histórico inválido, usar generateContent diretamente
    if (filteredMessages.length === 1) {
      console.log('[callGemini] Usando generateContent (sem histórico)')
      
      if (stream) {
        const result = await geminiModel.generateContentStream(currentMessage)
        const encoder = new TextEncoder()
        const readable = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of result.stream) {
                const text = chunk.text()
                if (text) {
                  controller.enqueue(encoder.encode(text))
                }
              }
            } catch (error: any) {
              console.error('[callGemini] Erro no stream:', error)
              controller.error(new Error(`Erro no stream Gemini: ${error.message || error}`))
            } finally {
              controller.close()
            }
          },
        })

        return {
          provider: 'Google',
          model,
          content: '',
          latency: 0,
          cost: 0,
          stream: readable,
        }
      } else {
        const result = await geminiModel.generateContent(currentMessage)
        const response = await result.response
        const content = response.text()

        const latency = Date.now() - startTime
        const inputTokens = response.usageMetadata?.promptTokenCount || estimateTokens(currentMessage)
        const outputTokens = response.usageMetadata?.candidatesTokenCount || estimateTokens(content)
        
        const pricing = MODEL_PRICING[`google:${model}`] || MODEL_PRICING['google:gemini-2.5-flash'] || DEFAULT_PRICING
        const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

        return {
          provider: 'Google',
          model,
          content,
          latency,
          cost,
          inputTokens,
          outputTokens,
        }
      }
    }

    // Construir histórico para chat
    // Gemini requer que o histórico comece com 'user' e alterne entre 'user' e 'model'
    const historyMessages = filteredMessages.slice(0, -1)
    const history: Array<{ role: string; parts: Array<{ text: string }> }> = []

    // Garantir que começa com 'user'
    let lastRole = ''
    for (const msg of historyMessages) {
      const role = msg.role === 'assistant' ? 'model' : 'user'
      
      // Pular se não alternar corretamente (evitar duplicatas)
      if (lastRole === role) {
        continue
      }
      
      history.push({
        role,
        parts: [{ text: msg.content }],
      })
      lastRole = role
    }

    // Se o histórico não começa com 'user', usar apenas a mensagem atual
    if (history.length === 0 || history[0].role !== 'user') {
      console.log('[callGemini] Histórico inválido, usando apenas mensagem atual')
      
      if (stream) {
        const result = await geminiModel.generateContentStream(currentMessage)
        const encoder = new TextEncoder()
        const readable = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of result.stream) {
                const text = chunk.text()
                if (text) {
                  controller.enqueue(encoder.encode(text))
                }
              }
            } catch (error: any) {
              console.error('[callGemini] Erro no stream:', error)
              controller.error(new Error(`Erro no stream Gemini: ${error.message || error}`))
            } finally {
              controller.close()
            }
          },
        })

        return {
          provider: 'Google',
          model,
          content: '',
          latency: 0,
          cost: 0,
          stream: readable,
        }
      } else {
        const result = await geminiModel.generateContent(currentMessage)
        const response = await result.response
        const content = response.text()

        const latency = Date.now() - startTime
        const inputTokens = response.usageMetadata?.promptTokenCount || estimateTokens(currentMessage)
        const outputTokens = response.usageMetadata?.candidatesTokenCount || estimateTokens(content)
        
        const pricing = MODEL_PRICING[`google:${model}`] || MODEL_PRICING['google:gemini-2.5-flash'] || DEFAULT_PRICING
        const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

        return {
          provider: 'Google',
          model,
          content,
          latency,
          cost,
          inputTokens,
          outputTokens,
        }
      }
    }

    console.log('[callGemini] Usando startChat com histórico:', { historyLength: history.length })

    // Usar startChat com histórico válido
    if (stream) {
      const chat = geminiModel.startChat({ history: history as any })
      const result = await chat.sendMessageStream(currentMessage)

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of result.stream) {
              const text = chunk.text()
              if (text) {
                controller.enqueue(encoder.encode(text))
              }
            }
          } catch (error: any) {
            console.error('[callGemini] Erro no stream com histórico:', error)
            controller.error(new Error(`Erro no stream Gemini: ${error.message || error}`))
          } finally {
            controller.close()
          }
        },
      })

      return {
        provider: 'Google',
        model,
        content: '',
        latency: 0,
        cost: 0,
        stream: readable,
      }
    } else {
      const chat = geminiModel.startChat({ history: history as any })
      const result = await chat.sendMessage(currentMessage)
      const response = await result.response
      const content = response.text()

      const latency = Date.now() - startTime
      const inputTokens = response.usageMetadata?.promptTokenCount || estimateTokens(filteredMessages.map(m => m.content).join(' '))
      const outputTokens = response.usageMetadata?.candidatesTokenCount || estimateTokens(content)
      
      const pricing = MODEL_PRICING[`google:${model}`] || MODEL_PRICING['google:gemini-2.5-flash'] || DEFAULT_PRICING
      const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

      return {
        provider: 'Google',
        model,
        content,
        latency,
        cost,
        inputTokens,
        outputTokens,
      }
    }
  } catch (error: any) {
    console.error('[callGemini] Erro geral:', error)
    throw new Error(`Erro ao chamar Gemini: ${error.message || error}`)
  }
}

async function callDeepSeek(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY não configurado')
  }

  // DeepSeek usa a mesma API da OpenAI, então podemos usar o SDK da OpenAI
  const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
  })

  // Converter mensagens para formato OpenAI/DeepSeek
  const formattedMessages = messages.map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content,
  }))

  const completion = await openai.chat.completions.create({
    model,
    messages: formattedMessages as any,
    stream,
  })

  const latency = Date.now() - startTime

  if (stream) {
    // Retornar stream
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion as any) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(encoder.encode(content))
            }
          }
        } catch (error) {
          console.error('Erro no stream DeepSeek:', error)
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    return {
      provider: 'DeepSeek',
      model,
      content: '',
      latency,
      cost: 0, // Será calculado depois com base no tamanho final
      stream: readable,
    }
  } else {
    // Resposta completa
    const content = (completion as any).choices[0]?.message?.content || ''
    const usage = (completion as any).usage || {}
    const inputTokens = usage.prompt_tokens || estimateTokens(messages.map(m => m.content).join(' '))
    const outputTokens = usage.completion_tokens || estimateTokens(content)
    
    const pricing = MODEL_PRICING[`deepseek:${model}`] || MODEL_PRICING['deepseek:deepseek-chat'] || DEFAULT_PRICING
    const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

    console.log(`[callDeepSeek] Custo calculado:`, {
      model,
      inputTokens,
      outputTokens,
      pricing,
      cost,
    })

    return {
      provider: 'DeepSeek',
      model,
      content,
      latency,
      cost,
      inputTokens,
      outputTokens,
    }
  }
}

async function callGrok(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  if (!process.env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY não configurado')
  }

  // Grok (xAI) usa a mesma API da OpenAI
  const openai = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  })

  // Converter mensagens para formato OpenAI/Grok
  const formattedMessages = messages.map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content,
  }))

  const completion = await openai.chat.completions.create({
    model,
    messages: formattedMessages as any,
    stream,
  })

  const latency = Date.now() - startTime

  if (stream) {
    // Retornar stream
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion as any) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(encoder.encode(content))
            }
          }
        } catch (error) {
          console.error('Erro no stream Grok:', error)
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    return {
      provider: 'Grok',
      model,
      content: '',
      latency,
      cost: 0, // Será calculado depois com base no tamanho final
      stream: readable,
    }
  } else {
    // Resposta completa
    const content = (completion as any).choices[0]?.message?.content || ''
    const usage = (completion as any).usage || {}
    const inputTokens = usage.prompt_tokens || estimateTokens(messages.map(m => m.content).join(' '))
    const outputTokens = usage.completion_tokens || estimateTokens(content)
    
    const pricing = MODEL_PRICING[`grok:${model}`] || MODEL_PRICING['grok:grok-4-fast'] || DEFAULT_PRICING
    const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

    console.log(`[callGrok] Custo calculado:`, {
      model,
      inputTokens,
      outputTokens,
      pricing,
      cost,
    })

    return {
      provider: 'Grok',
      model,
      content,
      latency,
      cost,
      inputTokens,
      outputTokens,
    }
  }
}

async function callClaude(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurado')
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  // Converter mensagens para formato Anthropic
  const systemMessage = messages.find(msg => msg.role === 'system')
  const conversationMessages = messages.filter(msg => msg.role !== 'system').map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }))

  if (stream) {
    // Stream mode
    const response = await anthropic.messages.stream({
      model,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: conversationMessages as any,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text
              if (text) {
                controller.enqueue(encoder.encode(text))
              }
            }
          }
        } catch (error) {
          console.error('Erro no stream Claude:', error)
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    const latency = Date.now() - startTime

    return {
      provider: 'Anthropic',
      model,
      content: '',
      latency,
      cost: 0, // Será calculado depois
      stream: readable,
    }
  } else {
    // Non-stream mode
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: conversationMessages as any,
    })

    const latency = Date.now() - startTime
    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    
    // Anthropic retorna usage info
    const inputTokens = response.usage.input_tokens || estimateTokens(messages.map(m => m.content).join(' '))
    const outputTokens = response.usage.output_tokens || estimateTokens(content)
    
    const pricing = MODEL_PRICING[`anthropic:${model}`] || MODEL_PRICING['anthropic:claude-3-5-haiku-20241022'] || DEFAULT_PRICING
    const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

    console.log(`[callClaude] Custo calculado:`, {
      model,
      inputTokens,
      outputTokens,
      pricing,
      cost,
    })

    return {
      provider: 'Anthropic',
      model,
      content,
      latency,
      cost,
      inputTokens,
      outputTokens,
    }
  }
}

async function callReplicate(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN não configurado')
  }

  // Detectar modelos de geração de vídeo
  if (model.includes('seedance')) {
    return await callSeedanceVideo(model, messages, stream, startTime)
  }

  // Detectar modelos de edição de imagem (FLUX Kontext)
  if (model.includes('kontext')) {
    return await callFluxKontext(model, messages, stream, startTime)
  }

  // Detectar modelos de geração de imagem (FLUX)
  if (model.includes('flux')) {
    return await callFluxImage(model, messages, stream, startTime)
  }

  // Detectar modelos de geração/edição de imagem (Seedream)
  if (model.includes('seedream')) {
    return await callSeedreamImage(model, messages, stream, startTime)
  }

  // Detectar modelos de geração de imagem (Ideogram)
  if (model.includes('ideogram-character')) {
    return await callIdeogramCharacter(model, messages, stream, startTime)
  } else if (model.includes('ideogram')) {
    return await callIdeogramImage(model, messages, stream, startTime)
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  })

  try {
    // Converter mensagens para formato do Llama 3.1
    // O Llama 3.1 405B Instruct usa formato de mensagens chat-style
    const systemMessage = messages.find(msg => msg.role === 'system')
    const conversationMessages = messages.filter(msg => msg.role !== 'system')

    // Construir prompt no formato esperado pelo Llama 3.1
    // O formato é: <|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system}<|eot_id|>...
    let prompt = ''
    
    if (systemMessage) {
      prompt += `<|start_header_id|>system<|end_header_id|>\n\n${systemMessage.content}<|eot_id|>\n`
    }

    // Adicionar mensagens da conversa no formato Llama 3.1
    for (const msg of conversationMessages) {
      const role = msg.role === 'assistant' ? 'assistant' : 'user'
      prompt += `<|start_header_id|>${role}<|end_header_id|>\n\n${msg.content}<|eot_id|>\n`
    }

    // Adicionar prompt para o assistente responder
    prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n`

    // Configurar input baseado no modelo
    // Para meta/meta-llama-3.1-405b-instruct, o parâmetro é 'prompt'
    const input: any = {
      prompt: prompt,
    }

    // Adicionar parâmetros específicos para modelos Llama
    if (model.includes('llama') || model.includes('meta')) {
      // Parâmetros padrão para Llama 3.1
      input.max_tokens = 2048
      input.temperature = 0.7
      input.top_p = 0.9
      // Adicionar outros parâmetros se necessário
      // input.top_k = 40
      // input.repetition_penalty = 1.1
    }

    const latency = Date.now() - startTime

    if (stream) {
      // Stream mode
      // O Replicate retorna um iterador assíncrono
      const output = replicate.stream(model, { input })
      
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // O output do Replicate pode ser um array de strings ou um iterador
            for await (const chunk of output) {
              // O formato do chunk pode variar dependendo do modelo
              // Vamos tratar diferentes formatos
              let text = ''
              
              if (typeof chunk === 'string') {
                text = chunk
              } else if (Array.isArray(chunk)) {
                // Alguns modelos retornam arrays de strings
                text = chunk.join('')
              } else if (chunk && typeof chunk === 'object') {
                // Alguns modelos retornam objetos com propriedades diferentes
                text = chunk.text || chunk.content || chunk.output || chunk.toString() || JSON.stringify(chunk)
              }
              
              if (text && text.trim()) {
                controller.enqueue(encoder.encode(text))
              }
            }
          } catch (error: any) {
            console.error('[callReplicate] Erro no stream:', error)
            controller.error(new Error(`Erro no stream Replicate: ${error.message || error}`))
          } finally {
            controller.close()
          }
        },
      })

      return {
        provider: 'Replicate',
        model,
        content: '',
        latency,
        cost: 0, // Será calculado depois
        stream: readable,
      }
    } else {
      // Non-stream mode
      const output = await replicate.run(model, { input }) as any
      
      // O output do Replicate pode ser string ou array de strings
      let content = ''
      if (typeof output === 'string') {
        content = output
      } else if (Array.isArray(output)) {
        // Replicate geralmente retorna arrays de strings
        content = output.join('')
      } else if (output && typeof output === 'object') {
        // Alguns modelos retornam objetos
        content = output.text || output.content || output.output || output.toString() || JSON.stringify(output)
      }

      const finalLatency = Date.now() - startTime
      
      // Calcular tokens (estimativa)
      const inputTokens = estimateTokens(prompt)
      const outputTokens = estimateTokens(content)
      
      // Preço do Replicate é baseado no tempo de execução e recursos usados
      // Por enquanto, vamos usar um preço fixo ou estimado
      // O Replicate cobra por segundo de execução, não por token
      // Para modelos grandes como o 405B, pode ser caro
      const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
      const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

      console.log(`[callReplicate] Custo calculado:`, {
        model,
        inputTokens,
        outputTokens,
        pricing,
        cost,
        latency: finalLatency,
      })

      return {
        provider: 'Replicate',
        model,
        content,
        latency: finalLatency,
        cost,
        inputTokens,
        outputTokens,
      }
    }
  } catch (error: any) {
    console.error('[callReplicate] Erro:', error)
    throw new Error(`Erro ao chamar Replicate: ${error.message || error}`)
  }
}

/**
 * Chama a API do FLUX (1.1 Pro ou Krea [dev]) via Replicate para geração de imagens
 */
async function callFluxImage(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN não configurado')
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    })

    const isKrea = model.includes('krea')
    const modelName = isKrea ? 'FLUX.1 Krea [dev]' : 'FLUX 1.1 Pro'
    const modelIcon = isKrea ? '📸' : '🎨'

    // Modelos de imagem não suportam streaming tradicional
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`${modelIcon} Gerando imagem com ${modelName}... Isso pode levar alguns segundos.\n\n`))
            controller.close()
          } catch (error: any) {
            controller.error(error)
          }
        },
      })

      return {
        provider: 'Replicate',
        model,
        content: '',
        latency: 0,
        cost: 0,
        stream: readable,
      }
    }

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para gerar imagem')
    }

    const prompt = lastUserMessage.content

    // Detectar parâmetros do prompt ou usar padrões
    const promptLower = prompt.toLowerCase()
    
    // Detectar resolução no prompt ou usar padrão
    // FLUX 1.1 Pro suporta múltiplas resoluções
    let aspect_ratio = '1:1' // Padrão quadrado
    if (promptLower.includes('16:9') || promptLower.includes('paisagem') || promptLower.includes('landscape') || promptLower.includes('widescreen')) {
      aspect_ratio = '16:9'
    } else if (promptLower.includes('9:16') || promptLower.includes('retrato') || promptLower.includes('portrait') || promptLower.includes('vertical')) {
      aspect_ratio = '9:16'
    } else if (promptLower.includes('21:9') || promptLower.includes('ultrawide')) {
      aspect_ratio = '21:9'
    } else if (promptLower.includes('4:3')) {
      aspect_ratio = '4:3'
    } else if (promptLower.includes('3:4')) {
      aspect_ratio = '3:4'
    }

    // Detectar número de imagens (output_format)
    let output_format = 'png' // Padrão PNG
    if (promptLower.includes('jpeg') || promptLower.includes('jpg')) {
      output_format = 'jpeg'
    } else if (promptLower.includes('webp')) {
      output_format = 'webp'
    }

    // Detectar número de imagens a gerar
    const numImagesMatch = prompt.match(/(\d+)\s*(imagens?|images?)/i)
    const num_outputs = numImagesMatch ? Math.min(parseInt(numImagesMatch[1]), 4) : 1 // Máximo 4 imagens

    // Configurar input para FLUX 1.1 Pro
    // Documentação: https://replicate.com/black-forest-labs/flux-1.1-pro
    const input: any = {
      prompt: prompt,
      aspect_ratio: aspect_ratio,
      output_format: output_format,
      num_outputs: num_outputs,
    }

    // Chamar a API do Replicate
    const startExecutionTime = Date.now()
    const output = await replicate.run(model, { input }) as any
    
    // O output do FLUX é um array de URLs de imagens
    let imageUrls: string[] = []
    if (Array.isArray(output)) {
      imageUrls = output.filter((url: any) => typeof url === 'string' && url.startsWith('http'))
    } else if (typeof output === 'string' && output.startsWith('http')) {
      imageUrls = [output]
    } else if (output && typeof output === 'object') {
      // Alguns formatos podem retornar objeto com URLs
      const urls = output.urls || output.images || output.output || []
      if (Array.isArray(urls)) {
        imageUrls = urls.filter((url: any) => typeof url === 'string' && url.startsWith('http'))
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('Resposta da API não contém URLs de imagens')
    }

    const executionTime = Date.now() - startExecutionTime
    const latency = Date.now() - startTime

    // Calcular custo: ~$0.003 por segundo de execução
    // Estimativa baseada no tempo de execução
    const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
    const executionSeconds = executionTime / 1000
    const cost = pricing.input * executionSeconds * imageUrls.length // Custo por imagem gerada

    // Construir resposta em formato de mensagem com imagens
    let content = `${modelIcon} **Imagem${imageUrls.length > 1 ? 's' : ''} gerada${imageUrls.length > 1 ? 's' : ''} com ${modelName}!**\n\n`
    
    // Adicionar todas as imagens geradas
    imageUrls.forEach((url, index) => {
      if (imageUrls.length > 1) {
        content += `**Imagem ${index + 1}:**\n`
      }
      content += `![Imagem gerada](${url})\n\n`
    })
    
    content += `**Parâmetros:**\n`
    content += `- Aspecto: ${aspect_ratio}\n`
    content += `- Formato: ${output_format.toUpperCase()}\n`
    content += `- Quantidade: ${imageUrls.length}\n`
    content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
    content += `**Tempo de execução:** ${executionSeconds.toFixed(1)}s\n`
    content += `**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(3)}/segundo × ${executionSeconds.toFixed(1)}s × ${imageUrls.length} imagem${imageUrls.length > 1 ? 's' : ''})`
    
    if (isKrea) {
      content += `\n\n*FLUX.1 Krea [dev] oferece fotorealismo excepcional que evita o "AI look" oversaturado, com estética distintiva e imagens visualmente interessantes*`
    } else {
      content += `\n\n*FLUX 1.1 Pro oferece excelente qualidade, aderência ao prompt e diversidade de saída*`
    }

    return {
      provider: 'Replicate',
      model,
      content,
      latency,
      cost,
      metadata: {
        aspect_ratio,
        output_format,
        num_outputs: imageUrls.length,
        imageUrls,
        executionTime: executionSeconds,
      },
    }
  } catch (error: any) {
    console.error('[callFluxImage] Erro:', error)
    
    // Mensagens de erro específicas
    if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
      throw new Error('REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.')
    }
    
    if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
      throw new Error(`Erro no prompt de geração de imagem: ${error.message}`)
    }
    
    const modelName = model.includes('krea') ? 'FLUX.1 Krea [dev]' : 'FLUX 1.1 Pro'
    throw new Error(`Erro ao gerar imagem com ${modelName}: ${error.message || error}`)
  }
}

/**
 * Chama a API do FLUX.1 Kontext (max, pro ou dev) via Replicate para edição de imagens baseada em texto
 */
async function callFluxKontext(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN não configurado')
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    })

    const isMax = model.includes('max')
    const isPro = model.includes('pro')
    const isDev = model.includes('dev')
    const modelName = isMax ? 'FLUX.1 Kontext [max]' : (isPro ? 'FLUX.1 Kontext [pro]' : (isDev ? 'FLUX.1 Kontext [dev]' : 'FLUX.1 Kontext'))
    const modelIcon = isMax ? '✏️' : (isPro ? '⭐' : (isDev ? '🔧' : '✏️'))

    // Modelos de imagem não suportam streaming tradicional
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`${modelIcon} Editando imagem com ${modelName}... Isso pode levar alguns segundos.\n\n`))
            controller.close()
          } catch (error: any) {
            controller.error(error)
          }
        },
      })

      return {
        provider: 'Replicate',
        model,
        content: '',
        latency: 0,
        cost: 0,
        stream: readable,
      }
    }

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para editar imagem')
    }

    const prompt = lastUserMessage.content
    const promptLower = prompt.toLowerCase()

    // Verificar se há imagem anexada (obrigatória para edição)
    const msgAny = lastUserMessage as any
    let imageUrl: string | null = null
    
    if (msgAny.attachments && Array.isArray(msgAny.attachments)) {
      const imageAttachments = msgAny.attachments.filter((a: any) => a.type === 'image')
      if (imageAttachments.length > 0) {
        imageUrl = imageAttachments[0].url
      }
    }

    if (!imageUrl) {
      throw new Error(`${modelName} requer uma imagem para editar. Por favor, anexe uma imagem.`)
    }

    // Detectar tipo de edição baseado no prompt
    const isStyleTransfer = promptLower.includes('estilo') ||
                           promptLower.includes('style') ||
                           promptLower.includes('pintura') ||
                           promptLower.includes('painting') ||
                           promptLower.includes('aquarela') ||
                           promptLower.includes('watercolor') ||
                           promptLower.includes('óleo') ||
                           promptLower.includes('oil')
    
    const isTextEditing = promptLower.includes('texto') ||
                         promptLower.includes('text') ||
                         promptLower.includes('substituir') ||
                         promptLower.includes('replace') ||
                         promptLower.includes('trocar') ||
                         promptLower.includes('change') ||
                         promptLower.includes('"') // Aspas indicam edição de texto
    
    const isBackgroundChange = promptLower.includes('fundo') ||
                              promptLower.includes('background') ||
                              promptLower.includes('cenário') ||
                              promptLower.includes('scenario')
    
    const isObjectChange = promptLower.includes('cabelo') ||
                          promptLower.includes('hair') ||
                          promptLower.includes('roupa') ||
                          promptLower.includes('clothing') ||
                          promptLower.includes('acessório') ||
                          promptLower.includes('accessory') ||
                          promptLower.includes('cor') ||
                          promptLower.includes('color')

    // Detectar se precisa preservar algo
    const preserveFeatures = promptLower.includes('manter') ||
                            promptLower.includes('keep') ||
                            promptLower.includes('preservar') ||
                            promptLower.includes('preserve') ||
                            promptLower.includes('mesma') ||
                            promptLower.includes('same')

    // Configurar input para FLUX.1 Kontext
    // Documentação: https://replicate.com/black-forest-labs/flux-kontext-max, flux-kontext-pro ou flux-kontext-dev
    const input: any = {
      image: imageUrl,
      prompt: prompt,
    }

    // Chamar a API do Replicate
    const startExecutionTime = Date.now()
    const output = await replicate.run(model, { input }) as any
    
    // O output do Kontext é uma URL de imagem editada
    let imageUrlResult: string | null = null
    if (typeof output === 'string' && output.startsWith('http')) {
      imageUrlResult = output
    } else if (Array.isArray(output) && output.length > 0) {
      imageUrlResult = output.find((url: any) => typeof url === 'string' && url.startsWith('http')) || output[0]
    } else if (output && typeof output === 'object') {
      imageUrlResult = output.url || output.image || output.output || null
    }

    if (!imageUrlResult) {
      throw new Error('Resposta da API não contém URL de imagem editada')
    }

    const executionTime = Date.now() - startExecutionTime
    const latency = Date.now() - startTime
    const executionSeconds = executionTime / 1000

    // Calcular custo: ~$0.01/s (max), ~$0.007/s (pro) ou ~$0.005/s (dev) por segundo de execução
    const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
    const cost = pricing.input * executionSeconds

    // Construir resposta em formato de mensagem com imagem editada
    let content = `${modelIcon} **Imagem editada com ${modelName}!**\n\n`
    content += `![Imagem editada](${imageUrlResult})\n\n`
    
    content += `**Tipo de edição:**\n`
    if (isTextEditing) {
      content += `- Edição de texto (tipografia melhorada)\n`
    }
    if (isStyleTransfer) {
      content += `- Transferência de estilo\n`
    }
    if (isBackgroundChange) {
      content += `- Troca de fundo\n`
    }
    if (isObjectChange) {
      content += `- Modificação de objetos/roupas\n`
    }
    if (!isTextEditing && !isStyleTransfer && !isBackgroundChange && !isObjectChange) {
      content += `- Edição geral baseada em texto\n`
    }
    
    if (preserveFeatures) {
      content += `- Preservação de características solicitadas\n`
    }
    
    content += `\n**Prompt de edição:** "${prompt}"\n`
    content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
    content += `**Tempo de execução:** ${executionSeconds.toFixed(1)}s\n`
    content += `**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(2)}/segundo × ${executionSeconds.toFixed(1)}s)`
    
    if (isMax) {
      content += `\n\n*FLUX.1 Kontext [max] oferece máxima performance em edição de imagem, geração de tipografia melhorada e resultados superiores*`
    } else if (isPro) {
      content += `\n\n*FLUX.1 Kontext [pro] oferece performance state-of-the-art com saídas de alta qualidade, excelente seguimento de prompt e resultados consistentes*`
    } else if (isDev) {
      content += `\n\n*FLUX.1 Kontext [dev] é a versão open-weight com boa performance e uso comercial disponível via Replicate*`
    } else {
      content += `\n\n*FLUX.1 Kontext oferece excelente performance em edição de imagem baseada em texto*`
    }

    return {
      provider: 'Replicate',
      model,
      content,
      latency,
      cost,
      metadata: {
        imageUrl: imageUrlResult,
        executionTime: executionSeconds,
        editType: {
          textEditing: isTextEditing,
          styleTransfer: isStyleTransfer,
          backgroundChange: isBackgroundChange,
          objectChange: isObjectChange,
        },
        preserveFeatures,
      },
    }
  } catch (error: any) {
    console.error('[callFluxKontext] Erro:', error)
    
    // Mensagens de erro específicas
    if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
      throw new Error('REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.')
    }
    
    if (error.message?.includes('imagem') || error.message?.includes('image')) {
      throw new Error(`Erro com imagem: ${error.message}`)
    }
    
    if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
      throw new Error(`Erro no prompt de edição: ${error.message}`)
    }
    
    throw new Error(`Erro ao editar imagem com ${modelName}: ${error.message || error}`)
  }
}

/**
 * Chama a API do Seedream 4.0 via Replicate para geração e edição de imagens
 */
async function callSeedreamImage(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN não configurado')
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    })

    // Modelos de imagem não suportam streaming tradicional
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode('✨ Gerando/Editando imagem com Seedream 4.0... Isso pode levar alguns segundos.\n\n'))
            controller.close()
          } catch (error: any) {
            controller.error(error)
          }
        },
      })

      return {
        provider: 'Replicate',
        model,
        content: '',
        latency: 0,
        cost: 0,
        stream: readable,
      }
    }

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para gerar/editar imagem')
    }

    const prompt = lastUserMessage.content
    const promptLower = prompt.toLowerCase()

    // Verificar se há imagens anexadas (para edição)
    const msgAny = lastUserMessage as any
    let referenceImages: string[] = []
    
    if (msgAny.attachments && Array.isArray(msgAny.attachments)) {
      const imageAttachments = msgAny.attachments.filter((a: any) => a.type === 'image')
      referenceImages = imageAttachments.map((a: any) => a.url).filter(Boolean)
    }

    // Detectar se é edição ou geração baseado no prompt e presença de imagens
    const isEditing = referenceImages.length > 0 || 
                      promptLower.includes('remover') || 
                      promptLower.includes('remove') ||
                      promptLower.includes('substituir') ||
                      promptLower.includes('replace') ||
                      promptLower.includes('editar') ||
                      promptLower.includes('edit') ||
                      promptLower.includes('modificar') ||
                      promptLower.includes('modify')

    // Detectar resolução no prompt ou usar padrão
    // Seedream 4.0 suporta até 4K
    let width = 1024
    let height = 1024
    
    if (promptLower.includes('4k') || promptLower.includes('3840') || promptLower.includes('4096')) {
      width = 3840
      height = 2160 // 4K UHD
    } else if (promptLower.includes('2k') || promptLower.includes('2560')) {
      width = 2560
      height = 1440 // 2K QHD
    } else if (promptLower.includes('1080p') || promptLower.includes('full hd')) {
      width = 1920
      height = 1080
    } else if (promptLower.includes('16:9') || promptLower.includes('paisagem') || promptLower.includes('landscape')) {
      width = 1920
      height = 1080
    } else if (promptLower.includes('9:16') || promptLower.includes('retrato') || promptLower.includes('portrait')) {
      width = 1080
      height = 1920
    } else if (promptLower.includes('21:9') || promptLower.includes('ultrawide')) {
      width = 2560
      height = 1080
    }

    // Detectar número de imagens a gerar
    const numImagesMatch = prompt.match(/(\d+)\s*(imagens?|images?|outputs?)/i)
    const num_outputs = numImagesMatch ? Math.min(parseInt(numImagesMatch[1]), 4) : 1 // Máximo 4 imagens

    // Detectar modo de edição específico
    let edit_mode: string | undefined = undefined
    if (isEditing) {
      if (promptLower.includes('remover') || promptLower.includes('remove')) {
        edit_mode = 'remove'
      } else if (promptLower.includes('substituir') || promptLower.includes('replace')) {
        edit_mode = 'replace'
      } else if (promptLower.includes('estilo') || promptLower.includes('style') || promptLower.includes('transfer')) {
        edit_mode = 'style_transfer'
      }
    }

    // Configurar input para Seedream 4.0
    // Documentação: https://replicate.com/bytedance/seedream-4
    const input: any = {
      prompt: prompt,
      width: width,
      height: height,
      num_outputs: num_outputs,
    }

    // Adicionar imagens de referência se houver (para edição ou multi-reference)
    if (referenceImages.length > 0) {
      input.image = referenceImages[0] // Primeira imagem como referência principal
      if (referenceImages.length > 1) {
        // Seedream suporta múltiplas referências
        input.reference_images = referenceImages.slice(0, 4) // Máximo 4 referências
      }
    }

    // Adicionar modo de edição se especificado
    if (edit_mode) {
      input.edit_mode = edit_mode
    }

    // Chamar a API do Replicate
    const startExecutionTime = Date.now()
    const output = await replicate.run(model, { input }) as any
    
    // O output do Seedream é um array de URLs de imagens
    let imageUrls: string[] = []
    if (Array.isArray(output)) {
      imageUrls = output.filter((url: any) => typeof url === 'string' && url.startsWith('http'))
    } else if (typeof output === 'string' && output.startsWith('http')) {
      imageUrls = [output]
    } else if (output && typeof output === 'object') {
      // Alguns formatos podem retornar objeto com URLs
      const urls = output.urls || output.images || output.output || []
      if (Array.isArray(urls)) {
        imageUrls = urls.filter((url: any) => typeof url === 'string' && url.startsWith('http'))
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('Resposta da API não contém URLs de imagens')
    }

    const executionTime = Date.now() - startExecutionTime
    const latency = Date.now() - startTime

    // Calcular custo: ~$0.004 por segundo de execução
    const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
    const executionSeconds = executionTime / 1000
    const cost = pricing.input * executionSeconds * imageUrls.length

    // Construir resposta em formato de mensagem com imagens
    const modeText = isEditing ? 'editada' : 'gerada'
    let content = `✨ **Imagem${imageUrls.length > 1 ? 's' : ''} ${modeText}${imageUrls.length > 1 ? 's' : ''} com Seedream 4.0!**\n\n`
    
    // Adicionar todas as imagens geradas/editadas
    imageUrls.forEach((url, index) => {
      if (imageUrls.length > 1) {
        content += `**Imagem ${index + 1}:**\n`
      }
      content += `![Imagem ${modeText}](${url})\n\n`
    })
    
    content += `**Parâmetros:**\n`
    content += `- Resolução: ${width}x${height}${width >= 3840 ? ' (4K)' : width >= 2560 ? ' (2K)' : ''}\n`
    content += `- Quantidade: ${imageUrls.length}\n`
    if (isEditing) {
      content += `- Modo: Edição de imagem\n`
      if (edit_mode) {
        content += `- Tipo de edição: ${edit_mode}\n`
      }
      if (referenceImages.length > 0) {
        content += `- Imagens de referência: ${referenceImages.length}\n`
      }
    } else {
      content += `- Modo: Geração de imagem\n`
    }
    content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
    content += `**Tempo de execução:** ${executionSeconds.toFixed(1)}s\n`
    content += `**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(3)}/segundo × ${executionSeconds.toFixed(1)}s × ${imageUrls.length} imagem${imageUrls.length > 1 ? 's' : ''})`
    
    content += `\n\n*Seedream 4.0 oferece geração e edição unificadas, suporte a até 4K e múltiplas referências*`

    return {
      provider: 'Replicate',
      model,
      content,
      latency,
      cost,
      metadata: {
        width,
        height,
        num_outputs: imageUrls.length,
        imageUrls,
        executionTime: executionSeconds,
        isEditing,
        edit_mode,
        referenceImagesCount: referenceImages.length,
      },
    }
  } catch (error: any) {
    console.error('[callSeedreamImage] Erro:', error)
    
    // Mensagens de erro específicas
    if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
      throw new Error('REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.')
    }
    
    if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
      throw new Error(`Erro no prompt de geração/edição de imagem: ${error.message}`)
    }
    
    throw new Error(`Erro ao gerar/editar imagem com Seedream 4.0: ${error.message || error}`)
  }
}

/**
 * Chama a API do Ideogram v3 (Turbo ou Quality) via Replicate para geração de imagens
 */
async function callIdeogramImage(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN não configurado')
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    })

    const isQuality = model.includes('quality')
    const isBalanced = model.includes('balanced')
    const isTurbo = model.includes('turbo')
    
    let modelName = 'Ideogram v3'
    if (isQuality) {
      modelName = 'Ideogram v3 Quality'
    } else if (isBalanced) {
      modelName = 'Ideogram v3 Balanced'
    } else if (isTurbo) {
      modelName = 'Ideogram v3 Turbo'
    }

    // Modelos de imagem não suportam streaming tradicional
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`🎨 Gerando imagem com ${modelName}... Isso pode levar alguns segundos.\n\n`))
            controller.close()
          } catch (error: any) {
            controller.error(error)
          }
        },
      })

      return {
        provider: 'Replicate',
        model,
        content: '',
        latency: 0,
        cost: 0,
        stream: readable,
      }
    }

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para gerar imagem')
    }

    const prompt = lastUserMessage.content
    const promptLower = prompt.toLowerCase()

    // Verificar se há imagens anexadas (para style references)
    const msgAny = lastUserMessage as any
    let styleReferences: string[] = []
    
    if (msgAny.attachments && Array.isArray(msgAny.attachments)) {
      const imageAttachments = msgAny.attachments.filter((a: any) => a.type === 'image')
      styleReferences = imageAttachments.map((a: any) => a.url).filter(Boolean).slice(0, 3) // Máximo 3 referências
    }

    // Detectar aspect ratio no prompt ou usar padrão
    // Ideogram v3 Turbo suporta múltiplos aspect ratios
    let aspect_ratio = '1:1' // Padrão quadrado
    
    if (promptLower.includes('16:9') || promptLower.includes('paisagem') || promptLower.includes('landscape') || promptLower.includes('widescreen')) {
      aspect_ratio = '16:9'
    } else if (promptLower.includes('9:16') || promptLower.includes('retrato') || promptLower.includes('portrait') || promptLower.includes('vertical')) {
      aspect_ratio = '9:16'
    } else if (promptLower.includes('4:5')) {
      aspect_ratio = '4:5'
    } else if (promptLower.includes('5:4')) {
      aspect_ratio = '5:4'
    } else if (promptLower.includes('21:9') || promptLower.includes('ultrawide')) {
      aspect_ratio = '21:9'
    }

    // Detectar se quer usar random style
    const useRandomStyle = promptLower.includes('random style') || 
                          promptLower.includes('estilo aleatório') ||
                          promptLower.includes('estilo random')

    // Detectar se há style code mencionado no prompt
    const styleCodeMatch = prompt.match(/style[_\s]?code[:\s]+([a-zA-Z0-9]+)/i)
    const style_code = styleCodeMatch ? styleCodeMatch[1] : undefined

    // Detectar se é para design gráfico (melhor renderização de texto)
    const isGraphicDesign = promptLower.includes('logo') ||
                           promptLower.includes('design gráfico') ||
                           promptLower.includes('graphic design') ||
                           promptLower.includes('texto') ||
                           promptLower.includes('text') ||
                           promptLower.includes('tipografia') ||
                           promptLower.includes('typography') ||
                           promptLower.includes('marca') ||
                           promptLower.includes('branding') ||
                           promptLower.includes('publicidade') ||
                           promptLower.includes('advertising') ||
                           promptLower.includes('marketing')

    // Configurar input para Ideogram v3 Turbo
    // Documentação: https://replicate.com/ideogram-ai/ideogram-v3-turbo
    const input: any = {
      prompt: prompt,
      aspect_ratio: aspect_ratio,
    }

    // Adicionar style references se houver (até 3)
    if (styleReferences.length > 0) {
      input.style_references = styleReferences
    }

    // Adicionar random style se solicitado
    if (useRandomStyle) {
      input.random_style = true
    }

    // Adicionar style code se fornecido
    if (style_code) {
      input.style_code = style_code
    }

    // Chamar a API do Replicate
    const startExecutionTime = Date.now()
    const output = await replicate.run(model, { input }) as any
    
    // O output do Ideogram é um array de URLs de imagens
    let imageUrls: string[] = []
    if (Array.isArray(output)) {
      imageUrls = output.filter((url: any) => typeof url === 'string' && url.startsWith('http'))
    } else if (typeof output === 'string' && output.startsWith('http')) {
      imageUrls = [output]
    } else if (output && typeof output === 'object') {
      // Alguns formatos podem retornar objeto com URLs
      const urls = output.urls || output.images || output.output || []
      if (Array.isArray(urls)) {
        imageUrls = urls.filter((url: any) => typeof url === 'string' && url.startsWith('http'))
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('Resposta da API não contém URLs de imagens')
    }

    const executionTime = Date.now() - startExecutionTime
    const latency = Date.now() - startTime

    // Calcular custo: $0.03 (Turbo), $0.06 (Balanced) ou $0.09 (Quality) por imagem
    const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
    const cost = pricing.input * imageUrls.length

    // Construir resposta em formato de mensagem com imagens
    let content = `🎨 **Imagem${imageUrls.length > 1 ? 's' : ''} gerada${imageUrls.length > 1 ? 's' : ''} com ${modelName}!**\n\n`
    
    // Adicionar todas as imagens geradas
    imageUrls.forEach((url, index) => {
      if (imageUrls.length > 1) {
        content += `**Imagem ${index + 1}:**\n`
      }
      content += `![Imagem gerada](${url})\n\n`
    })
    
    content += `**Parâmetros:**\n`
    content += `- Aspecto: ${aspect_ratio}\n`
    content += `- Quantidade: ${imageUrls.length}\n`
    
    if (styleReferences.length > 0) {
      content += `- Referências de estilo: ${styleReferences.length}\n`
    }
    
    if (useRandomStyle) {
      content += `- Estilo: Aleatório (4.3 bilhões de presets)\n`
    }
    
    if (style_code) {
      content += `- Style Code: ${style_code}\n`
    }
    
    if (isGraphicDesign) {
      content += `- Modo: Design Gráfico (renderização de texto otimizada)\n`
    }
    
    content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
    content += `**Tempo de execução:** ${(executionTime / 1000).toFixed(1)}s\n`
    content += `**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(2)}/imagem × ${imageUrls.length} imagem${imageUrls.length > 1 ? 's' : ''})`
    
    if (isQuality) {
      content += `\n\n*Ideogram v3 Quality oferece máxima qualidade, renderização precisa de texto e fotorealismo superior*`
    } else if (isBalanced) {
      content += `\n\n*Ideogram v3 Balanced oferece bom equilíbrio entre velocidade e qualidade, renderização precisa de texto e fotorealismo excelente*`
    } else {
      content += `\n\n*Ideogram v3 Turbo oferece renderização precisa de texto, fotorealismo e controle de estilo avançado*`
    }

    return {
      provider: 'Replicate',
      model,
      content,
      latency,
      cost,
      metadata: {
        aspect_ratio,
        num_outputs: imageUrls.length,
        imageUrls,
        executionTime: executionTime / 1000,
        styleReferencesCount: styleReferences.length,
        useRandomStyle,
        style_code,
        isGraphicDesign,
      },
    }
  } catch (error: any) {
    console.error('[callIdeogramImage] Erro:', error)
    
    // Mensagens de erro específicas
    if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
      throw new Error('REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.')
    }
    
    if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
      throw new Error(`Erro no prompt de geração de imagem: ${error.message}`)
    }
    
    throw new Error(`Erro ao gerar imagem com ${modelName}: ${error.message || error}`)
  }
}

/**
 * Chama a API do Ideogram Character via Replicate para geração de personagens consistentes
 */
async function callIdeogramCharacter(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN não configurado')
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    })

    // Modelos de imagem não suportam streaming tradicional
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode('👤 Gerando variações de personagem com Ideogram Character... Isso pode levar alguns segundos.\n\n'))
            controller.close()
          } catch (error: any) {
            controller.error(error)
          }
        },
      })

      return {
        provider: 'Replicate',
        model,
        content: '',
        latency: 0,
        cost: 0,
        stream: readable,
      }
    }

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para gerar personagem')
    }

    const prompt = lastUserMessage.content
    const promptLower = prompt.toLowerCase()

    // Verificar se há imagem de referência anexada (obrigatória para Ideogram Character)
    const msgAny = lastUserMessage as any
    let referenceImage: string | null = null
    
    if (msgAny.attachments && Array.isArray(msgAny.attachments)) {
      const imageAttachments = msgAny.attachments.filter((a: any) => a.type === 'image')
      if (imageAttachments.length > 0) {
        referenceImage = imageAttachments[0].url
      }
    }

    if (!referenceImage) {
      throw new Error('Ideogram Character requer uma imagem de referência com características faciais claras. Por favor, anexe uma imagem do personagem.')
    }

    // Verificar se há imagem de destino para inpainting (adicionar personagem a imagem existente)
    let targetImage: string | null = null
    if (msgAny.attachments && Array.isArray(msgAny.attachments)) {
      const imageAttachments = msgAny.attachments.filter((a: any) => a.type === 'image')
      if (imageAttachments.length > 1) {
        targetImage = imageAttachments[1].url // Segunda imagem como destino para inpainting
      }
    }

    // Detectar se é inpainting baseado no prompt
    const isInpainting = targetImage !== null ||
                         promptLower.includes('adicionar') ||
                         promptLower.includes('add') ||
                         promptLower.includes('inserir') ||
                         promptLower.includes('insert') ||
                         promptLower.includes('colocar') ||
                         promptLower.includes('place') ||
                         promptLower.includes('na imagem') ||
                         promptLower.includes('in image')

    // Detectar aspect ratio no prompt ou usar padrão
    let aspect_ratio = '1:1' // Padrão quadrado
    
    if (promptLower.includes('16:9') || promptLower.includes('paisagem') || promptLower.includes('landscape')) {
      aspect_ratio = '16:9'
    } else if (promptLower.includes('9:16') || promptLower.includes('retrato') || promptLower.includes('portrait')) {
      aspect_ratio = '9:16'
    } else if (promptLower.includes('4:5')) {
      aspect_ratio = '4:5'
    } else if (promptLower.includes('5:4')) {
      aspect_ratio = '5:4'
    }

    // Detectar número de variações a gerar
    const numVariationsMatch = prompt.match(/(\d+)\s*(variações?|variations?|imagens?|images?)/i)
    const num_outputs = numVariationsMatch ? Math.min(parseInt(numVariationsMatch[1]), 4) : 1 // Máximo 4 variações

    // Detectar estilo artístico no prompt
    let style: string | undefined = undefined
    if (promptLower.includes('realista') || promptLower.includes('realistic') || promptLower.includes('fotográfico') || promptLower.includes('photographic')) {
      style = 'realistic'
    } else if (promptLower.includes('anime') || promptLower.includes('manga')) {
      style = 'anime'
    } else if (promptLower.includes('cartoon') || promptLower.includes('desenho animado')) {
      style = 'cartoon'
    } else if (promptLower.includes('3d') || promptLower.includes('3d render')) {
      style = '3d'
    }

    // Configurar input para Ideogram Character
    // Documentação: https://replicate.com/ideogram-ai/ideogram-character
    const input: any = {
      prompt: prompt,
      image: referenceImage, // Imagem de referência obrigatória
      aspect_ratio: aspect_ratio,
      num_outputs: num_outputs,
    }

    // Adicionar imagem de destino se for inpainting
    if (isInpainting && targetImage) {
      input.target_image = targetImage
    }

    // Adicionar estilo se especificado
    if (style) {
      input.style = style
    }

    // Chamar a API do Replicate
    const startExecutionTime = Date.now()
    const output = await replicate.run(model, { input }) as any
    
    // O output do Ideogram Character é um array de URLs de imagens
    let imageUrls: string[] = []
    if (Array.isArray(output)) {
      imageUrls = output.filter((url: any) => typeof url === 'string' && url.startsWith('http'))
    } else if (typeof output === 'string' && output.startsWith('http')) {
      imageUrls = [output]
    } else if (output && typeof output === 'object') {
      // Alguns formatos podem retornar objeto com URLs
      const urls = output.urls || output.images || output.output || []
      if (Array.isArray(urls)) {
        imageUrls = urls.filter((url: any) => typeof url === 'string' && url.startsWith('http'))
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('Resposta da API não contém URLs de imagens')
    }

    const executionTime = Date.now() - startExecutionTime
    const latency = Date.now() - startTime
    const executionSeconds = executionTime / 1000

    // Calcular custo: $0.05 por imagem gerada
    const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
    const cost = pricing.input * imageUrls.length // $0.05 por imagem

    // Construir resposta em formato de mensagem com imagens
    const modeText = isInpainting ? 'adicionado' : 'gerada'
    let content = `👤 **Variação${imageUrls.length > 1 ? 'ões' : ''} de personagem ${modeText}${imageUrls.length > 1 ? 's' : ''} com Ideogram Character!**\n\n`
    
    // Adicionar todas as imagens geradas
    imageUrls.forEach((url, index) => {
      if (imageUrls.length > 1) {
        content += `**Variação ${index + 1}:**\n`
      }
      content += `![Personagem ${modeText}](${url})\n\n`
    })
    
    content += `**Parâmetros:**\n`
    content += `- Modo: ${isInpainting ? 'Inpainting (adicionar a imagem existente)' : 'Geração de variações'}\n`
    content += `- Aspecto: ${aspect_ratio}\n`
    content += `- Variações: ${imageUrls.length}\n`
    
    if (style) {
      content += `- Estilo: ${style}\n`
    }
    
    content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
    content += `**Tempo de execução:** ${executionSeconds.toFixed(1)}s\n`
    content += `**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(2)}/imagem × ${imageUrls.length} imagem${imageUrls.length > 1 ? 's' : ''})`
    
    content += `\n\n*Ideogram Character mantém consistência visual do personagem através de diferentes cenas e contextos*`

    return {
      provider: 'Replicate',
      model,
      content,
      latency,
      cost,
      metadata: {
        aspect_ratio,
        num_outputs: imageUrls.length,
        imageUrls,
        executionTime: executionTime / 1000,
        isInpainting,
        style,
        hasReferenceImage: true,
      },
    }
  } catch (error: any) {
    console.error('[callIdeogramCharacter] Erro:', error)
    
    // Mensagens de erro específicas
    if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
      throw new Error('REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.')
    }
    
    if (error.message?.includes('referência') || error.message?.includes('reference') || error.message?.includes('imagem')) {
      throw new Error(`Erro com imagem de referência: ${error.message}`)
    }
    
    if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
      throw new Error(`Erro no prompt de geração de personagem: ${error.message}`)
    }
    
    throw new Error(`Erro ao gerar variações de personagem com Ideogram Character: ${error.message || error}`)
  }
}

async function callSeedanceVideo(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  try {
    // Modelos de vídeo não suportam streaming tradicional
    // Sempre usar modo não-stream para geração de vídeo
    if (stream) {
      // Retornar uma mensagem indicando que o vídeo está sendo gerado
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode('🎬 Gerando vídeo... Isso pode levar alguns minutos.\n\n'))
            controller.close()
          } catch (error: any) {
            controller.error(error)
          }
        },
      })

      return {
        provider: 'Replicate',
        model,
        content: '',
        latency: 0,
        cost: 0,
        stream: readable,
      }
    }

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para gerar vídeo')
    }

    const prompt = lastUserMessage.content

    // Gerar vídeo usando a função generateVideo
    const result = await generateVideo(prompt, {
      duration: 5, // Duração padrão de 5 segundos
      motion: 0.5, // Intensidade de movimento padrão
    })

    if (!result.success || !result.output) {
      throw new Error(result.error || 'Erro ao gerar vídeo')
    }

    const videoUrl = typeof result.output === 'string' ? result.output : result.output[0]

    // Construir resposta em formato de mensagem
    // Retornar URL do vídeo como conteúdo, que será exibido no chat
    const content = `🎬 Vídeo gerado com sucesso!\n\n[Assistir vídeo](${videoUrl})\n\n**Prompt:** ${prompt}\n\n**Tempo de processamento:** ${(result.processingTime || 0) / 1000}s\n**Custo estimado:** $${(result.cost || 0).toFixed(4)}`

    const latency = Date.now() - startTime
    const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
    const cost = result.cost || pricing.input

    return {
      provider: 'Replicate',
      model,
      content,
      latency,
      cost,
    }
  } catch (error: any) {
    console.error('[callSeedanceVideo] Erro:', error)
    throw new Error(`Erro ao gerar vídeo com Seedance: ${error.message || error}`)
  }
}

/**
 * Chama a API do Sora 2 da OpenAI para geração de vídeo
 */
async function callSora2(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  // Detectar se é Sora 2 Pro (usado em todo o escopo da função)
  const isPro = model === 'sora-2-pro'
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurado')
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Modelos de vídeo não suportam streaming tradicional
    // Retornar mensagem indicando que o vídeo está sendo gerado
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const modelName = isPro ? 'Sora 2 Pro' : 'Sora 2'
            controller.enqueue(encoder.encode(`🎬 Gerando vídeo com ${modelName}... Isso pode levar alguns minutos.\n\n`))
            controller.close()
          } catch (error: any) {
            controller.error(error)
          }
        },
      })

      return {
        provider: 'OpenAI',
        model,
        content: '',
        latency: 0,
        cost: 0,
        stream: readable,
      }
    }

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para gerar vídeo')
    }

    const prompt = lastUserMessage.content

    // Detectar parâmetros do prompt ou usar padrões inteligentes
    // Sora 2 Pro suporta até 12 segundos e resolução 1024p
    
    // Detectar resolução no prompt (1024p, 4K, alta resolução, etc.)
    const promptLower = prompt.toLowerCase()
    const wantsHighRes = isPro && (
      promptLower.includes('1024p') || 
      promptLower.includes('4k') || 
      promptLower.includes('alta resolução') ||
      promptLower.includes('high resolution') ||
      promptLower.includes('hd') ||
      promptLower.includes('full hd')
    )
    
    // Resolução padrão: 720p para Sora 2, 1024p para Sora 2 Pro (se mencionado)
    const resolution = wantsHighRes ? '1024p' : '720p'
    const size = resolution === '1024p' ? '1920x1080' : '1280x720'
    
    // Detectar duração desejada no prompt ou usar padrão
    const durationMatch = prompt.match(/(\d+)\s*(segundos?|seconds?|s)/i)
    let duration = durationMatch ? parseInt(durationMatch[1]) : (isPro ? 10 : 5)
    
    // Limites: Sora 2 Pro suporta até 12 segundos, Sora 2 padrão até 5 segundos
    if (isPro) {
      duration = Math.min(duration, 12)
      duration = Math.max(duration, 1)
    } else {
      duration = Math.min(duration, 5)
      duration = Math.max(duration, 1)
    }

    // Chamar a API do Sora 2
    // Documentação oficial: https://platform.openai.com/docs/models/sora-2-pro
    let response: any
    
    try {
      // Tentar usar a API de vídeos se disponível no SDK
      response = await (openai as any).videos?.generate?.({
        model: model,
        prompt: prompt,
        size: size,
        seconds: duration,
      })
    } catch (apiError: any) {
      // Se a API não existir ainda, usar fetch diretamente
      if (apiError.message?.includes('videos') || apiError.code === 'invalid_api_function') {
        const apiResponse = await fetch('https://api.openai.com/v1/videos/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            prompt: prompt,
            size: size,
            seconds: duration,
          }),
        })

        if (!apiResponse.ok) {
          const errorData = await apiResponse.json().catch(() => ({}))
          throw new Error(`API do Sora 2 Pro retornou erro: ${apiResponse.status} - ${errorData.error?.message || apiResponse.statusText}`)
        }

        response = await apiResponse.json()
      } else {
        throw apiError
      }
    }

    // O Sora 2 retorna um objeto com informações sobre o vídeo gerado
    // A estrutura pode variar - ajustar conforme documentação oficial
    const videoUrl = response?.video_url || response?.url || response?.output || response?.data?.[0]?.url
    
    if (!videoUrl) {
      console.warn('[callSora2] Estrutura de resposta inesperada:', response)
      throw new Error('URL do vídeo não retornada pela API. Verifique a estrutura da resposta.')
    }

    // Calcular custo baseado na duração e resolução do vídeo
    // Sora 2: $0.10/segundo (720p)
    // Sora 2 Pro: $0.30/segundo (720p) ou $0.50/segundo (1024p)
    const actualDuration = response?.duration || response?.seconds || duration
    let costPerSecond: number
    
    if (isPro) {
      costPerSecond = resolution === '1024p' ? 0.50 : 0.30
    } else {
      costPerSecond = 0.10
    }
    
    const cost = costPerSecond * actualDuration
    const latency = Date.now() - startTime

    // Construir resposta em formato de mensagem com informações detalhadas
    const modelName = isPro ? 'Sora 2 Pro' : 'Sora 2'
    const resolutionLabel = resolution === '1024p' ? 'Full HD (1024p)' : 'HD (720p)'
    
    const content = `🎬 Vídeo gerado com sucesso usando **${modelName}**!\n\n[Assistir vídeo](${videoUrl})\n\n**Prompt:** ${prompt}\n\n**Especificações:**\n- Duração: ${actualDuration}s\n- Resolução: ${resolutionLabel} (${size})\n- Tempo de processamento: ${(latency / 1000).toFixed(1)}s\n- Custo: $${cost.toFixed(2)} ($${costPerSecond.toFixed(2)}/segundo)`

    return {
      provider: 'OpenAI',
      model,
      content,
      latency,
      cost,
    }
  } catch (error: any) {
    console.error('[callSora2] Erro:', error)
    
    // Se a API não existir ainda ou retornar erro específico, fornecer mensagem útil
    if (error.message?.includes('videos') || error.code === 'invalid_api_function' || error.message?.includes('404')) {
      const docUrl = isPro 
        ? 'https://platform.openai.com/docs/models/sora-2-pro'
        : 'https://platform.openai.com/docs/models/sora-2'
      throw new Error(`API do ${isPro ? 'Sora 2 Pro' : 'Sora 2'} ainda não está disponível ou requer acesso especial. Verifique: ${docUrl}. Erro: ${error.message}`)
    }
    
    throw new Error(`Erro ao gerar vídeo com ${isPro ? 'Sora 2 Pro' : 'Sora 2'}: ${error.message || error}`)
  }
}

/**
 * Chama a API de geração de imagem GPT-Image-1 da OpenAI
 */
async function callImageGeneration(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurado')
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const isMini = model === 'gpt-image-1-mini'
    const modelName = isMini ? 'GPT-Image-1 Mini' : 'GPT-Image-1'

    // Modelos de imagem não suportam streaming tradicional
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`🖼️ Gerando imagem com ${modelName}... Isso pode levar alguns segundos.\n\n`))
            controller.close()
          } catch (error: any) {
            controller.error(error)
          }
        },
      })

      return {
        provider: 'OpenAI',
        model,
        content: '',
        latency: 0,
        cost: 0,
        stream: readable,
      }
    }

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para gerar imagem')
    }

    const prompt = lastUserMessage.content

    // Detectar resolução no prompt ou usar padrão
    const promptLower = prompt.toLowerCase()
    const wantsHighRes = promptLower.includes('1024x1024') || 
                         promptLower.includes('hd') || 
                         promptLower.includes('alta resolução') ||
                         promptLower.includes('high resolution') ||
                         promptLower.includes('4k')
    
    // Resoluções suportadas: 1024x1024 (padrão), 1792x1024, 1024x1792
    let size = '1024x1024'
    if (promptLower.includes('1792x1024') || promptLower.includes('landscape') || promptLower.includes('paisagem')) {
      size = '1792x1024'
    } else if (promptLower.includes('1024x1792') || promptLower.includes('portrait') || promptLower.includes('retrato')) {
      size = '1024x1792'
    } else if (wantsHighRes) {
      size = '1024x1024'
    }

    // Detectar qualidade ou usar padrão
    const quality = promptLower.includes('hd') || promptLower.includes('alta qualidade') || promptLower.includes('high quality')
      ? 'hd'
      : 'standard'

    // Detectar estilo ou usar padrão
    const style = promptLower.includes('vivid') || promptLower.includes('vivido')
      ? 'vivid'
      : promptLower.includes('natural') || promptLower.includes('natural')
      ? 'natural'
      : 'vivid' // Padrão vivid

    // Chamar a API de geração de imagens
    // Documentação oficial: https://platform.openai.com/docs/models/gpt-image-1
    let response: any
    
    try {
      // Tentar usar a API de imagens se disponível no SDK
      response = await (openai as any).images?.generate?.({
        model: model,
        prompt: prompt,
        size: size,
        quality: quality,
        style: style,
        n: 1, // Gerar 1 imagem por padrão
      })
    } catch (sdkError: any) {
      // Se o SDK não suportar, usar fetch diretamente
      console.log('[callImageGeneration] SDK não suporta, usando fetch direto')
      
      const apiResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          size: size,
          quality: quality,
          style: style,
          n: 1,
        }),
      })

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `API retornou erro: ${apiResponse.status}`)
      }

      response = await apiResponse.json()
    }

    // Extrair URL da imagem gerada
    const imageUrl = response?.data?.[0]?.url || response?.data?.[0]?.b64_json
    
    if (!imageUrl) {
      throw new Error('Resposta da API não contém URL de imagem')
    }

    // Calcular custo: $0.04 por imagem (GPT-Image-1) ou $0.02 (GPT-Image-1 Mini)
    const pricing = MODEL_PRICING[`openai:${model}`] || DEFAULT_PRICING
    const cost = pricing.input

    const latency = Date.now() - startTime

    // Construir resposta em formato de mensagem com imagem
    let content = `🖼️ **Imagem gerada com ${modelName}!**\n\n`
    
    // Se é base64, converter para data URL
    if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
      content += `![Imagem gerada](${imageUrl})\n\n`
    } else {
      content += `![Imagem gerada](${imageUrl})\n\n`
    }
    
    content += `**Parâmetros:**\n`
    content += `- Resolução: ${size}\n`
    content += `- Qualidade: ${quality}\n`
    content += `- Estilo: ${style}\n`
    content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(2)}/imagem)`

    return {
      provider: 'OpenAI',
      model,
      content,
      latency,
      cost,
      metadata: {
        size,
        quality,
        style,
        imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
      },
    }
  } catch (error: any) {
    console.error('[callImageGeneration] Erro:', error)
    
    // Mensagens de erro específicas
    if (error.message?.includes('images') || error.code === 'invalid_api_function' || error.message?.includes('404')) {
      const docUrl = isMini 
        ? 'https://platform.openai.com/docs/models/gpt-image-1-mini'
        : 'https://platform.openai.com/docs/models/gpt-image-1'
      throw new Error(`API do ${modelName} ainda não está disponível ou requer acesso especial. Verifique: ${docUrl}. Erro: ${error.message}`)
    }
    
    if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
      throw new Error(`Erro no prompt de geração de imagem: ${error.message}`)
    }
    
    throw new Error(`Erro ao gerar imagem com ${modelName}: ${error.message || error}`)
  }
}

/**
 * Chama a API de transcrição de áudio GPT-4o Mini Transcribe da OpenAI
 */
async function callTranscribe(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurado')
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Modelos de transcrição não suportam streaming tradicional
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode('🎤 Transcrevendo áudio... Isso pode levar alguns segundos.\n\n'))
            controller.close()
          } catch (error: any) {
            controller.error(error)
          }
        },
      })

      return {
        provider: 'OpenAI',
        model,
        content: '',
        latency: 0,
        cost: 0,
        stream: readable,
      }
    }

    // Buscar arquivo de áudio nas mensagens ou attachments
    // O formato pode ser: URL do arquivo ou base64 data URL
    let audioFile: string | File | null = null
    let audioUrl: string | null = null

    // Primeiro, verificar se há attachments na última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (lastUserMessage) {
      const msgAny = lastUserMessage as any
      
      // Verificar se há attachments diretamente na mensagem
      if (msgAny.attachments && Array.isArray(msgAny.attachments)) {
        const audioAttachment = msgAny.attachments.find((a: any) => a.type === 'audio')
        if (audioAttachment?.url) {
          audioUrl = audioAttachment.url
        }
      }
      
      // Se não encontrou, verificar no conteúdo da mensagem
      if (!audioUrl && !audioFile) {
        const content = String(lastUserMessage.content || '')
        
        // Verificar se há URL de áudio no conteúdo (formato markdown)
        const audioUrlMatch = content.match(/\[.*?\]\((https?:\/\/[^\)]+\.(mp3|wav|m4a|ogg|webm|flac|mpeg))\)/i)
        if (audioUrlMatch) {
          audioUrl = audioUrlMatch[1]
        }
        
        // Verificar se há URL direta de áudio
        if (!audioUrl) {
          const directUrlMatch = content.match(/(https?:\/\/[^\s]+\.(mp3|wav|m4a|ogg|webm|flac|mpeg))/i)
          if (directUrlMatch) {
            audioUrl = directUrlMatch[1]
          }
        }

        // Verificar se há data URL de áudio (base64)
        if (!audioUrl && !audioFile && content.includes('data:audio/')) {
          const dataUrlMatch = content.match(/data:audio\/[^;]+;base64,([^\s]+)/i)
          if (dataUrlMatch) {
            audioFile = dataUrlMatch[0]
          }
        }
      }
    }

    if (!audioUrl && !audioFile) {
      throw new Error('Nenhum arquivo de áudio encontrado para transcrição. Por favor, anexe um arquivo de áudio.')
    }

    // Se temos URL, fazer download do arquivo
    let audioBuffer: Buffer | File
    if (audioUrl) {
      try {
        const response = await fetch(audioUrl)
        if (!response.ok) {
          throw new Error(`Erro ao baixar arquivo de áudio: ${response.statusText}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        audioBuffer = Buffer.from(arrayBuffer)
      } catch (fetchError: any) {
        throw new Error(`Erro ao acessar arquivo de áudio: ${fetchError.message}`)
      }
    } else if (audioFile && typeof audioFile === 'string' && audioFile.startsWith('data:')) {
      // Converter data URL para buffer
      const base64Data = audioFile.split(',')[1]
      audioBuffer = Buffer.from(base64Data, 'base64')
    } else {
      throw new Error('Formato de arquivo de áudio não suportado')
    }

    // Criar File object para a API da OpenAI
    // A API espera um File object ou FormData
    const audioFileObj = audioBuffer instanceof File 
      ? audioBuffer 
      : new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' })

    // Chamar a API de transcrição
    // Documentação oficial: https://platform.openai.com/docs/models/gpt-4o-mini-transcribe
    const transcription = await openai.audio.transcriptions.create({
      file: audioFileObj,
      model: model, // 'gpt-4o-mini-transcribe'
      language: 'pt', // Detectar idioma ou usar padrão português
      response_format: 'verbose_json', // Retornar JSON com metadados
    })

    // Extrair texto transcrito
    const transcribedText = typeof transcription === 'string' 
      ? transcription 
      : (transcription as any).text || (transcription as any).transcription || ''

    if (!transcribedText) {
      throw new Error('Transcrição retornou vazio. Verifique o arquivo de áudio.')
    }

    // Calcular custo baseado na duração do áudio
    // GPT-4o Mini Transcribe: $0.15 por minuto
    // GPT-4o Transcribe: $0.30 por minuto
    // GPT-4o Transcribe Diarize: $0.45 por minuto
    const duration = (transcription as any).duration || (transcription as any).audio_duration || 0
    const durationMinutes = duration > 0 ? duration / 60 : 0.5 // Estimativa se não disponível
    const pricing = MODEL_PRICING[`openai:${model}`] || DEFAULT_PRICING
    const cost = pricing.input * durationMinutes

    const latency = Date.now() - startTime
    const isDiarize = model === 'gpt-4o-transcribe-diarize'
    const isPro = model === 'gpt-4o-transcribe' || isDiarize
    const modelName = isDiarize 
      ? 'GPT-4o Transcribe Diarize' 
      : isPro 
      ? 'GPT-4o Transcribe' 
      : 'GPT-4o Mini Transcribe'

    // Construir resposta em formato de mensagem
    const metadata = typeof transcription === 'object' && transcription !== null
      ? {
          duration: (transcription as any).duration,
          language: (transcription as any).language,
          segments: (transcription as any).segments,
          speakers: (transcription as any).speakers || (transcription as any).diarization?.speakers,
        }
      : null

    // Processar diarização se disponível
    let formattedText = transcribedText
    if (isDiarize && metadata?.segments && Array.isArray(metadata.segments)) {
      // Formatar texto com identificação de falantes
      const segmentsWithSpeakers = metadata.segments.filter((seg: any) => seg.speaker !== undefined && seg.speaker !== null)
      
      if (segmentsWithSpeakers.length > 0) {
        formattedText = segmentsWithSpeakers
          .map((seg: any) => {
            const speakerLabel = seg.speaker !== undefined && seg.speaker !== null 
              ? `**Falante ${seg.speaker}:**` 
              : '**Falante desconhecido:**'
            const startTime = seg.start !== undefined ? formatTime(seg.start) : ''
            const endTime = seg.end !== undefined ? formatTime(seg.end) : ''
            const timeRange = startTime && endTime ? ` [${startTime} - ${endTime}]` : ''
            return `${speakerLabel}${timeRange}\n${seg.text || seg.transcription || ''}`
          })
          .join('\n\n')
      }
    }

    let content = `🎤 **Transcrição de áudio concluída usando ${modelName}!**\n\n${formattedText}\n\n`
    
    if (metadata) {
      content += `**Metadados:**\n`
      if (metadata.duration) {
        content += `- Duração: ${metadata.duration.toFixed(1)}s (${durationMinutes.toFixed(2)} min)\n`
      }
      if (metadata.language) {
        content += `- Idioma detectado: ${metadata.language}\n`
      }
      if (isPro && metadata.segments && Array.isArray(metadata.segments)) {
        content += `- Segmentos: ${metadata.segments.length}\n`
      }
      if (isDiarize && metadata.speakers) {
        const speakerCount = Array.isArray(metadata.speakers) 
          ? metadata.speakers.length 
          : typeof metadata.speakers === 'number' 
          ? metadata.speakers 
          : 0
        if (speakerCount > 0) {
          content += `- Falantes identificados: ${speakerCount}\n`
        }
      }
    }
    
    content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(2)}/minuto)`
    
    if (isDiarize) {
      content += `\n\n*Usando GPT-4o Transcribe Diarize para identificar falantes em conversas com múltiplos participantes*`
    } else if (isPro) {
      content += `\n\n*Usando GPT-4o Transcribe para máxima precisão e suporte a múltiplos idiomas*`
    }

    return {
      provider: 'OpenAI',
      model,
      content,
      latency,
      cost,
      metadata: metadata || undefined,
    }
  } catch (error: any) {
    console.error('[callTranscribe] Erro:', error)
    
    // Mensagens de erro específicas
    if (error.message?.includes('audio') || error.message?.includes('transcription')) {
      throw new Error(`Erro ao transcrever áudio: ${error.message}`)
    }
    
    if (error.message?.includes('file') || error.message?.includes('arquivo')) {
      throw new Error(`Erro ao processar arquivo de áudio: ${error.message}`)
    }
    
    const modelName = model === 'gpt-4o-transcribe-diarize' 
      ? 'GPT-4o Transcribe Diarize' 
      : model === 'gpt-4o-transcribe' 
      ? 'GPT-4o Transcribe' 
      : 'GPT-4o Mini Transcribe'
    throw new Error(`Erro ao transcrever áudio com ${modelName}: ${error.message || error}`)
  }
}

/**
 * Chama a API do PubMed via NCBI E-utilities para busca de artigos científicos
 */
async function callPubMed(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  try {
    if (!process.env.PUBMED_API_KEY) {
      throw new Error('PUBMED_API_KEY não configurado')
    }

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para buscar no PubMed')
    }

    const searchQuery = lastUserMessage.content.trim()
    
    if (!searchQuery) {
      throw new Error('Query de busca vazia')
    }

    // PubMed não suporta streaming tradicional - retornar mensagem informativa se solicitado
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode('🔬 Buscando artigos científicos no PubMed... Isso pode levar alguns segundos.\n\n'))
            controller.close()
          } catch (error: any) {
            controller.error(error)
          }
        },
      })

      return {
        provider: 'PubMed',
        model,
        content: '',
        latency: 0,
        cost: 0,
        stream: readable,
      }
    }

    // Buscar artigos no PubMed usando E-utilities
    // Passo 1: ESearch - buscar IDs dos artigos
    const esearchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi')
    esearchUrl.searchParams.set('db', 'pubmed')
    esearchUrl.searchParams.set('term', searchQuery)
    esearchUrl.searchParams.set('retmax', '10') // Limitar a 10 resultados
    esearchUrl.searchParams.set('retmode', 'json')
    esearchUrl.searchParams.set('api_key', process.env.PUBMED_API_KEY)

    const esearchStartTime = Date.now()
    const esearchResponse = await fetch(esearchUrl.toString())
    
    if (!esearchResponse.ok) {
      throw new Error(`Erro na busca PubMed: ${esearchResponse.statusText}`)
    }

    const esearchData = await esearchResponse.json()
    const pmids = esearchData.esearchresult?.idlist || []

    if (pmids.length === 0) {
      return {
        provider: 'PubMed',
        model,
        content: `🔬 **Busca no PubMed concluída**\n\n**Query:** "${searchQuery}"\n\n**Resultados:** Nenhum artigo encontrado para esta busca.\n\n*Tente refinar sua busca com termos mais específicos ou sinônimos.*`,
        latency: Date.now() - startTime,
        cost: 0,
      }
    }

    // Passo 2: EFetch - recuperar detalhes dos artigos
    const efetchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi')
    efetchUrl.searchParams.set('db', 'pubmed')
    efetchUrl.searchParams.set('id', pmids.join(','))
    efetchUrl.searchParams.set('retmode', 'xml')
    efetchUrl.searchParams.set('rettype', 'abstract')
    efetchUrl.searchParams.set('api_key', process.env.PUBMED_API_KEY)

    const efetchResponse = await fetch(efetchUrl.toString())
    
    if (!efetchResponse.ok) {
      throw new Error(`Erro ao recuperar artigos PubMed: ${efetchResponse.statusText}`)
    }

    const xmlData = await efetchResponse.text()
    const executionTime = Date.now() - esearchStartTime
    const latency = Date.now() - startTime

    // Parsear XML básico (simplificado - em produção usar biblioteca XML)
    const articles = parsePubMedXML(xmlData)

    // Construir resposta formatada
    let content = `🔬 **Busca no PubMed concluída**\n\n`
    content += `**Query:** "${searchQuery}"\n\n`
    content += `**Artigos encontrados:** ${articles.length}\n\n`

    articles.forEach((article, index) => {
      content += `### ${index + 1}. ${article.title || 'Sem título'}\n\n`
      
      if (article.authors && article.authors.length > 0) {
        const authorsList = article.authors.slice(0, 5).join(', ')
        const moreAuthors = article.authors.length > 5 ? ` et al.` : ''
        content += `**Autores:** ${authorsList}${moreAuthors}\n\n`
      }
      
      if (article.journal) {
        content += `**Revista:** ${article.journal}`
        if (article.publicationDate) {
          content += ` (${article.publicationDate})`
        }
        content += `\n\n`
      }
      
      if (article.pmid) {
        content += `**PMID:** [${article.pmid}](https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/)\n\n`
      }
      
      if (article.abstract) {
        const abstractPreview = article.abstract.length > 300 
          ? article.abstract.substring(0, 300) + '...' 
          : article.abstract
        content += `**Resumo:** ${abstractPreview}\n\n`
      }
      
      content += `---\n\n`
    })

    content += `\n**Tempo de busca:** ${(latency / 1000).toFixed(1)}s\n`
    content += `**Custo:** Gratuito (NCBI E-utilities)\n\n`
    content += `*Para mais detalhes, clique nos links PMID acima.*`

    return {
      provider: 'PubMed',
      model,
      content,
      latency,
      cost: 0,
      metadata: {
        query: searchQuery,
        articlesFound: articles.length,
        pmids,
        executionTime: executionTime / 1000,
      },
    }
  } catch (error: any) {
    console.error('[callPubMed] Erro:', error)
    
    // Mensagens de erro específicas
    if (error.message?.includes('PUBMED_API_KEY') || error.message?.includes('api_key')) {
      throw new Error('PUBMED_API_KEY não configurado. Configure a variável de ambiente.')
    }
    
    if (error.message?.includes('busca') || error.message?.includes('search')) {
      throw new Error(`Erro na busca PubMed: ${error.message}`)
    }
    
    throw new Error(`Erro ao buscar artigos no PubMed: ${error.message || error}`)
  }
}

/**
 * Parseia XML do PubMed (simplificado)
 */
function parsePubMedXML(xml: string): Array<{
  pmid?: string
  title?: string
  authors?: string[]
  journal?: string
  publicationDate?: string
  abstract?: string
}> {
  const articles: Array<{
    pmid?: string
    title?: string
    authors?: string[]
    journal?: string
    publicationDate?: string
    abstract?: string
  }> = []

  try {
    // Dividir XML em artigos individuais usando <PubmedArticle>
    const articleMatches = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || []
    
    articleMatches.forEach((articleXml, index) => {
      const article: {
        pmid?: string
        title?: string
        authors?: string[]
        journal?: string
        publicationDate?: string
        abstract?: string
      } = {}

      // Extrair PMID
      const pmidMatch = articleXml.match(/<PMID[^>]*>(\d+)<\/PMID>/)
      if (pmidMatch) {
        article.pmid = pmidMatch[1]
      }

      // Extrair título
      const titleMatch = articleXml.match(/<ArticleTitle[^>]*>(.*?)<\/ArticleTitle>/)
      if (titleMatch) {
        article.title = titleMatch[1].replace(/<[^>]+>/g, '').trim()
      }

      // Extrair autores
      const authorMatches = articleXml.match(/<Author[^>]*>[\s\S]*?<\/Author>/g) || []
      article.authors = []
      
      authorMatches.forEach(authorMatch => {
        const lastNameMatch = authorMatch.match(/<LastName>(.*?)<\/LastName>/)?.[1]
        const firstNameMatch = authorMatch.match(/<FirstName>(.*?)<\/FirstName>/)?.[1]
        const initialsMatch = authorMatch.match(/<Initials>(.*?)<\/Initials>/)?.[1]
        
        if (lastNameMatch) {
          const authorName = firstNameMatch 
            ? `${firstNameMatch} ${lastNameMatch}`
            : initialsMatch
            ? `${initialsMatch} ${lastNameMatch}`
            : lastNameMatch
          article.authors.push(authorName)
        }
      })

      // Extrair revista (pode estar em diferentes locais no XML)
      const journalTitleMatch = articleXml.match(/<Journal>[\s\S]*?<Title>(.*?)<\/Title>[\s\S]*?<\/Journal>/)
      if (journalTitleMatch) {
        article.journal = journalTitleMatch[1].replace(/<[^>]+>/g, '').trim()
      } else {
        // Fallback: buscar qualquer <Title> dentro de <Journal>
        const journalMatch = articleXml.match(/<Journal>[\s\S]*?<\/Journal>/)
        if (journalMatch) {
          const titleInJournal = journalMatch[0].match(/<Title>(.*?)<\/Title>/)
          if (titleInJournal) {
            article.journal = titleInJournal[1].replace(/<[^>]+>/g, '').trim()
          }
        }
      }

      // Extrair data de publicação
      const pubDateMatch = articleXml.match(/<PubDate[^>]*>[\s\S]*?<\/PubDate>/)
      if (pubDateMatch) {
        const yearMatch = pubDateMatch[0].match(/<Year>(\d+)<\/Year>/)?.[1]
        const monthMatch = pubDateMatch[0].match(/<Month>(\d+)<\/Month>/)?.[1]
        const dayMatch = pubDateMatch[0].match(/<Day>(\d+)<\/Day>/)?.[1]
        
        if (yearMatch) {
          article.publicationDate = monthMatch && dayMatch 
            ? `${dayMatch}/${monthMatch}/${yearMatch}`
            : monthMatch
            ? `${monthMatch}/${yearMatch}`
            : yearMatch
        }
      }

      // Extrair resumo
      const abstractMatches = articleXml.match(/<AbstractText[^>]*>(.*?)<\/AbstractText>/g) || []
      if (abstractMatches.length > 0) {
        article.abstract = abstractMatches
          .map(m => {
            const match = m.match(/<AbstractText[^>]*>(.*?)<\/AbstractText>/)?.[1]
            return match ? match.replace(/<[^>]+>/g, '').trim() : ''
          })
          .filter(Boolean)
          .join(' ')
      }

      if (article.pmid || article.title) {
        articles.push(article)
      }
    })
  } catch (error) {
    console.error('[parsePubMedXML] Erro ao parsear XML:', error)
  }

  return articles
}
