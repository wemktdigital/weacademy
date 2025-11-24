import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import Replicate from 'replicate'
import { createClient } from '@supabase/supabase-js'
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
  conversationId?: string  // ID da conversa (para operações assíncronas)
  messageId?: string  // ID da mensagem (para operações assíncronas)
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

/**
 * Helper function para extrair URL de um FileOutput object do Replicate
 * Processa o resultado do Replicate e extrai URLs de imagens
 * Lida com diferentes formatos de resposta: arrays, strings, objetos, iteradores assíncronos, FileOutput objects
 */
async function extractUrlFromFileOutput(item: any): Promise<string | null> {
  // Verificar se é FileOutput com método url() (JavaScript SDK)
  if (item && typeof item === 'object') {
    // Verificar se tem método url() (FileOutput do Replicate JavaScript SDK)
    if (typeof item.url === 'function') {
      try {
        const urlResult = await item.url()
        console.log(`[extractUrlFromFileOutput] Resultado de url():`, { type: typeof urlResult, constructor: urlResult?.constructor?.name })
        
        // O Replicate pode retornar um objeto URL (com propriedade href) ou uma string
        let urlString: string | null = null
        
        if (typeof urlResult === 'string' && (urlResult.startsWith('http://') || urlResult.startsWith('https://'))) {
          urlString = urlResult
          console.log(`[extractUrlFromFileOutput] URL string extraída:`, urlString)
        } else if (urlResult && typeof urlResult === 'object') {
          // Pode ser um objeto URL com propriedade href
          if (urlResult.href && typeof urlResult.href === 'string') {
            urlString = urlResult.href
            console.log(`[extractUrlFromFileOutput] URL extraída de objeto URL (href):`, urlString)
          } else if (urlResult.toString && typeof urlResult.toString === 'function') {
            // Tentar toString() como fallback
            const str = urlResult.toString()
            if (typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'))) {
              urlString = str
              console.log(`[extractUrlFromFileOutput] URL extraída via toString():`, urlString)
            }
          }
        }
        
        if (urlString) {
          return urlString
        } else {
          console.warn(`[extractUrlFromFileOutput] Não foi possível extrair URL válida de:`, { type: typeof urlResult, value: urlResult })
        }
      } catch (error) {
        console.warn(`[extractUrlFromFileOutput] Erro ao chamar item.url():`, error)
      }
    }
    
    // Verificar se é Response-like object (tem propriedade url como string)
    if (item.url && typeof item.url === 'string' && (item.url.startsWith('http://') || item.url.startsWith('https://'))) {
      console.log(`[extractUrlFromFileOutput] URL encontrada em propriedade url:`, item.url)
      return item.url
    }
    
    // Verificar se é um objeto com propriedade toString que retorna URL
    if (item.toString && typeof item.toString === 'function') {
      try {
        const str = item.toString()
        if (typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'))) {
          console.log(`[extractUrlFromFileOutput] URL encontrada via toString():`, str)
          return str
        }
      } catch (error) {
        // Ignorar erros de toString
      }
    }
    
    // Verificar outras propriedades comuns
    const possibleProps = ['image', 'image_url', 'output', 'src', 'href', 'data', 'file', 'file_url']
    for (const prop of possibleProps) {
      const value = item[prop]
      if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
        console.log(`[extractUrlFromFileOutput] URL encontrada em propriedade ${prop}:`, value)
        return value
      }
      // Se a propriedade é um objeto, tentar extrair URL dele recursivamente
      if (value && typeof value === 'object' && typeof value.url === 'function') {
        try {
          const nestedUrlResult = await value.url()
          let nestedUrlString: string | null = null
          
          if (typeof nestedUrlResult === 'string' && (nestedUrlResult.startsWith('http://') || nestedUrlResult.startsWith('https://'))) {
            nestedUrlString = nestedUrlResult
          } else if (nestedUrlResult && typeof nestedUrlResult === 'object' && nestedUrlResult.href) {
            nestedUrlString = nestedUrlResult.href
          }
          
          if (nestedUrlString) {
            console.log(`[extractUrlFromFileOutput] URL encontrada em propriedade ${prop} (nested FileOutput):`, nestedUrlString)
            return nestedUrlString
          }
        } catch (error) {
          // Ignorar erros
        }
      }
    }
    
    // Última tentativa: verificar todas as propriedades string do objeto
    for (const key in item) {
      const value = item[key]
      if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
        console.log(`[extractUrlFromFileOutput] URL encontrada em propriedade genérica '${key}':`, value)
        return value
      }
    }
  }
  
  return null
}

async function extractImageUrlsFromReplicate(result: any, modelName: string): Promise<string[]> {
  console.log(`[extractImageUrls] Processando resultado do Replicate para ${modelName}:`, {
    type: typeof result,
    isArray: Array.isArray(result),
    isAsyncIterator: result && typeof result === 'object' && typeof (result as any)[Symbol.asyncIterator] === 'function',
    hasUrlMethod: result && typeof result === 'object' && typeof (result as any).url === 'function',
    result: result,
  })
  
  let output: any = result
  
  // IMPORTANTE: Se é um FileOutput (tem método url()), chamar url() diretamente ANTES de tentar iterar
  // O FileOutput é um iterador assíncrono, mas iterar sobre ele retorna chunks de dados, não URLs
  if (result && typeof result === 'object' && typeof (result as any).url === 'function') {
    console.log(`[extractImageUrls] Detectado FileOutput com método url(), chamando diretamente...`)
    try {
      const urlResult = await (result as any).url()
      console.log(`[extractImageUrls] Resultado de url() do FileOutput:`, { type: typeof urlResult, constructor: urlResult?.constructor?.name })
      
      let urlString: string | null = null
      if (typeof urlResult === 'string' && (urlResult.startsWith('http://') || urlResult.startsWith('https://'))) {
        urlString = urlResult
      } else if (urlResult && typeof urlResult === 'object' && urlResult.href) {
        urlString = urlResult.href
      } else if (urlResult && typeof urlResult === 'object' && urlResult.toString) {
        const str = urlResult.toString()
        if (typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'))) {
          urlString = str
        }
      }
      
      if (urlString) {
        console.log(`[extractImageUrls] ✅ URL extraída diretamente do FileOutput:`, urlString)
        return [urlString]
      }
    } catch (error: any) {
      console.warn(`[extractImageUrls] Erro ao chamar url() do FileOutput:`, error.message)
      // Continuar com processamento normal se falhar
    }
  }
  
  // Se é um iterador assíncrono (mas não FileOutput com url()), coletar valores
  // Isso pode acontecer se o resultado for um array de FileOutput objects
  if (result && typeof result === 'object' && typeof (result as any)[Symbol.asyncIterator] === 'function') {
    console.log(`[extractImageUrls] Processando iterador assíncrono para ${modelName}...`)
    const values: any[] = []
    const urls: string[] = []
    
    for await (const value of result as any) {
      console.log(`[extractImageUrls] Valor recebido do iterador:`, { 
        type: typeof value, 
        isArray: Array.isArray(value),
        hasUrlMethod: value && typeof value === 'object' && typeof value.url === 'function',
        value: value 
      })
      
      // Se o valor é um FileOutput, extrair URL imediatamente
      if (value && typeof value === 'object') {
        const extractedUrl = await extractUrlFromFileOutput(value)
        if (extractedUrl) {
          urls.push(extractedUrl)
          console.log(`[extractImageUrls] URL extraída do FileOutput no iterador:`, extractedUrl)
        } else {
          values.push(value)
        }
      } else if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
        urls.push(value)
        console.log(`[extractImageUrls] URL string encontrada no iterador:`, value)
      } else {
        values.push(value)
      }
    }
    
    console.log(`[extractImageUrls] URLs coletadas do iterador:`, urls)
    console.log(`[extractImageUrls] Valores coletados do iterador:`, values)
    
    // Se encontramos URLs diretamente no iterador, retornar
    if (urls.length > 0) {
      console.log(`[extractImageUrls] Retornando URLs extraídas do iterador:`, urls)
      return urls
    }
    
    // Caso contrário, usar o último valor ou todos os valores
    output = values.length > 0 ? values[values.length - 1] : values[0]
    console.log(`[extractImageUrls] Output final do iterador:`, output)
  }
  
  console.log(`[extractImageUrls] Iniciando extração de URLs. Output:`, {
    type: typeof output,
    isArray: Array.isArray(output),
    output: output,
    keys: output && typeof output === 'object' ? Object.keys(output) : null,
  })
  
  let imageUrls: string[] = []
  
  if (Array.isArray(output)) {
    console.log(`[extractImageUrls] Output é array, processando ${output.length} itens...`)
    
    // Filtrar valores null/undefined
    const validItems = output.filter(item => item !== null && item !== undefined)
    console.log(`[extractImageUrls] Itens válidos após filtro: ${validItems.length} de ${output.length}`)
    
    if (validItems.length === 0) {
      console.warn(`[extractImageUrls] Array vazio ou contém apenas null/undefined`)
      return []
    }
    
    // Processar cada item do array de forma assíncrona
    const urlPromises = validItems.map(async (item: any, i: number) => {
      console.log(`[extractImageUrls] Processando item ${i}:`, { 
        type: typeof item, 
        isObject: typeof item === 'object',
        isNull: item === null,
        isUndefined: item === undefined,
        hasUrlMethod: item && typeof item === 'object' && typeof item.url === 'function',
        hasUrlProperty: item && typeof item === 'object' && typeof item.url === 'string',
        constructor: item?.constructor?.name,
        keys: item && typeof item === 'object' ? Object.keys(item) : null,
        item: item 
      })
      
      if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
        console.log(`[extractImageUrls] URL string encontrada no item ${i}:`, item)
        return item
      } else if (item && typeof item === 'object') {
        // Tentar extrair URL de FileOutput object
        const extractedUrl = await extractUrlFromFileOutput(item)
        if (extractedUrl) {
          console.log(`[extractImageUrls] URL extraída do FileOutput no item ${i}:`, extractedUrl)
          return extractedUrl
        } else {
          // Fallback: procurar propriedades diretas
          const url = item.url || item.image || item.image_url || item.output || item.src || item.href
          if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
            console.log(`[extractImageUrls] URL encontrada em propriedade do item ${i}:`, url)
            return url
          }
          // Se ainda não encontrou, tentar converter para string e verificar
          if (item.toString && typeof item.toString === 'function') {
            const str = item.toString()
            if (str && typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'))) {
              console.log(`[extractImageUrls] URL encontrada via toString() no item ${i}:`, str)
              return str
            }
          }
        }
      }
      return null
    })
    
    const extractedUrls = await Promise.all(urlPromises)
    imageUrls = extractedUrls.filter((url): url is string => url !== null && typeof url === 'string')
    
    console.log(`[extractImageUrls] URLs extraídas do array:`, imageUrls)
  } else if (typeof output === 'string' && (output.startsWith('http://') || output.startsWith('https://'))) {
    console.log(`[extractImageUrls] Output é string URL direta`)
    imageUrls = [output]
  } else if (output && typeof output === 'object') {
    console.log(`[extractImageUrls] Output é objeto, verificando propriedades...`)
    console.log(`[extractImageUrls] Constructor:`, output.constructor?.name)
    console.log(`[extractImageUrls] Tem método url:`, typeof (output as any).url === 'function')
    console.log(`[extractImageUrls] É async iterator:`, typeof (output as any)[Symbol.asyncIterator] === 'function')
    
    // Tentar extrair como FileOutput usando função auxiliar (já verificamos no início se é FileOutput direto)
    const extractedUrl = await extractUrlFromFileOutput(output)
    if (extractedUrl) {
      imageUrls = [extractedUrl]
      console.log(`[extractImageUrls] URL extraída do FileOutput via função auxiliar:`, extractedUrl)
    } else {
      // Fallback: procurar em propriedades comuns
      console.log(`[extractImageUrls] Não é FileOutput, procurando URLs em propriedades...`)
      const possibleUrlProperties = ['output', 'urls', 'images', 'url', 'image', 'image_url', 'data', 'result']
      
      for (const prop of possibleUrlProperties) {
        const value = (output as any)[prop]
        console.log(`[extractImageUrls] Verificando propriedade '${prop}':`, { 
          type: typeof value,
          isArray: Array.isArray(value),
          hasUrlMethod: value && typeof value === 'object' && typeof value.url === 'function',
          value: value 
        })
        
        if (Array.isArray(value)) {
          // Processar array de FileOutput objects
          const found: string[] = []
          for (const item of value) {
            if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
              found.push(item)
            } else if (item && typeof item === 'object') {
              const itemUrl = await extractUrlFromFileOutput(item)
              if (itemUrl) {
                found.push(itemUrl)
              } else {
                const fallbackUrl = item.url || item.image || item.image_url || item.output
                if (typeof fallbackUrl === 'string' && (fallbackUrl.startsWith('http://') || fallbackUrl.startsWith('https://'))) {
                  found.push(fallbackUrl)
                }
              }
            }
          }
          if (found.length > 0) {
            imageUrls = found
            console.log(`[extractImageUrls] URLs encontradas em '${prop}':`, imageUrls)
            break
          }
        } else if (value && typeof value === 'object' && typeof value.url === 'function') {
          // É um FileOutput object
          const url = await extractUrlFromFileOutput(value)
          if (url) {
            imageUrls = [url]
            console.log(`[extractImageUrls] URL encontrada em FileOutput da propriedade '${prop}':`, url)
            break
          }
        } else if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
          imageUrls = [value]
          console.log(`[extractImageUrls] URL encontrada em '${prop}':`, value)
          break
        }
      }
      
      // Se ainda não encontrou, tentar extrair URLs de qualquer propriedade string
      if (imageUrls.length === 0) {
        console.log(`[extractImageUrls] Tentando extrair URLs de todas as propriedades string...`)
        for (const key in output) {
          const value = (output as any)[key]
          if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
            imageUrls.push(value)
            console.log(`[extractImageUrls] URL encontrada em propriedade '${key}':`, value)
          }
        }
      }
    }
  }
  
  console.log(`[extractImageUrls] URLs finais extraídas para ${modelName}:`, imageUrls)
  
  if (imageUrls.length === 0) {
    console.error(`[extractImageUrls] NENHUMA URL encontrada para ${modelName}!`)
    console.error(`[extractImageUrls] Tipo do output:`, typeof output)
    console.error(`[extractImageUrls] É array:`, Array.isArray(output))
    console.error(`[extractImageUrls] Chaves do objeto:`, output && typeof output === 'object' ? Object.keys(output) : 'N/A')
    console.error(`[extractImageUrls] Resposta completa do Replicate:`, JSON.stringify(output, null, 2))
    
    // Tentar logar estrutura completa do objeto (incluindo métodos)
    if (output && typeof output === 'object') {
      console.error(`[extractImageUrls] Estrutura completa do objeto:`, {
        constructor: output.constructor?.name,
        prototype: Object.getPrototypeOf(output),
        methods: Object.getOwnPropertyNames(output).filter(name => typeof (output as any)[name] === 'function'),
        properties: Object.keys(output),
      })
    }
  }
  
  return imageUrls
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
  conversationId,
  messageId,
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
      const result = await callModel(modelToTry.provider, modelToTry.model, sanitizedMessages, stream, startTime, userId, conversationId, messageId)
      
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
  startTime: number,
  userId?: string,
  conversationId?: string,
  messageId?: string
): Promise<LLMResponse> {
  switch (provider.toLowerCase()) {
    case 'openai':
      return await callOpenAI(model, messages, stream, startTime)
    
    case 'google':
      // VEO 3.1 é um modelo de geração de vídeo, precisa de tratamento especial
      if (model.includes('veo')) {
        return await callVeo(model, messages, stream, startTime, userId, conversationId, messageId)
      }
      // Nano Banana (gemini-2.5-flash-image) é um modelo de geração de imagens
      if (model === 'gemini-2.5-flash-image') {
        return await callGeminiImage(model, messages, stream, startTime)
      }
      // Lyria RealTime é um modelo de geração de música em tempo real
      if (model === 'lyria-realtime-exp') {
        return await callLyria(model, messages, stream, startTime)
      }
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
    
    // Detectar se é Gemini 3 Pro e configurar thinking_level
    const isGemini3High = model === 'gemini-3-pro-preview-high'
    const isGemini3Low = model === 'gemini-3-pro-preview-low'
    const isGemini3 = isGemini3High || isGemini3Low
    
    // Mapear nome interno para nome real da API
    const apiModelName = isGemini3 ? 'gemini-3-pro-preview' : model
    
    // Configurar thinking_level para Gemini 3
    // thinking_level deve ser passado no generationConfig quando chamar generateContent/startChat
    const thinkingLevel = isGemini3High ? 'high' : isGemini3Low ? 'low' : undefined
    
    if (isGemini3) {
      console.log('[callGemini] Gemini 3 detectado, usando thinking_level:', thinkingLevel)
    }
    
    const geminiModel = genAI.getGenerativeModel({ model: apiModelName })

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
        // Passar thinking_level para Gemini 3 se necessário
        const streamOptions = thinkingLevel ? { generationConfig: { thinkingLevel } } : undefined
        const result = await geminiModel.generateContentStream(currentMessage, streamOptions as any)
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
        // Passar thinking_level para Gemini 3 se necessário
        const contentOptions = thinkingLevel ? { generationConfig: { thinkingLevel } } : undefined
        const result = await geminiModel.generateContent(currentMessage, contentOptions as any)
        const response = await result.response
        const content = response.text()

        const latency = Date.now() - startTime
        const inputTokens = response.usageMetadata?.promptTokenCount || estimateTokens(currentMessage)
        const outputTokens = response.usageMetadata?.candidatesTokenCount || estimateTokens(content)
        
        // Gemini 3 tem pricing variável baseado no número total de tokens
        let pricing = MODEL_PRICING[`google:${model}`] || MODEL_PRICING['google:gemini-2.5-flash'] || DEFAULT_PRICING
        if (isGemini3) {
          const totalTokens = inputTokens + outputTokens
          // Pricing: $2/$12 (<200k tokens) ou $4/$18 (>200k tokens)
          if (totalTokens >= 200_000) {
            pricing = { input: 4.0, output: 18.0 }
          } else {
            pricing = { input: 2.0, output: 12.0 }
          }
        }
        
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
        // Passar thinking_level para Gemini 3 se necessário
        const streamOptions = thinkingLevel ? { generationConfig: { thinkingLevel } } : undefined
        const result = await geminiModel.generateContentStream(currentMessage, streamOptions as any)
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
        // Passar thinking_level para Gemini 3 se necessário
        const contentOptions = thinkingLevel ? { generationConfig: { thinkingLevel } } : undefined
        const result = await geminiModel.generateContent(currentMessage, contentOptions as any)
        const response = await result.response
        const content = response.text()

        const latency = Date.now() - startTime
        const inputTokens = response.usageMetadata?.promptTokenCount || estimateTokens(currentMessage)
        const outputTokens = response.usageMetadata?.candidatesTokenCount || estimateTokens(content)
        
        // Gemini 3 tem pricing variável baseado no número total de tokens
        let pricing = MODEL_PRICING[`google:${model}`] || MODEL_PRICING['google:gemini-2.5-flash'] || DEFAULT_PRICING
        if (isGemini3) {
          const totalTokens = inputTokens + outputTokens
          // Pricing: $2/$12 (<200k tokens) ou $4/$18 (>200k tokens)
          if (totalTokens >= 200_000) {
            pricing = { input: 4.0, output: 18.0 }
          } else {
            pricing = { input: 2.0, output: 12.0 }
          }
        }
        
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
      // Configurar startChat com thinking_level para Gemini 3 se necessário
      const chatOptions: any = { history: history as any }
      if (thinkingLevel) {
        chatOptions.generationConfig = { thinkingLevel }
      }
      
      const chat = geminiModel.startChat(chatOptions)
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
      // Configurar startChat com thinking_level para Gemini 3 se necessário
      const chatOptions: any = { history: history as any }
      if (thinkingLevel) {
        chatOptions.generationConfig = { thinkingLevel }
      }
      
      const chat = geminiModel.startChat(chatOptions)
      const result = await chat.sendMessage(currentMessage)
      const response = await result.response
      const content = response.text()

      const latency = Date.now() - startTime
      const inputTokens = response.usageMetadata?.promptTokenCount || estimateTokens(filteredMessages.map(m => m.content).join(' '))
      const outputTokens = response.usageMetadata?.candidatesTokenCount || estimateTokens(content)
      
      // Gemini 3 tem pricing variável baseado no número total de tokens
      let pricing = MODEL_PRICING[`google:${model}`] || MODEL_PRICING['google:gemini-2.5-flash'] || DEFAULT_PRICING
      if (isGemini3) {
        const totalTokens = inputTokens + outputTokens
        // Pricing: $2/$12 (<200k tokens) ou $4/$18 (>200k tokens)
        if (totalTokens >= 200_000) {
          pricing = { input: 4.0, output: 18.0 }
        } else {
          pricing = { input: 2.0, output: 12.0 }
        }
      }
      
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

/**
 * Chama a API de geração de imagens do Google Gemini (Nano Banana)
 * Modelo: gemini-2.5-flash-image
 * Documentação: https://ai.google.dev/gemini-api/docs/image-generation
 */
async function callGeminiImage(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  const modelName = 'Nano Banana'
  
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurado')
    }

    console.log('[callGeminiImage] Iniciando geração de imagem:', { model, messagesCount: messages.length, stream })

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const geminiModel = genAI.getGenerativeModel({ model })

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para gerar imagem')
    }

    const prompt = lastUserMessage.content

    // Verificar se há imagens anexadas na mensagem (para edição de imagem)
    // Por enquanto, vamos suportar apenas text-to-image
    // TODO: Adicionar suporte para image editing quando necessário

    // Detectar aspect ratio no prompt ou usar padrão 1:1
    const promptLower = prompt.toLowerCase()
    const aspectRatios: { [key: string]: string } = {
      '16:9': '16:9',
      '9:16': '9:16',
      '4:3': '4:3',
      '3:4': '3:4',
      '2:3': '2:3',
      '3:2': '3:2',
      '21:9': '21:9',
      '4:5': '4:5',
      '5:4': '5:4',
    }

    let aspectRatio = '1:1' // Padrão
    for (const [ratio, value] of Object.entries(aspectRatios)) {
      if (promptLower.includes(ratio) || promptLower.includes(value.replace(':', 'x'))) {
        aspectRatio = value
        break
      }
    }

    // Detectar outras preferências no prompt
    if (promptLower.includes('landscape') || promptLower.includes('paisagem') || promptLower.includes('horizontal')) {
      aspectRatio = '16:9'
    } else if (promptLower.includes('portrait') || promptLower.includes('retrato') || promptLower.includes('vertical')) {
      aspectRatio = '9:16'
    }

    console.log('[callGeminiImage] Aspect ratio detectado:', aspectRatio)

    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Enviar mensagem inicial de loading
            controller.enqueue(encoder.encode(`🍌 Gerando imagem com ${modelName}... Isso pode levar alguns segundos.\n\n`))

            // Configurar para gerar imagem
            // Usar generateContentConfig do SDK do Google Generative AI
            const config: any = {
              responseModalities: ['IMAGE'],
              generationConfig: {
                imageConfig: {
                  aspectRatio: aspectRatio,
                },
              },
            }

            // Gerar a imagem - o SDK aceita o prompt como primeiro argumento e config como segundo
            const result = await geminiModel.generateContent(prompt, config)
            const response = await result.response

            // Extrair a imagem da resposta
            let imageData: string | null = null
            for (const part of response.candidates[0].content.parts) {
              if ((part as any).inlineData) {
                const inlineData = (part as any).inlineData
                const mimeType = inlineData.mimeType || 'image/png'
                const data = inlineData.data
                if (data) {
                  // Converter base64 para data URL
                  imageData = `data:${mimeType};base64,${data}`
                  break
                }
              }
            }

            if (!imageData) {
              throw new Error('Resposta da API não contém dados de imagem')
            }

            // Calcular latência e custo
            const latency = Date.now() - startTime
            const pricing = MODEL_PRICING[`google:${model}`] || MODEL_PRICING['google:gemini-2.5-flash'] || DEFAULT_PRICING
            // Imagens do Gemini são tokenizadas como 1290 tokens por imagem (até 1024x1024px)
            const outputTokens = 1290
            const inputTokens = estimateTokens(prompt)
            const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

            // Construir markdown com a imagem
            let content = `🍌 **Imagem gerada com ${modelName}!**\n\n`
            content += `![Imagem gerada](${imageData})\n\n`
            content += `**Parâmetros:**\n`
            content += `- Aspect Ratio: ${aspectRatio}\n`
            content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(2)}/token input + $${pricing.output.toFixed(2)}/token output, imagem = 1290 tokens)`

            // Enviar o conteúdo completo
            controller.enqueue(encoder.encode(content))
            controller.close()

          } catch (error: any) {
            console.error('[callGeminiImage] Erro no stream:', error)
            controller.error(new Error(`Erro ao gerar imagem com ${modelName}: ${error.message || error}`))
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
      // Modo não-streaming
      const config: any = {
        responseModalities: ['IMAGE'],
        generationConfig: {
          imageConfig: {
            aspectRatio: aspectRatio,
          },
        },
      }

      const result = await geminiModel.generateContent(prompt, config)
      const response = await result.response

      // Extrair a imagem da resposta
      let imageData: string | null = null
      for (const part of response.candidates[0].content.parts) {
        if ((part as any).inlineData) {
          const inlineData = (part as any).inlineData
          const mimeType = inlineData.mimeType || 'image/png'
          const data = inlineData.data
          if (data) {
            // Converter base64 para data URL
            imageData = `data:${mimeType};base64,${data}`
            break
          }
        }
      }

      if (!imageData) {
        throw new Error('Resposta da API não contém dados de imagem')
      }

      const latency = Date.now() - startTime
      const pricing = MODEL_PRICING[`google:${model}`] || MODEL_PRICING['google:gemini-2.5-flash'] || DEFAULT_PRICING
      // Imagens do Gemini são tokenizadas como 1290 tokens por imagem (até 1024x1024px)
      const outputTokens = 1290
      const inputTokens = estimateTokens(prompt)
      const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

      // Construir markdown com a imagem
      let content = `🍌 **Imagem gerada com ${modelName}!**\n\n`
      content += `![Imagem gerada](${imageData})\n\n`
      content += `**Parâmetros:**\n`
      content += `- Aspect Ratio: ${aspectRatio}\n`
      content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(2)}/token input + $${pricing.output.toFixed(2)}/token output, imagem = 1290 tokens)`

      return {
        provider: 'Google',
        model,
        content,
        latency,
        cost,
        inputTokens,
        outputTokens,
        metadata: {
          aspectRatio,
          imageUrl: imageData,
        },
      }
    }
  } catch (error: any) {
    console.error('[callGeminiImage] Erro:', error)
    
    // Mensagens de erro específicas
    if (error.message?.includes('API') || error.message?.includes('404') || error.message?.includes('not found')) {
      throw new Error(`API do ${modelName} retornou erro. Verifique: https://ai.google.dev/gemini-api/docs/image-generation. Erro: ${error.message}`)
    }
    
    if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
      throw new Error(`Erro no prompt de geração de imagem: ${error.message}`)
    }
    
    throw new Error(`Erro ao gerar imagem com ${modelName}: ${error.message || error}`)
  }
}

/**
 * Chama a API de geração de música Lyria RealTime do Google Gemini
 * Modelo: lyria-realtime-exp (experimental)
 * Documentação: https://ai.google.dev/gemini-api/docs/music-generation
 * 
 * NOTA: O Lyria RealTime usa WebSocket para streaming bidirecional em tempo real.
 * A implementação completa requer suporte do SDK para Live API, que pode não estar
 * disponível no @google/generative-ai atualmente. Esta função fornece uma
 * implementação básica que tenta usar a API quando disponível.
 */
async function callLyria(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  const modelName = 'Lyria RealTime'
  
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurado')
    }

    console.log('[callLyria] Iniciando geração de música:', { model, messagesCount: messages.length, stream })

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para gerar música')
    }

    const prompt = lastUserMessage.content

    // O Lyria RealTime requer WebSocket e Live API
    // Verificar se o SDK suporta live.music.connect()
    // Por enquanto, retornamos uma mensagem informativa explicando como funciona
    // TODO: Implementar suporte completo quando o SDK estiver disponível

    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Enviar mensagem informativa sobre o Lyria RealTime
            const infoMessage = `🎵 **Sobre o Lyria RealTime**

O Lyria RealTime é um modelo experimental de geração de música em tempo real que usa WebSocket para streaming bidirecional.

**Funcionalidades:**
- Geração de música instrumental em tempo real
- Controle de BPM (60-200), densidade, brilho, escala musical
- Prompts ponderados para influenciar a geração
- Controles de playback (play, pause, stop, reset)

**Prompt enviado:**
"${prompt}"

**Status:**
O suporte completo para Lyria RealTime no Laboratório de IA requer a API Live do Google Generative AI, que pode não estar disponível no SDK atual (@google/generative-ai).

Para usar o Lyria RealTime, você pode:
1. Acessar o [Google AI Studio](https://aistudio.google.com/app/prompts/new_chat?model=lyria-realtime-exp) diretamente
2. Usar a [documentação oficial](https://ai.google.dev/gemini-api/docs/music-generation) para integração via SDK Python/JavaScript

**Exemplo de uso:**
O modelo aceita descrições de gênero, instrumentos, humor, características musicais. Exemplos:
- "Minimal techno with deep bass, sparse percussion, and atmospheric synths"
- "Jazz piano with smooth saxophone, laid-back tempo"
- "Acoustic guitar, folk style, upbeat and cheerful"

**Configurações disponíveis:**
- BPM: 60-200 (batidas por minuto)
- Densidade: 0.0-1.0 (densidade de notas/sons)
- Brilho: 0.0-1.0 (qualidade tonal, frequências mais altas)
- Escala: Escalas musicais disponíveis (C major, D minor, etc.)

Para mais informações, consulte: https://ai.google.dev/gemini-api/docs/music-generation`

            controller.enqueue(encoder.encode(infoMessage))
            controller.close()

          } catch (error: any) {
            console.error('[callLyria] Erro no stream:', error)
            controller.error(new Error(`Erro ao gerar música com ${modelName}: ${error.message || error}`))
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
      // Modo não-streaming
      const latency = Date.now() - startTime
      const pricing = MODEL_PRICING[`google:${model}`] || DEFAULT_PRICING
      const cost = 0 // Cálculo de custo baseado em tempo de streaming

      const content = `🎵 **Sobre o Lyria RealTime**

O Lyria RealTime é um modelo experimental de geração de música em tempo real que usa WebSocket para streaming bidirecional.

**Funcionalidades:**
- Geração de música instrumental em tempo real
- Controle de BPM (60-200), densidade, brilho, escala musical
- Prompts ponderados para influenciar a geração
- Controles de playback (play, pause, stop, reset)

**Prompt enviado:**
"${prompt}"

**Status:**
O suporte completo para Lyria RealTime no Laboratório de IA requer a API Live do Google Generative AI, que pode não estar disponível no SDK atual (@google/generative-ai).

Para usar o Lyria RealTime, você pode:
1. Acessar o [Google AI Studio](https://aistudio.google.com/app/prompts/new_chat?model=lyria-realtime-exp) diretamente
2. Usar a [documentação oficial](https://ai.google.dev/gemini-api/docs/music-generation) para integração via SDK Python/JavaScript

**Exemplo de uso:**
O modelo aceita descrições de gênero, instrumentos, humor, características musicais. Exemplos:
- "Minimal techno with deep bass, sparse percussion, and atmospheric synths"
- "Jazz piano with smooth saxophone, laid-back tempo"
- "Acoustic guitar, folk style, upbeat and cheerful"

**Configurações disponíveis:**
- BPM: 60-200 (batidas por minuto)
- Densidade: 0.0-1.0 (densidade de notas/sons)
- Brilho: 0.0-1.0 (qualidade tonal, frequências mais altas)
- Escala: Escalas musicais disponíveis (C major, D minor, etc.)

Para mais informações, consulte: https://ai.google.dev/gemini-api/docs/music-generation`

      return {
        provider: 'Google',
        model,
        content,
        latency,
        cost,
        metadata: {
          prompt,
          modelType: 'music-generation',
        },
      }
    }
  } catch (error: any) {
    console.error('[callLyria] Erro:', error)
    
    throw new Error(`Erro ao gerar música com ${modelName}: ${error.message || error}`)
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

    // Modelos de imagem não suportam streaming tradicional, mas precisamos gerar a imagem
    // mesmo quando stream=true, então vamos gerar e retornar o resultado completo
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Enviar mensagem inicial de loading
            controller.enqueue(encoder.encode(`${modelIcon} Gerando imagem com ${modelName}... Isso pode levar alguns segundos.\n\n`))
            
            // Agora gerar a imagem de fato (mesmo com stream=true)
            // Extrair o prompt da última mensagem do usuário
            const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
            if (!lastUserMessage || !lastUserMessage.content) {
              throw new Error('Nenhuma mensagem do usuário encontrada para gerar imagem')
            }

            const prompt = lastUserMessage.content
            const promptLower = prompt.toLowerCase()
            
            // Detectar resolução no prompt ou usar padrão
            let aspect_ratio = '1:1'
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

            let output_format = 'png'
            if (promptLower.includes('jpeg') || promptLower.includes('jpg')) {
              output_format = 'jpeg'
            } else if (promptLower.includes('webp')) {
              output_format = 'webp'
            }

            const numImagesMatch = prompt.match(/(\d+)\s*(imagens?|images?)/i)
            const num_outputs = numImagesMatch ? Math.min(parseInt(numImagesMatch[1]), 4) : 1

            const input: any = {
              prompt: prompt,
              aspect_ratio: aspect_ratio,
              output_format: output_format,
              num_outputs: num_outputs,
            }

            const startExecutionTime = Date.now()
            
            console.log('[callFluxImage] Chamando Replicate com modelo:', model)
            console.log('[callFluxImage] Input:', JSON.stringify(input, null, 2))
            
            let result: any
            try {
              result = await replicate.run(model, { input })
              console.log('[callFluxImage] Resultado do Replicate recebido:', {
                type: typeof result,
                isArray: Array.isArray(result),
                isAsyncIterator: result && typeof result === 'object' && typeof (result as any)[Symbol.asyncIterator] === 'function',
                hasUrlMethod: result && typeof result === 'object' && typeof (result as any).url === 'function',
                constructor: result?.constructor?.name,
                keys: result && typeof result === 'object' ? Object.keys(result) : null,
                result: result,
              })
            } catch (replicateError: any) {
              console.error('[callFluxImage] Erro ao chamar replicate.run:', replicateError)
              throw new Error(`Erro ao chamar Replicate API: ${replicateError.message || replicateError}`)
            }
            
            // Usar função auxiliar para extrair URLs
            console.log('[callFluxImage] Chamando extractImageUrlsFromReplicate...')
            const imageUrls = await extractImageUrlsFromReplicate(result, modelName)
            console.log('[callFluxImage] URLs extraídas:', imageUrls)

            if (imageUrls.length === 0) {
              console.error(`[callFluxImage] ERRO: Nenhuma URL extraída para ${modelName}`)
              console.error(`[callFluxImage] Resultado completo do Replicate:`, JSON.stringify(result, null, 2))
              console.error(`[callFluxImage] Tipo do resultado:`, typeof result)
              console.error(`[callFluxImage] É array:`, Array.isArray(result))
              if (result && typeof result === 'object') {
                console.error(`[callFluxImage] Chaves do objeto:`, Object.keys(result))
                console.error(`[callFluxImage] Métodos disponíveis:`, Object.getOwnPropertyNames(result).filter(name => typeof (result as any)[name] === 'function'))
              }
              throw new Error(`Resposta da API não contém URLs de imagens para ${modelName}. Verifique os logs do console para mais detalhes.`)
            }

            const executionTime = Date.now() - startExecutionTime
            const latency = Date.now() - startTime

            const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
            const executionSeconds = executionTime / 1000
            const cost = pricing.input * executionSeconds * imageUrls.length

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

            // Enviar o conteúdo completo
            controller.enqueue(encoder.encode(content))
            controller.close()
          } catch (error: any) {
            console.error('[callFluxImage] Erro no stream:', error)
            
            let errorMessage = `Erro ao gerar imagem com ${modelName}: ${error.message || error}`
            if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
              errorMessage = 'REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.'
            } else if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
              errorMessage = `Erro no prompt de geração de imagem: ${error.message}`
            }
            
            controller.enqueue(encoder.encode(`❌ ${errorMessage}`))
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
    
    try {
      console.log('[callFluxImage][non-stream] Chamando Replicate com modelo:', model)
      console.log('[callFluxImage][non-stream] Input:', JSON.stringify(input, null, 2))
      
      // O Replicate pode retornar um iterador assíncrono ou resultado direto
      let result: any
      try {
        result = await replicate.run(model, { input })
        console.log('[callFluxImage][non-stream] Resultado do Replicate recebido:', {
          type: typeof result,
          isArray: Array.isArray(result),
          isAsyncIterator: result && typeof result === 'object' && typeof (result as any)[Symbol.asyncIterator] === 'function',
          hasUrlMethod: result && typeof result === 'object' && typeof (result as any).url === 'function',
          constructor: result?.constructor?.name,
          keys: result && typeof result === 'object' ? Object.keys(result) : null,
          arrayLength: Array.isArray(result) ? result.length : null,
          result: result,
        })
      } catch (replicateError: any) {
        console.error('[callFluxImage][non-stream] Erro ao chamar replicate.run:', replicateError)
        throw new Error(`Erro ao chamar Replicate API: ${replicateError.message || replicateError}`)
      }
      
      // Usar função auxiliar para extrair URLs
      console.log('[callFluxImage][non-stream] Chamando extractImageUrlsFromReplicate...')
      const imageUrls = await extractImageUrlsFromReplicate(result, modelName)
      console.log('[callFluxImage][non-stream] URLs extraídas:', imageUrls)

      if (imageUrls.length === 0) {
        console.error(`[callFluxImage][non-stream] ERRO: Nenhuma URL extraída para ${modelName}`)
        console.error(`[callFluxImage][non-stream] Resultado completo do Replicate:`, JSON.stringify(result, null, 2))
        console.error(`[callFluxImage][non-stream] Tipo do resultado:`, typeof result)
        console.error(`[callFluxImage][non-stream] É array:`, Array.isArray(result))
        if (result && typeof result === 'object') {
          console.error(`[callFluxImage][non-stream] Chaves do objeto:`, Object.keys(result))
          console.error(`[callFluxImage][non-stream] Métodos disponíveis:`, Object.getOwnPropertyNames(result).filter(name => typeof (result as any)[name] === 'function'))
        }
        throw new Error(`Resposta da API não contém URLs de imagens para ${modelName}. Verifique os logs do console para mais detalhes.`)
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
  } catch (error: any) {
    console.error('[callFluxImage] Erro externo:', error)
    throw error
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

    // Modelos de imagem não suportam streaming tradicional, mas precisamos gerar a imagem
    // mesmo quando stream=true, então vamos gerar e retornar o resultado completo
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Enviar mensagem inicial de loading
            controller.enqueue(encoder.encode(`${modelIcon} Editando imagem com ${modelName}... Isso pode levar alguns segundos.\n\n`))
            
            // Agora gerar a imagem de fato (mesmo com stream=true)
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

            const input: any = {
              image: imageUrl,
              prompt: prompt,
            }

            const startExecutionTime = Date.now()
            const result = await replicate.run(model, { input })
            
            // Usar função auxiliar para extrair URLs
            const imageUrls = await extractImageUrlsFromReplicate(result, modelName)
            
            if (imageUrls.length === 0) {
              throw new Error(`Resposta da API não contém URL de imagem editada para ${modelName}`)
            }
            
            const imageUrlResult = imageUrls[0]

            const executionTime = Date.now() - startExecutionTime
            const latency = Date.now() - startTime
            const executionSeconds = executionTime / 1000

            const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
            const cost = pricing.input * executionSeconds

            let content = `${modelIcon} **Imagem editada com ${modelName}!**\n\n`
            content += `![Imagem editada](${imageUrlResult})\n\n`
            
            content += `**Prompt de edição:** "${prompt}"\n`
            content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
            content += `**Tempo de execução:** ${executionSeconds.toFixed(1)}s\n`
            content += `**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(2)}/segundo × ${executionSeconds.toFixed(1)}s)`
            
            if (isMax) {
              content += `\n\n*FLUX.1 Kontext [max] oferece máxima performance em edição de imagem, geração de tipografia melhorada e resultados superiores*`
            } else if (isPro) {
              content += `\n\n*FLUX.1 Kontext [pro] oferece performance state-of-the-art com saídas de alta qualidade, excelente seguimento de prompt e resultados consistentes*`
            } else if (isDev) {
              content += `\n\n*FLUX.1 Kontext [dev] é a versão open-weight com boa performance e uso comercial disponível via Replicate*`
            }

            // Enviar o conteúdo completo
            controller.enqueue(encoder.encode(content))
            controller.close()
          } catch (error: any) {
            console.error('[callFluxKontext] Erro no stream:', error)
            
            let errorMessage = `Erro ao editar imagem com ${modelName}: ${error.message || error}`
            if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
              errorMessage = 'REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.'
            } else if (error.message?.includes('imagem') || error.message?.includes('image')) {
              errorMessage = `${modelName} requer uma imagem para editar. Por favor, anexe uma imagem.`
            } else if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
              errorMessage = `Erro no prompt de edição de imagem: ${error.message}`
            }
            
            controller.enqueue(encoder.encode(`❌ ${errorMessage}`))
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
    const result = await replicate.run(model, { input })
    
    // Usar função auxiliar para extrair URLs
    const imageUrls = await extractImageUrlsFromReplicate(result, modelName)
    
    if (imageUrls.length === 0) {
      throw new Error(`Resposta da API não contém URL de imagem editada para ${modelName}`)
    }
    
    const imageUrlResult = imageUrls[0]

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

    // Modelos de imagem não suportam streaming tradicional, mas precisamos gerar a imagem
    // mesmo quando stream=true, então vamos gerar e retornar o resultado completo
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Enviar mensagem inicial de loading
            controller.enqueue(encoder.encode('✨ Gerando/Editando imagem com Seedream 4.0... Isso pode levar alguns segundos.\n\n'))
            
            // Agora gerar a imagem de fato (mesmo com stream=true)
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

            const isEditing = referenceImages.length > 0 || 
                              promptLower.includes('remover') || 
                              promptLower.includes('remove') ||
                              promptLower.includes('substituir') ||
                              promptLower.includes('replace') ||
                              promptLower.includes('editar') ||
                              promptLower.includes('edit') ||
                              promptLower.includes('modificar') ||
                              promptLower.includes('modify')

            let width = 1024
            let height = 1024
            
            if (promptLower.includes('4k') || promptLower.includes('3840') || promptLower.includes('4096')) {
              width = 3840
              height = 2160
            } else if (promptLower.includes('2k') || promptLower.includes('2560')) {
              width = 2560
              height = 1440
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

            const numImagesMatch = prompt.match(/(\d+)\s*(imagens?|images?|outputs?)/i)
            const num_outputs = numImagesMatch ? Math.min(parseInt(numImagesMatch[1]), 4) : 1

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

            const input: any = {
              prompt: prompt,
              width: width,
              height: height,
              num_outputs: num_outputs,
            }

            if (referenceImages.length > 0) {
              input.image = referenceImages[0]
              if (referenceImages.length > 1) {
                input.reference_images = referenceImages.slice(0, 4)
              }
            }

            if (edit_mode) {
              input.edit_mode = edit_mode
            }

            const startExecutionTime = Date.now()
            const result = await replicate.run(model, { input })
            
            // Usar função auxiliar para extrair URLs
            const imageUrls = await extractImageUrlsFromReplicate(result, 'Seedream 4.0')

            if (imageUrls.length === 0) {
              throw new Error('Resposta da API não contém URLs de imagens para Seedream 4.0')
            }

            const executionTime = Date.now() - startExecutionTime
            const latency = Date.now() - startTime

            const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
            const executionSeconds = executionTime / 1000
            const cost = pricing.input * executionSeconds * imageUrls.length

            const modeText = isEditing ? 'editada' : 'gerada'
            let content = `✨ **Imagem${imageUrls.length > 1 ? 's' : ''} ${modeText}${imageUrls.length > 1 ? 's' : ''} com Seedream 4.0!**\n\n`
            
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

            // Enviar o conteúdo completo
            controller.enqueue(encoder.encode(content))
            controller.close()
          } catch (error: any) {
            console.error('[callSeedreamImage] Erro no stream:', error)
            
            let errorMessage = `Erro ao gerar/editar imagem com Seedream 4.0: ${error.message || error}`
            if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
              errorMessage = 'REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.'
            } else if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
              errorMessage = `Erro no prompt de geração de imagem: ${error.message}`
            }
            
            controller.enqueue(encoder.encode(`❌ ${errorMessage}`))
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
    const result = await replicate.run(model, { input })
    
    // Usar função auxiliar para extrair URLs
    const imageUrls = await extractImageUrlsFromReplicate(result, 'Seedream 4.0')

    if (imageUrls.length === 0) {
      throw new Error('Resposta da API não contém URLs de imagens para Seedream 4.0')
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

    // Modelos de imagem não suportam streaming tradicional, mas precisamos gerar a imagem
    // mesmo quando stream=true, então vamos gerar e retornar o resultado completo
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Enviar mensagem inicial de loading
            controller.enqueue(encoder.encode(`🎨 Gerando imagem com ${modelName}... Isso pode levar alguns segundos.\n\n`))
            
            // Agora gerar a imagem de fato (mesmo com stream=true)
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
              styleReferences = imageAttachments.map((a: any) => a.url).filter(Boolean).slice(0, 3)
            }

            let aspect_ratio = '1:1'
            
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

            const useRandomStyle = promptLower.includes('random style') || 
                                  promptLower.includes('estilo aleatório') ||
                                  promptLower.includes('estilo random')

            const styleCodeMatch = prompt.match(/style[_\s]?code[:\s]+([a-zA-Z0-9]+)/i)
            const style_code = styleCodeMatch ? styleCodeMatch[1] : undefined

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

            const input: any = {
              prompt: prompt,
              aspect_ratio: aspect_ratio,
            }

            if (styleReferences.length > 0) {
              input.style_references = styleReferences
            }

            if (useRandomStyle) {
              input.random_style = true
            }

            if (style_code) {
              input.style_code = style_code
            }

            const startExecutionTime = Date.now()
            const result = await replicate.run(model, { input })
            
            // Usar função auxiliar para extrair URLs
            const imageUrls = await extractImageUrlsFromReplicate(result, modelName)

            if (imageUrls.length === 0) {
              throw new Error(`Resposta da API não contém URLs de imagens para ${modelName}`)
            }

            const executionTime = Date.now() - startExecutionTime
            const latency = Date.now() - startTime

            const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
            const cost = pricing.input * imageUrls.length

            let content = `🎨 **Imagem${imageUrls.length > 1 ? 's' : ''} gerada${imageUrls.length > 1 ? 's' : ''} com ${modelName}!**\n\n`
            
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

            // Enviar o conteúdo completo
            controller.enqueue(encoder.encode(content))
            controller.close()
          } catch (error: any) {
            console.error('[callIdeogramImage] Erro no stream:', error)
            
            let errorMessage = `Erro ao gerar imagem com ${modelName}: ${error.message || error}`
            if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
              errorMessage = 'REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.'
            } else if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
              errorMessage = `Erro no prompt de geração de imagem: ${error.message}`
            }
            
            controller.enqueue(encoder.encode(`❌ ${errorMessage}`))
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
    const result = await replicate.run(model, { input })
    
    // Usar função auxiliar para extrair URLs
    const imageUrls = await extractImageUrlsFromReplicate(result, modelName)

    if (imageUrls.length === 0) {
      throw new Error(`Resposta da API não contém URLs de imagens para ${modelName}`)
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

    // Modelos de imagem não suportam streaming tradicional, mas precisamos gerar a imagem
    // mesmo quando stream=true, então vamos gerar e retornar o resultado completo
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Enviar mensagem inicial de loading
            controller.enqueue(encoder.encode('👤 Gerando variações de personagem com Ideogram Character... Isso pode levar alguns segundos.\n\n'))
            
            // Agora gerar a imagem de fato (mesmo com stream=true)
            // Extrair o prompt da última mensagem do usuário
            const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
            if (!lastUserMessage || !lastUserMessage.content) {
              throw new Error('Nenhuma mensagem do usuário encontrada para gerar personagem')
            }

            const prompt = lastUserMessage.content
            const promptLower = prompt.toLowerCase()

            // Verificar se há imagem de referência anexada (obrigatória)
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

            let targetImage: string | null = null
            if (msgAny.attachments && Array.isArray(msgAny.attachments)) {
              const imageAttachments = msgAny.attachments.filter((a: any) => a.type === 'image')
              if (imageAttachments.length > 1) {
                targetImage = imageAttachments[1].url
              }
            }

            const isInpainting = targetImage !== null ||
                               promptLower.includes('adicionar') ||
                               promptLower.includes('add') ||
                               promptLower.includes('inserir') ||
                               promptLower.includes('insert') ||
                               promptLower.includes('colocar') ||
                               promptLower.includes('place') ||
                               promptLower.includes('na imagem') ||
                               promptLower.includes('in image')

            let aspect_ratio = '1:1'
            
            if (promptLower.includes('16:9') || promptLower.includes('paisagem') || promptLower.includes('landscape')) {
              aspect_ratio = '16:9'
            } else if (promptLower.includes('9:16') || promptLower.includes('retrato') || promptLower.includes('portrait')) {
              aspect_ratio = '9:16'
            } else if (promptLower.includes('4:5')) {
              aspect_ratio = '4:5'
            } else if (promptLower.includes('5:4')) {
              aspect_ratio = '5:4'
            }

            const numVariationsMatch = prompt.match(/(\d+)\s*(variações?|variations?|imagens?|images?)/i)
            const num_outputs = numVariationsMatch ? Math.min(parseInt(numVariationsMatch[1]), 4) : 1

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

            const input: any = {
              prompt: prompt,
              image: referenceImage,
              aspect_ratio: aspect_ratio,
              num_outputs: num_outputs,
            }

            if (isInpainting && targetImage) {
              input.target_image = targetImage
            }

            if (style) {
              input.style = style
            }

            const startExecutionTime = Date.now()
            const result = await replicate.run(model, { input })
            
            // Usar função auxiliar para extrair URLs
            const imageUrls = await extractImageUrlsFromReplicate(result, 'Ideogram Character')

            if (imageUrls.length === 0) {
              throw new Error('Resposta da API não contém URLs de imagens para Ideogram Character')
            }

            const executionTime = Date.now() - startExecutionTime
            const latency = Date.now() - startTime
            const executionSeconds = executionTime / 1000

            const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
            const cost = pricing.input * imageUrls.length

            const modeText = isInpainting ? 'adicionado' : 'gerado'
            let content = `👤 **Variações de personagem ${modeText}${imageUrls.length > 1 ? 's' : ''} com Ideogram Character!**\n\n`
            
            imageUrls.forEach((url, index) => {
              if (imageUrls.length > 1) {
                content += `**Variação ${index + 1}:**\n`
              }
              content += `![Variação de personagem](${url})\n\n`
            })
            
            content += `**Parâmetros:**\n`
            content += `- Aspecto: ${aspect_ratio}\n`
            content += `- Quantidade: ${imageUrls.length}\n`
            
            if (isInpainting) {
              content += `- Modo: Inpainting (adicionar personagem a imagem existente)\n`
            } else {
              content += `- Modo: Geração de variações consistentes\n`
            }
            
            if (style) {
              content += `- Estilo: ${style}\n`
            }
            
            content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
            content += `**Tempo de execução:** ${executionSeconds.toFixed(1)}s\n`
            content += `**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(2)}/imagem × ${imageUrls.length} imagem${imageUrls.length > 1 ? 's' : ''})`
            
            content += `\n\n*Ideogram Character gera variações consistentes de personagens a partir de uma imagem de referência, mantendo características faciais e estilo*`

            // Enviar o conteúdo completo
            controller.enqueue(encoder.encode(content))
            controller.close()
          } catch (error: any) {
            console.error('[callIdeogramCharacter] Erro no stream:', error)
            
            let errorMessage = `Erro ao gerar variações de personagem com Ideogram Character: ${error.message || error}`
            if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
              errorMessage = 'REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.'
            } else if (error.message?.includes('referência') || error.message?.includes('reference') || error.message?.includes('imagem')) {
              errorMessage = 'Ideogram Character requer uma imagem de referência com características faciais claras. Por favor, anexe uma imagem do personagem.'
            } else if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
              errorMessage = `Erro no prompt de geração de personagem: ${error.message}`
            }
            
            controller.enqueue(encoder.encode(`❌ ${errorMessage}`))
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
    const result = await replicate.run(model, { input })
    
    // Usar função auxiliar para extrair URLs
    const imageUrls = await extractImageUrlsFromReplicate(result, 'Ideogram Character')

    if (imageUrls.length === 0) {
      throw new Error('Resposta da API não contém URLs de imagens para Ideogram Character')
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
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN não configurado')
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    })

    const modelName = 'Seedance 1.0 Pro Fast'
    const modelIcon = '🎬'

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para gerar vídeo')
    }

    const prompt = lastUserMessage.content
    const promptLower = prompt.toLowerCase()

    // Detectar duração do vídeo no prompt ou usar padrão
    let duration = 5 // Padrão 5 segundos
    const durationMatch = prompt.match(/(\d+)\s*(segundos?|seconds?|s)/i)
    if (durationMatch) {
      duration = Math.min(Math.max(parseInt(durationMatch[1]), 1), 10) // Entre 1 e 10 segundos
    }

    // Detectar intensidade de movimento no prompt ou usar padrão
    let motion = 0.5 // Padrão 0.5
    if (promptLower.includes('rápido') || promptLower.includes('fast') || promptLower.includes('intenso')) {
      motion = 0.8
    } else if (promptLower.includes('lento') || promptLower.includes('slow') || promptLower.includes('suave')) {
      motion = 0.2
    }

    // Configurar input para Seedance
    const input: any = {
      prompt: prompt,
      duration: duration,
      motion: motion,
    }

    // Modelos de vídeo não suportam streaming tradicional, mas precisamos gerar o vídeo
    // mesmo quando stream=true, então vamos gerar e retornar o resultado completo
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Enviar mensagem inicial de loading
            controller.enqueue(encoder.encode(`${modelIcon} Gerando vídeo... Isso pode levar alguns minutos.\n\n`))
            
            // Agora gerar o vídeo de fato (mesmo com stream=true)
            const startExecutionTime = Date.now()
            
            console.log('[callSeedanceVideo] Chamando Replicate com modelo:', model)
            console.log('[callSeedanceVideo] Input:', JSON.stringify(input, null, 2))
            
            let result: any
            try {
              result = await replicate.run(model, { input })
              console.log('[callSeedanceVideo] Resultado do Replicate recebido:', {
                type: typeof result,
                isArray: Array.isArray(result),
                isAsyncIterator: result && typeof result === 'object' && typeof (result as any)[Symbol.asyncIterator] === 'function',
                hasUrlMethod: result && typeof result === 'object' && typeof (result as any).url === 'function',
                constructor: result?.constructor?.name,
                keys: result && typeof result === 'object' ? Object.keys(result) : null,
                result: result,
              })
            } catch (replicateError: any) {
              console.error('[callSeedanceVideo] Erro ao chamar replicate.run:', replicateError)
              throw new Error(`Erro ao chamar Replicate API: ${replicateError.message || replicateError}`)
            }
            
            // Usar função auxiliar para extrair URLs (mesma lógica de imagens)
            console.log('[callSeedanceVideo] Chamando extractImageUrlsFromReplicate...')
            const videoUrls = await extractImageUrlsFromReplicate(result, modelName)
            console.log('[callSeedanceVideo] URLs extraídas:', videoUrls)

            if (videoUrls.length === 0) {
              console.error(`[callSeedanceVideo] ERRO: Nenhuma URL extraída para ${modelName}`)
              throw new Error(`Resposta da API não contém URLs de vídeo para ${modelName}. Verifique os logs do console para mais detalhes.`)
            }

            const executionTime = Date.now() - startExecutionTime
            const latency = Date.now() - startTime

            const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
            const executionSeconds = executionTime / 1000
            const cost = pricing.input * executionSeconds

            // Construir resposta em formato de mensagem com vídeo
            let content = `${modelIcon} **Vídeo gerado com ${modelName}!**\n\n`
            
            // Adicionar vídeo gerado
            videoUrls.forEach((url, index) => {
              if (videoUrls.length > 1) {
                content += `**Vídeo ${index + 1}:**\n`
              }
              content += `![Vídeo gerado](${url})\n\n`
            })
            
            content += `**Parâmetros:**\n`
            content += `- Duração: ${duration}s\n`
            content += `- Movimento: ${motion}\n`
            content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
            content += `**Tempo de execução:** ${executionSeconds.toFixed(1)}s\n`
            content += `**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(3)}/segundo × ${executionSeconds.toFixed(1)}s)`

            // Enviar o conteúdo completo
            controller.enqueue(encoder.encode(content))
            controller.close()
          } catch (error: any) {
            console.error('[callSeedanceVideo] Erro no stream:', error)
            
            let errorMessage = `Erro ao gerar vídeo com ${modelName}: ${error.message || error}`
            if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
              errorMessage = 'REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.'
            } else if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
              errorMessage = `Erro no prompt de geração de vídeo: ${error.message}`
            }
            
            controller.enqueue(encoder.encode(`❌ ${errorMessage}`))
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

    // Modo não-stream
    const startExecutionTime = Date.now()
    
    console.log('[callSeedanceVideo][non-stream] Chamando Replicate com modelo:', model)
    console.log('[callSeedanceVideo][non-stream] Input:', JSON.stringify(input, null, 2))
    
    let result: any
    try {
      result = await replicate.run(model, { input })
      console.log('[callSeedanceVideo][non-stream] Resultado do Replicate recebido:', {
        type: typeof result,
        isArray: Array.isArray(result),
        isAsyncIterator: result && typeof result === 'object' && typeof (result as any)[Symbol.asyncIterator] === 'function',
        hasUrlMethod: result && typeof result === 'object' && typeof (result as any).url === 'function',
        constructor: result?.constructor?.name,
        keys: result && typeof result === 'object' ? Object.keys(result) : null,
        result: result,
      })
    } catch (replicateError: any) {
      console.error('[callSeedanceVideo][non-stream] Erro ao chamar replicate.run:', replicateError)
      throw new Error(`Erro ao chamar Replicate API: ${replicateError.message || replicateError}`)
    }
    
    // Usar função auxiliar para extrair URLs
    console.log('[callSeedanceVideo][non-stream] Chamando extractImageUrlsFromReplicate...')
    const videoUrls = await extractImageUrlsFromReplicate(result, modelName)
    console.log('[callSeedanceVideo][non-stream] URLs extraídas:', videoUrls)

    if (videoUrls.length === 0) {
      console.error(`[callSeedanceVideo][non-stream] ERRO: Nenhuma URL extraída para ${modelName}`)
      throw new Error(`Resposta da API não contém URLs de vídeo para ${modelName}. Verifique os logs do console para mais detalhes.`)
    }

    const executionTime = Date.now() - startExecutionTime
    const latency = Date.now() - startTime

    const pricing = MODEL_PRICING[`replicate:${model}`] || DEFAULT_PRICING
    const executionSeconds = executionTime / 1000
    const cost = pricing.input * executionSeconds

    // Construir resposta em formato de mensagem com vídeo
    let content = `${modelIcon} **Vídeo gerado com ${modelName}!**\n\n`
    
    // Adicionar vídeo gerado
    videoUrls.forEach((url, index) => {
      if (videoUrls.length > 1) {
        content += `**Vídeo ${index + 1}:**\n`
      }
      content += `![Vídeo gerado](${url})\n\n`
    })
    
    content += `**Parâmetros:**\n`
    content += `- Duração: ${duration}s\n`
    content += `- Movimento: ${motion}\n`
    content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
    content += `**Tempo de execução:** ${executionSeconds.toFixed(1)}s\n`
    content += `**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(3)}/segundo × ${executionSeconds.toFixed(1)}s)`

    return {
      provider: 'Replicate',
      model,
      content,
      latency,
      cost,
      metadata: {
        duration,
        motion,
        videoUrls,
        executionTime: executionTime / 1000,
      },
    }
  } catch (error: any) {
    console.error('[callSeedanceVideo] Erro:', error)
    
    // Mensagens de erro específicas
    if (error.message?.includes('REPLICATE_API_TOKEN') || error.message?.includes('auth')) {
      throw new Error('REPLICATE_API_TOKEN não configurado. Configure a variável de ambiente.')
    }
    
    if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
      throw new Error(`Erro no prompt de geração de vídeo: ${error.message}`)
    }
    
    throw new Error(`Erro ao gerar vídeo com Seedance: ${error.message || error}`)
  }
}

/**
 * Chama a API do VEO 3.1 do Google para geração de vídeo
 * Documentação: https://ai.google.dev/gemini-api/docs/video
 * 
 * Se userId, conversationId e messageId forem fornecidos, salva a operação no banco
 * e retorna imediatamente sem fazer polling (processamento assíncrono)
 */
async function callVeo(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number,
  userId?: string,
  conversationId?: string,
  messageId?: string
): Promise<LLMResponse> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurado')
    }

    // Extrair o prompt da última mensagem do usuário
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop()
    if (!lastUserMessage || !lastUserMessage.content) {
      throw new Error('Nenhuma mensagem do usuário encontrada para gerar vídeo')
    }

    const prompt = lastUserMessage.content
    const modelName = model.includes('fast') ? 'Veo 3.1 Fast Generate' : 'Veo 3.1 Generate'
    const modelIcon = '🎬'
    const isFast = model.includes('fast')
    
    // Base URL da API do Google Gemini
    const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
    const endpoint = `${BASE_URL}/models/${model}:predictLongRunning`
    
    console.log('[callVeo] Iniciando geração de vídeo com:', model)
    console.log('[callVeo] Endpoint:', endpoint)
    console.log('[callVeo] Prompt:', prompt.substring(0, 100) + '...')
    console.log('[callVeo] Modo assíncrono:', !!(userId && conversationId && messageId))

    // Função auxiliar para fazer polling da operação
    const pollOperation = async (operationName: string, maxWaitTime: number = 360000): Promise<any> => {
      const startPollTime = Date.now()
      let attempts = 0
      
      while (Date.now() - startPollTime < maxWaitTime) {
        attempts++
        console.log(`[callVeo] Verificando status da operação (tentativa ${attempts})...`)
        
        const statusResponse = await fetch(`${BASE_URL}/${operationName}`, {
          method: 'GET',
          headers: {
            'x-goog-api-key': process.env.GEMINI_API_KEY!,
          },
        })

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text()
          throw new Error(`Erro ao verificar status: ${statusResponse.status} - ${errorText}`)
        }

        const statusData = await statusResponse.json()
        console.log('[callVeo] Status da operação:', statusData.done ? 'Concluída' : 'Em progresso')

        if (statusData.done) {
          return statusData
        }

        // Aguardar 10 segundos antes da próxima verificação (conforme documentação)
        await new Promise(resolve => setTimeout(resolve, 10000))
      }

      throw new Error('Timeout: A operação excedeu o tempo máximo de espera (6 minutos)')
    }

    // Função auxiliar para fazer download do vídeo
    const downloadVideo = async (videoUri: string): Promise<string> => {
      console.log('[callVeo] Fazendo download do vídeo de:', videoUri)
      
      const videoResponse = await fetch(videoUri, {
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY!,
        },
      })

      if (!videoResponse.ok) {
        throw new Error(`Erro ao fazer download do vídeo: ${videoResponse.status} - ${videoResponse.statusText}`)
      }

      const videoBuffer = await videoResponse.arrayBuffer()
      // Converter ArrayBuffer para base64 usando Buffer (disponível no Node.js)
      const videoBase64 = Buffer.from(videoBuffer).toString('base64')
      console.log('[callVeo] Vídeo baixado com sucesso. Tamanho:', (videoBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB')
      
      return `data:video/mp4;base64,${videoBase64}`
    }

    // Modo stream
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Enviar mensagem inicial de loading
            controller.enqueue(encoder.encode(`${modelIcon} Gerando vídeo com ${modelName}... Isso pode levar de 11 segundos a 6 minutos.\n\n`))

            const startExecutionTime = Date.now()

            // 1. Fazer chamada inicial à API
            console.log('[callVeo] Fazendo requisição inicial...')
            const initialResponse = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'x-goog-api-key': process.env.GEMINI_API_KEY!,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                instances: [{
                  prompt: prompt,
                }],
              }),
            })

            console.log('[callVeo] Status da resposta inicial:', initialResponse.status, initialResponse.statusText)

            if (!initialResponse.ok) {
              const errorText = await initialResponse.text()
              let errorData: any = {}
              try {
                errorData = JSON.parse(errorText)
              } catch {
                errorData = { message: errorText }
              }
              
              if (initialResponse.status === 401 || initialResponse.status === 403) {
                throw new Error('Erro de autenticação: GEMINI_API_KEY inválida ou sem permissão para usar VEO 3.1.')
              } else if (initialResponse.status === 429) {
                throw new Error('Limite de taxa excedido. Aguarde alguns instantes antes de tentar novamente.')
              }
              
              const errorMessage = errorData.error?.message || errorData.message || errorText
              throw new Error(`Erro ao iniciar geração de vídeo: ${initialResponse.status} - ${errorMessage}`)
            }

            const initialData = await initialResponse.json()
            const operationName = initialData.name
            
            if (!operationName) {
              throw new Error('Resposta da API não contém o nome da operação')
            }

            console.log('[callVeo] Operação criada:', operationName)

            // Se modo assíncrono (userId, conversationId, messageId fornecidos), salvar no banco e retornar imediatamente
            if (userId && conversationId && messageId) {
              console.log('[callVeo] Modo assíncrono: salvando operação no banco e retornando imediatamente')
              
              // Criar cliente Supabase com service role key para inserir no banco
              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              )

              // Salvar operação no banco
              const { error: dbError } = await supabase
                .from('lab_video_operations')
                .insert({
                  user_id: userId,
                  conversation_id: conversationId,
                  message_id: messageId,
                  model: model,
                  prompt: prompt,
                  operation_name: operationName,
                  status: 'pending',
                })

              if (dbError) {
                console.error('[callVeo] Erro ao salvar operação no banco:', dbError)
                // Continuar com polling normal se falhar ao salvar
              } else {
                console.log('[callVeo] Operação salva no banco com sucesso')
                
                // Retornar mensagem informando que o vídeo está sendo processado
                const content = `${modelIcon} **Vídeo em processamento**\n\n` +
                  `Seu vídeo está sendo gerado com ${modelName}. Isso pode levar de 11 segundos a 6 minutos.\n\n` +
                  `Você será notificado quando o vídeo estiver pronto. Você pode continuar usando o chat enquanto isso acontece.\n\n` +
                  `**Status:** Processando...\n` +
                  `**Prompt:** ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`
                
                controller.enqueue(encoder.encode(content))
                controller.close()
                return
              }
            }

            console.log('[callVeo] Modo síncrono: fazendo polling da operação')
            controller.enqueue(encoder.encode(`⏳ Processando vídeo... Aguarde.\n\n`))

            // 2. Fazer polling da operação (modo síncrono)
            const finalStatus = await pollOperation(operationName)
            
            // 3. Extrair URI do vídeo (suporta diferentes estruturas de resposta)
            console.log('[callVeo] Estrutura completa da resposta:', JSON.stringify(finalStatus, null, 2))
            
            let videoUri: string | undefined
            
            // Tentar diferentes caminhos possíveis na estrutura de resposta
            if (finalStatus?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri) {
              videoUri = finalStatus.response.generateVideoResponse.generatedSamples[0].video.uri
            } else if (finalStatus?.response?.generatedVideos?.[0]?.video?.uri) {
              videoUri = finalStatus.response.generatedVideos[0].video.uri
            } else if (finalStatus?.response?.video?.uri) {
              videoUri = finalStatus.response.video.uri
            } else if (finalStatus?.video?.uri) {
              videoUri = finalStatus.video.uri
            } else if (finalStatus?.response?.generateVideoResponse?.generatedSamples?.[0]?.uri) {
              videoUri = finalStatus.response.generateVideoResponse.generatedSamples[0].uri
            }
            
            if (!videoUri) {
              console.error('[callVeo] Estrutura de resposta inesperada. Chaves disponíveis:', Object.keys(finalStatus || {}))
              console.error('[callVeo] Response keys:', Object.keys(finalStatus?.response || {}))
              throw new Error('URI do vídeo não encontrado na resposta da API. Verifique os logs do servidor para mais detalhes.')
            }

            console.log('[callVeo] URI do vídeo obtido:', videoUri)

            // 4. Fazer download do vídeo
            controller.enqueue(encoder.encode(`📥 Baixando vídeo gerado...\n\n`))
            const videoDataUrl = await downloadVideo(videoUri)

            const executionTime = Date.now() - startExecutionTime
            const latency = Date.now() - startTime

            // Calcular custo baseado na configuração de preços
            const pricingKey = `google:${model}`
            const pricing = MODEL_PRICING[pricingKey] || { input: 1.0, output: 1.0 }
            const videoDuration = 8 // VEO 3.1 gera vídeos de 8 segundos
            const costPerMinute = pricing.input || 1.0
            const cost = (videoDuration / 60) * costPerMinute

            // Construir resposta final
            let content = `${modelIcon} **Vídeo gerado com ${modelName}!**\n\n`
            content += `![Vídeo gerado](${videoDataUrl})\n\n`
            content += `**Parâmetros:**\n`
            content += `- Duração: ${videoDuration}s\n`
            content += `- Resolução: 720p/1080p\n`
            content += `- Áudio: Nativo\n`
            content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
            content += `**Tempo de execução:** ${(executionTime / 1000).toFixed(1)}s\n`
            content += `**Custo:** $${cost.toFixed(2)} ($${costPerMinute.toFixed(2)}/minuto × ${(videoDuration / 60).toFixed(2)}min)`

            controller.enqueue(encoder.encode(content))
            controller.close()
          } catch (error: any) {
            console.error('[callVeo] Erro no stream:', error)
            
            let errorMessage = `Erro ao gerar vídeo com ${modelName}: ${error.message || error}`
            if (error.message?.includes('GEMINI_API_KEY') || error.message?.includes('auth')) {
              errorMessage = 'GEMINI_API_KEY não configurado ou inválido. Configure a variável de ambiente.'
            } else if (error.message?.includes('Timeout')) {
              errorMessage = 'Timeout: A geração do vídeo excedeu o tempo máximo de espera. Tente novamente.'
            } else if (error.message?.includes('429')) {
              errorMessage = 'Limite de taxa excedido. Aguarde alguns instantes antes de tentar novamente.'
            }
            
            controller.enqueue(encoder.encode(`❌ ${errorMessage}`))
            controller.error(error)
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
    }

    // Modo não-stream
    const startExecutionTime = Date.now()

    // 1. Fazer chamada inicial à API
    console.log('[callVeo][non-stream] Fazendo requisição inicial...')
    const initialResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{
          prompt: prompt,
        }],
      }),
    })

    console.log('[callVeo][non-stream] Status da resposta inicial:', initialResponse.status, initialResponse.statusText)

    if (!initialResponse.ok) {
      const errorText = await initialResponse.text()
      let errorData: any = {}
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }
      
      if (initialResponse.status === 401 || initialResponse.status === 403) {
        throw new Error('Erro de autenticação: GEMINI_API_KEY inválida ou sem permissão para usar VEO 3.1.')
      } else if (initialResponse.status === 429) {
        throw new Error('Limite de taxa excedido. Aguarde alguns instantes antes de tentar novamente.')
      }
      
      const errorMessage = errorData.error?.message || errorData.message || errorText
      throw new Error(`Erro ao iniciar geração de vídeo: ${initialResponse.status} - ${errorMessage}`)
    }

    const initialData = await initialResponse.json()
    const operationName = initialData.name
    
    if (!operationName) {
      throw new Error('Resposta da API não contém o nome da operação')
    }

    console.log('[callVeo][non-stream] Operação criada:', operationName)

    // Se modo assíncrono (userId, conversationId, messageId fornecidos), salvar no banco e retornar imediatamente
    if (userId && conversationId && messageId) {
      console.log('[callVeo][non-stream] Modo assíncrono: salvando operação no banco e retornando imediatamente')
      
      // Criar cliente Supabase com service role key para inserir no banco
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Salvar operação no banco
      const { error: dbError } = await supabase
        .from('lab_video_operations')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          message_id: messageId,
          model: model,
          prompt: prompt,
          operation_name: operationName,
          status: 'pending',
        })

      if (dbError) {
        console.error('[callVeo][non-stream] Erro ao salvar operação no banco:', dbError)
        // Continuar com polling normal se falhar ao salvar
      } else {
        console.log('[callVeo][non-stream] Operação salva no banco com sucesso')
        
        // Retornar mensagem informando que o vídeo está sendo processado
        const content = `${modelIcon} **Vídeo em processamento**\n\n` +
          `Seu vídeo está sendo gerado com ${modelName}. Isso pode levar de 11 segundos a 6 minutos.\n\n` +
          `Você será notificado quando o vídeo estiver pronto. Você pode continuar usando o chat enquanto isso acontece.\n\n` +
          `**Status:** Processando...\n` +
          `**Prompt:** ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`
        
        return {
          provider: 'Google',
          model,
          content,
          latency: Date.now() - startTime,
          cost: 0,
        }
      }
    }

    console.log('[callVeo][non-stream] Modo síncrono: fazendo polling da operação')

    // 2. Fazer polling da operação (modo síncrono)
    const finalStatus = await pollOperation(operationName)
    
    // 3. Extrair URI do vídeo (suporta diferentes estruturas de resposta)
    console.log('[callVeo][non-stream] Estrutura completa da resposta:', JSON.stringify(finalStatus, null, 2))
    
    let videoUri: string | undefined
    
    // Tentar diferentes caminhos possíveis na estrutura de resposta
    if (finalStatus?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri) {
      videoUri = finalStatus.response.generateVideoResponse.generatedSamples[0].video.uri
    } else if (finalStatus?.response?.generatedVideos?.[0]?.video?.uri) {
      videoUri = finalStatus.response.generatedVideos[0].video.uri
    } else if (finalStatus?.response?.video?.uri) {
      videoUri = finalStatus.response.video.uri
    } else if (finalStatus?.video?.uri) {
      videoUri = finalStatus.video.uri
    } else if (finalStatus?.response?.generateVideoResponse?.generatedSamples?.[0]?.uri) {
      videoUri = finalStatus.response.generateVideoResponse.generatedSamples[0].uri
    }
    
    if (!videoUri) {
      console.error('[callVeo][non-stream] Estrutura de resposta inesperada. Chaves disponíveis:', Object.keys(finalStatus || {}))
      console.error('[callVeo][non-stream] Response keys:', Object.keys(finalStatus?.response || {}))
      throw new Error('URI do vídeo não encontrado na resposta da API. Verifique os logs do servidor para mais detalhes.')
    }

    console.log('[callVeo][non-stream] URI do vídeo obtido:', videoUri)

    // 4. Fazer download do vídeo
    console.log('[callVeo][non-stream] Fazendo download do vídeo...')
    const videoDataUrl = await downloadVideo(videoUri)

    const executionTime = Date.now() - startExecutionTime
    const latency = Date.now() - startTime

    // Calcular custo baseado na configuração de preços
    const pricingKey = `google:${model}`
    const pricing = MODEL_PRICING[pricingKey] || { input: 1.0, output: 1.0 }
    const videoDuration = 8 // VEO 3.1 gera vídeos de 8 segundos
    const costPerMinute = pricing.input || 1.0
    const cost = (videoDuration / 60) * costPerMinute

    // Construir resposta final
    let content = `${modelIcon} **Vídeo gerado com ${modelName}!**\n\n`
    content += `![Vídeo gerado](${videoDataUrl})\n\n`
    content += `**Parâmetros:**\n`
    content += `- Duração: ${videoDuration}s\n`
    content += `- Resolução: 720p/1080p\n`
    content += `- Áudio: Nativo\n`
    content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
    content += `**Tempo de execução:** ${(executionTime / 1000).toFixed(1)}s\n`
    content += `**Custo:** $${cost.toFixed(2)} ($${costPerMinute.toFixed(2)}/minuto × ${(videoDuration / 60).toFixed(2)}min)`

    return {
      provider: 'Google',
      model,
      content,
      latency,
      cost,
      metadata: {
        duration: videoDuration,
        resolution: '720p/1080p',
        videoUrl: videoDataUrl,
        executionTime: executionTime / 1000,
      },
    }
  } catch (error: any) {
    console.error('[callVeo] Erro:', error)
    
    // Mensagens de erro específicas
    if (error.message?.includes('GEMINI_API_KEY') || error.message?.includes('auth')) {
      throw new Error('GEMINI_API_KEY não configurado ou inválido. Configure a variável de ambiente.')
    } else if (error.message?.includes('Timeout')) {
      throw new Error('Timeout: A geração do vídeo excedeu o tempo máximo de espera (6 minutos). Tente novamente.')
    } else if (error.message?.includes('429')) {
      throw new Error('Limite de taxa excedido. Aguarde alguns instantes antes de tentar novamente.')
    }
    
    throw new Error(`Erro ao gerar vídeo com VEO 3.1: ${error.message || error}`)
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

    const modelName = isPro ? 'Sora 2 Pro' : 'Sora 2'
    const modelIcon = '🎬'

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

    // Modelos de vídeo não suportam streaming tradicional, mas precisamos gerar o vídeo
    // mesmo quando stream=true, então vamos gerar e retornar o resultado completo
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Enviar mensagem inicial de loading
            controller.enqueue(encoder.encode(`${modelIcon} Gerando vídeo com ${modelName}... Isso pode levar alguns minutos.\n\n`))
            
            // Agora gerar o vídeo de fato (mesmo com stream=true)
            const startExecutionTime = Date.now()
            
            console.log('[callSora2] Chamando API do Sora 2 com modelo:', model)
            console.log('[callSora2] Parâmetros:', { prompt, size, seconds: duration })
            
            // Chamar a API do Sora 2
            // Documentação oficial: https://platform.openai.com/docs/models/sora-2-pro
            // Tentar usar o SDK da OpenAI primeiro, depois fallback para fetch
            // Documentação: https://platform.openai.com/docs/guides/video-generation
            let response: any
            let apiResponse: Response | null = null
            
            try {
              // Tentar usar o SDK da OpenAI se tiver suporte para vídeos
              console.log('[callSora2] Tentando usar SDK da OpenAI...')
              // @ts-ignore - videos pode não estar no tipo ainda
              if (openai.videos && typeof openai.videos.create === 'function') {
                console.log('[callSora2] SDK tem suporte para vídeos, usando openai.videos.create()')
                response = await openai.videos.create({
                  model: model,
                  prompt: prompt,
                  size: size,
                  seconds: duration,
                })
                console.log('[callSora2] Resposta do SDK:', JSON.stringify(response, null, 2))
              } else {
                throw new Error('SDK não tem suporte para vídeos, usando fetch')
              }
            } catch (sdkError: any) {
              console.log('[callSora2] SDK não disponível ou erro:', sdkError.message)
              console.log('[callSora2] Usando fetch diretamente...')
              
              // Fallback: usar fetch diretamente
              // Tentar ambos os endpoints possíveis
              const endpoints = [
                'https://api.openai.com/v1/videos/generations',
                'https://api.openai.com/v1/videos',
              ]
              
              const requestBody = {
                model: model,
                prompt: prompt,
                size: size,
                seconds: duration, // Parâmetro correto conforme documentação: 'seconds'
              }
              
              let lastError: Error | null = null
              
              const failedEndpoints: string[] = []
              
              for (const endpoint of endpoints) {
                try {
                  console.log('[callSora2] Tentando endpoint:', endpoint)
                  console.log('[callSora2] Request Body:', JSON.stringify(requestBody, null, 2))
                  
                  apiResponse = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                  })
                  
                  console.log('[callSora2] Status da resposta:', apiResponse.status, apiResponse.statusText)
                  
                  if (apiResponse.ok) {
                    console.log('[callSora2] Endpoint funcionou:', endpoint)
                    break
                  } else {
                    // Adicionar endpoint à lista de falhas
                    failedEndpoints.push(`${endpoint} (${apiResponse.status})`)
                    
                    if (apiResponse.status === 405) {
                      console.log('[callSora2] Endpoint retornou 405, tentando próximo...')
                      // Continuar para o próximo endpoint
                      continue
                    } else {
                      // Outro erro, não tentar próximo endpoint
                      const errorText = await apiResponse.text()
                      let errorData: any = {}
                      try {
                        errorData = JSON.parse(errorText)
                      } catch {
                        errorData = { message: errorText }
                      }
                      const errorMessage = errorData.error?.message || errorData.message || errorData.error || apiResponse.statusText
                      throw new Error(`Endpoint ${endpoint} retornou ${apiResponse.status}: ${errorMessage}`)
                    }
                  }
                } catch (fetchError: any) {
                  console.log('[callSora2] Erro ao tentar endpoint:', endpoint, fetchError.message)
                  failedEndpoints.push(`${endpoint} (erro: ${fetchError.message})`)
                  lastError = fetchError
                  // Se não for erro de rede, não tentar próximo
                  if (!fetchError.message?.includes('fetch') && !fetchError.message?.includes('network')) {
                    throw fetchError
                  }
                  continue
                }
              }
              
              if (!apiResponse || !apiResponse.ok) {
                // Se ambos os endpoints retornaram 405, fornecer mensagem mais clara
                if (failedEndpoints.length === endpoints.length && failedEndpoints.every(e => e.includes('405'))) {
                  throw new Error(`A API do Sora 2 não está disponível publicamente ainda ou requer acesso especial. Ambos os endpoints tentados retornaram 405 (Método não permitido):\n- ${failedEndpoints.join('\n- ')}\n\nVerifique a documentação oficial: https://platform.openai.com/docs/guides/video-generation`)
                } else if (apiResponse) {
                  const errorText = await apiResponse.text()
                  let errorData: any = {}
                  try {
                    errorData = JSON.parse(errorText)
                  } catch {
                    errorData = { message: errorText }
                  }
                  
                  const errorMessage = errorData.error?.message || errorData.message || errorData.error || apiResponse.statusText
                  throw new Error(`Endpoint ${endpoints[endpoints.length - 1]} retornou ${apiResponse.status}: ${errorMessage}`)
                } else if (lastError) {
                  throw lastError
                } else {
                  throw new Error(`Nenhum endpoint funcionou. Endpoints tentados:\n- ${failedEndpoints.join('\n- ')}`)
                }
              }
            }

            // Se usamos fetch, processar a resposta
            if (apiResponse) {
              console.log('[callSora2] Status da resposta:', apiResponse.status, apiResponse.statusText)
              console.log('[callSora2] Response Headers:', Object.fromEntries(apiResponse.headers.entries()))

              if (!apiResponse.ok) {
                const errorText = await apiResponse.text()
                let errorData: any = {}
                try {
                  errorData = JSON.parse(errorText)
                } catch {
                  errorData = { message: errorText }
                }
                
                console.error('[callSora2] Erro da API - Status:', apiResponse.status, apiResponse.statusText)
                console.error('[callSora2] Erro da API - Body:', errorData)
                
                // Tratamento específico de erros HTTP
                if (apiResponse.status === 401) {
                  throw new Error('Erro de autenticação: OPENAI_API_KEY inválida ou expirada. Verifique suas credenciais.')
                } else if (apiResponse.status === 403) {
                  throw new Error(`Acesso negado à API do ${modelName}. Verifique se sua conta tem permissão para usar a API de vídeos do Sora 2.`)
                } else if (apiResponse.status === 404) {
                  throw new Error(`Endpoint não encontrado. Verifique se o endpoint está correto na documentação oficial.`)
                } else if (apiResponse.status === 405) {
                  throw new Error(`Método HTTP não permitido. Verifique se está usando POST e se o endpoint está correto.`)
                } else if (apiResponse.status === 429) {
                  throw new Error('Limite de taxa excedido. Aguarde alguns instantes antes de tentar novamente.')
                } else if (apiResponse.status >= 500) {
                  throw new Error(`Erro interno do servidor da OpenAI (${apiResponse.status}). Tente novamente mais tarde.`)
                }
                
                const errorMessage = errorData.error?.message || errorData.message || errorData.error || apiResponse.statusText
                throw new Error(`API do ${modelName} retornou erro ${apiResponse.status}: ${errorMessage}`)
              }

              response = await apiResponse.json()
            }
            
            console.log('[callSora2] Resposta completa da API:', JSON.stringify(response, null, 2))
            console.log('[callSora2] Estrutura da resposta - Keys:', Object.keys(response))

            // Verificar se a resposta indica processamento assíncrono (polling necessário)
            // A API pode retornar um job_id ou status indicando que o vídeo está sendo processado
            if (response?.status && response.status !== 'completed' && response.status !== 'succeeded') {
              // Se houver um job_id, implementar polling
              const jobId = response?.id || response?.job_id || response?.jobId
              if (jobId) {
                console.log('[callSora2] Processamento assíncrono detectado. Job ID:', jobId)
                console.log('[callSora2] Status atual:', response.status)
                
                // Implementar polling para verificar o status do job
                // Nota: A documentação oficial pode especificar um endpoint diferente para polling
                // Por enquanto, vamos assumir que a API retorna diretamente o vídeo quando pronto
                // Se necessário, implementar polling baseado na documentação oficial
                controller.enqueue(encoder.encode(`${modelIcon} Processando vídeo com ${modelName}... Isso pode levar alguns minutos.\n\n`))
                
                // Por enquanto, vamos aguardar e tentar novamente após um delay
                // Em produção, isso deve ser implementado com polling adequado conforme documentação
                throw new Error('Processamento assíncrono detectado, mas polling ainda não implementado. Verifique a documentação oficial para implementar polling adequado.')
              }
            }

            // O Sora 2 retorna um objeto com informações sobre o vídeo gerado
            // Conforme documentação: https://platform.openai.com/docs/guides/video-generation
            // A resposta pode ter estrutura: { data: [{ url: "...", ... }] } ou { url: "...", ... }
            console.log('[callSora2] Tentando extrair URL do vídeo da resposta...')
            console.log('[callSora2] response.data:', response?.data)
            console.log('[callSora2] response.url:', response?.url)
            console.log('[callSora2] response.video_url:', response?.video_url)
            console.log('[callSora2] response.status:', response?.status)
            console.log('[callSora2] response.id:', response?.id)
            
            let videoUrl: string | undefined
            if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
              // Estrutura: { data: [{ url: "...", ... }] }
              videoUrl = response.data[0]?.url || response.data[0]?.video_url
            } else if (response?.url) {
              // Estrutura: { url: "..." }
              videoUrl = response.url
            } else if (response?.video_url) {
              // Estrutura: { video_url: "..." }
              videoUrl = response.video_url
            } else if (response?.output) {
              // Fallback: { output: "..." }
              videoUrl = typeof response.output === 'string' ? response.output : response.output?.url
            }
            
            if (!videoUrl) {
              console.error('[callSora2] Estrutura de resposta inesperada. Resposta completa:', JSON.stringify(response, null, 2))
              throw new Error('URL do vídeo não retornada pela API. Estrutura da resposta não corresponde ao esperado. Verifique os logs do servidor para mais detalhes.')
            }
            
            console.log('[callSora2] URL do vídeo extraída:', videoUrl)

            const executionTime = Date.now() - startExecutionTime
            const latency = Date.now() - startTime

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
            const resolutionLabel = resolution === '1024p' ? 'Full HD (1024p)' : 'HD (720p)'

            // Construir resposta em formato de mensagem com vídeo
            let content = `${modelIcon} **Vídeo gerado com ${modelName}!**\n\n`
            
            // Adicionar vídeo gerado
            content += `![Vídeo gerado](${videoUrl})\n\n`
            
            content += `**Parâmetros:**\n`
            content += `- Duração: ${actualDuration}s\n`
            content += `- Resolução: ${resolutionLabel} (${size})\n`
            content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
            content += `**Tempo de execução:** ${(executionTime / 1000).toFixed(1)}s\n`
            content += `**Custo:** $${cost.toFixed(2)} ($${costPerSecond.toFixed(2)}/segundo × ${actualDuration}s)`

            // Enviar o conteúdo completo
            controller.enqueue(encoder.encode(content))
            controller.close()
          } catch (error: any) {
            console.error('[callSora2] Erro no stream:', error)
            
            let errorMessage = `Erro ao gerar vídeo com ${modelName}: ${error.message || error}`
            if (error.message?.includes('OPENAI_API_KEY') || error.message?.includes('auth')) {
              errorMessage = 'OPENAI_API_KEY não configurado. Configure a variável de ambiente.'
            } else if (error.message?.includes('videos') || error.message?.includes('404') || error.message?.includes('not found')) {
              const docUrl = isPro 
                ? 'https://platform.openai.com/docs/models/sora-2-pro'
                : 'https://platform.openai.com/docs/models/sora-2'
              errorMessage = `API do ${modelName} ainda não está disponível ou requer acesso especial. Verifique: ${docUrl}`
            }
            
            controller.enqueue(encoder.encode(`❌ ${errorMessage}`))
            controller.error(error)
          }
        }
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

    // Modo não-stream
    const startExecutionTime = Date.now()
    
    console.log('[callSora2][non-stream] Chamando API do Sora 2 com modelo:', model)
    console.log('[callSora2][non-stream] Parâmetros:', { prompt, size, seconds: duration })
    
    // Tentar usar o SDK da OpenAI primeiro, depois fallback para fetch
    // Documentação oficial: https://platform.openai.com/docs/guides/video-generation
    let response: any
    let apiResponse: Response | null = null
    
    try {
      // Tentar usar o SDK da OpenAI se tiver suporte para vídeos
      console.log('[callSora2][non-stream] Tentando usar SDK da OpenAI...')
      // @ts-ignore - videos pode não estar no tipo ainda
      if (openai.videos && typeof openai.videos.create === 'function') {
        console.log('[callSora2][non-stream] SDK tem suporte para vídeos, usando openai.videos.create()')
        response = await openai.videos.create({
          model: model,
          prompt: prompt,
          size: size,
          seconds: duration,
        })
        console.log('[callSora2][non-stream] Resposta do SDK:', JSON.stringify(response, null, 2))
      } else {
        throw new Error('SDK não tem suporte para vídeos, usando fetch')
      }
    } catch (sdkError: any) {
      console.log('[callSora2][non-stream] SDK não disponível ou erro:', sdkError.message)
      console.log('[callSora2][non-stream] Usando fetch diretamente...')
      
      // Fallback: usar fetch diretamente
      // Tentar ambos os endpoints possíveis
      const endpoints = [
        'https://api.openai.com/v1/videos/generations',
        'https://api.openai.com/v1/videos',
      ]
      
      const requestBody = {
        model: model,
        prompt: prompt,
        size: size,
        seconds: duration, // Parâmetro correto conforme documentação: 'seconds'
      }
      
      let lastError: Error | null = null
      const failedEndpoints: string[] = []
      
      for (const endpoint of endpoints) {
        try {
          console.log('[callSora2][non-stream] Tentando endpoint:', endpoint)
          console.log('[callSora2][non-stream] Request Body:', JSON.stringify(requestBody, null, 2))
          
          apiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          })
          
          console.log('[callSora2][non-stream] Status da resposta:', apiResponse.status, apiResponse.statusText)
          
          if (apiResponse.ok) {
            console.log('[callSora2][non-stream] Endpoint funcionou:', endpoint)
            break
          } else {
            // Adicionar endpoint à lista de falhas
            failedEndpoints.push(`${endpoint} (${apiResponse.status})`)
            
            if (apiResponse.status === 405) {
              console.log('[callSora2][non-stream] Endpoint retornou 405, tentando próximo...')
              // Continuar para o próximo endpoint
              continue
            } else {
              // Outro erro, não tentar próximo endpoint
              const errorText = await apiResponse.text()
              let errorData: any = {}
              try {
                errorData = JSON.parse(errorText)
              } catch {
                errorData = { message: errorText }
              }
              const errorMessage = errorData.error?.message || errorData.message || errorData.error || apiResponse.statusText
              throw new Error(`Endpoint ${endpoint} retornou ${apiResponse.status}: ${errorMessage}`)
            }
          }
        } catch (fetchError: any) {
          console.log('[callSora2][non-stream] Erro ao tentar endpoint:', endpoint, fetchError.message)
          failedEndpoints.push(`${endpoint} (erro: ${fetchError.message})`)
          lastError = fetchError
          // Se não for erro de rede, não tentar próximo
          if (!fetchError.message?.includes('fetch') && !fetchError.message?.includes('network')) {
            throw fetchError
          }
          continue
        }
      }
      
      if (!apiResponse || !apiResponse.ok) {
        // Se ambos os endpoints retornaram 405, fornecer mensagem mais clara
        if (failedEndpoints.length === endpoints.length && failedEndpoints.every(e => e.includes('405'))) {
          throw new Error(`A API do Sora 2 não está disponível publicamente ainda ou requer acesso especial. Ambos os endpoints tentados retornaram 405 (Método não permitido):\n- ${failedEndpoints.join('\n- ')}\n\nVerifique a documentação oficial: https://platform.openai.com/docs/guides/video-generation`)
        } else if (apiResponse) {
          const errorText = await apiResponse.text()
          let errorData: any = {}
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { message: errorText }
          }
          
          const errorMessage = errorData.error?.message || errorData.message || errorData.error || apiResponse.statusText
          throw new Error(`Endpoint ${endpoints[endpoints.length - 1]} retornou ${apiResponse.status}: ${errorMessage}`)
        } else if (lastError) {
          throw lastError
        } else {
          throw new Error(`Nenhum endpoint funcionou. Endpoints tentados:\n- ${failedEndpoints.join('\n- ')}`)
        }
      }
    }
    
    // Se usamos fetch, processar a resposta
    if (apiResponse) {
      console.log('[callSora2][non-stream] Status da resposta:', apiResponse.status, apiResponse.statusText)
      console.log('[callSora2][non-stream] Response Headers:', Object.fromEntries(apiResponse.headers.entries()))

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text()
        let errorData: any = {}
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText }
        }
        
        console.error('[callSora2][non-stream] Erro da API - Status:', apiResponse.status, apiResponse.statusText)
        console.error('[callSora2][non-stream] Erro da API - Body:', errorData)
        
        // Tratamento específico de erros HTTP
        if (apiResponse.status === 401) {
          throw new Error('Erro de autenticação: OPENAI_API_KEY inválida ou expirada. Verifique suas credenciais.')
        } else if (apiResponse.status === 403) {
          throw new Error(`Acesso negado à API do ${modelName}. Verifique se sua conta tem permissão para usar a API de vídeos do Sora 2.`)
        } else if (apiResponse.status === 404) {
          throw new Error(`Endpoint não encontrado. Verifique se o endpoint está correto na documentação oficial.`)
        } else if (apiResponse.status === 405) {
          throw new Error(`Método HTTP não permitido. Verifique se está usando POST e se o endpoint está correto.`)
        } else if (apiResponse.status === 429) {
          throw new Error('Limite de taxa excedido. Aguarde alguns instantes antes de tentar novamente.')
        } else if (apiResponse.status >= 500) {
          throw new Error(`Erro interno do servidor da OpenAI (${apiResponse.status}). Tente novamente mais tarde.`)
        }
        
        const errorMessage = errorData.error?.message || errorData.message || errorData.error || apiResponse.statusText
        throw new Error(`API do ${modelName} retornou erro ${apiResponse.status}: ${errorMessage}`)
      }

      response = await apiResponse.json()
    }
    console.log('[callSora2][non-stream] Resposta completa da API:', JSON.stringify(response, null, 2))
    console.log('[callSora2][non-stream] Estrutura da resposta - Keys:', Object.keys(response))

    // Verificar se a resposta indica processamento assíncrono (polling necessário)
    // A API pode retornar um job_id ou status indicando que o vídeo está sendo processado
    if (response?.status && response.status !== 'completed' && response.status !== 'succeeded') {
      // Se houver um job_id, implementar polling
      const jobId = response?.id || response?.job_id || response?.jobId
      if (jobId) {
        console.log('[callSora2][non-stream] Processamento assíncrono detectado. Job ID:', jobId)
        console.log('[callSora2][non-stream] Status atual:', response.status)
        
        // Por enquanto, vamos assumir que a API retorna diretamente o vídeo quando pronto
        // Se necessário, implementar polling baseado na documentação oficial
        // Em produção, isso deve ser implementado com polling adequado conforme documentação
        throw new Error('Processamento assíncrono detectado, mas polling ainda não implementado. Verifique a documentação oficial para implementar polling adequado.')
      }
    }

    // O Sora 2 retorna um objeto com informações sobre o vídeo gerado
    // Conforme documentação: https://platform.openai.com/docs/guides/video-generation
    // A resposta pode ter estrutura: { data: [{ url: "...", ... }] } ou { url: "...", ... }
    console.log('[callSora2][non-stream] Tentando extrair URL do vídeo da resposta...')
    console.log('[callSora2][non-stream] response.data:', response?.data)
    console.log('[callSora2][non-stream] response.url:', response?.url)
    console.log('[callSora2][non-stream] response.video_url:', response?.video_url)
    console.log('[callSora2][non-stream] response.status:', response?.status)
    console.log('[callSora2][non-stream] response.id:', response?.id)
    
    let videoUrl: string | undefined
    if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
      // Estrutura: { data: [{ url: "...", ... }] }
      videoUrl = response.data[0]?.url || response.data[0]?.video_url
    } else if (response?.url) {
      // Estrutura: { url: "..." }
      videoUrl = response.url
    } else if (response?.video_url) {
      // Estrutura: { video_url: "..." }
      videoUrl = response.video_url
    } else if (response?.output) {
      // Fallback: { output: "..." }
      videoUrl = typeof response.output === 'string' ? response.output : response.output?.url
    }
    
    if (!videoUrl) {
      console.error('[callSora2][non-stream] Estrutura de resposta inesperada. Resposta completa:', JSON.stringify(response, null, 2))
      throw new Error('URL do vídeo não retornada pela API. Estrutura da resposta não corresponde ao esperado. Verifique os logs do servidor para mais detalhes.')
    }
    
    console.log('[callSora2][non-stream] URL do vídeo extraída:', videoUrl)

    const executionTime = Date.now() - startExecutionTime
    const latency = Date.now() - startTime

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
    const resolutionLabel = resolution === '1024p' ? 'Full HD (1024p)' : 'HD (720p)'

    // Construir resposta em formato de mensagem com vídeo
    let content = `${modelIcon} **Vídeo gerado com ${modelName}!**\n\n`
    
    // Adicionar vídeo gerado
    content += `![Vídeo gerado](${videoUrl})\n\n`
    
    content += `**Parâmetros:**\n`
    content += `- Duração: ${actualDuration}s\n`
    content += `- Resolução: ${resolutionLabel} (${size})\n`
    content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n`
    content += `**Tempo de execução:** ${(executionTime / 1000).toFixed(1)}s\n`
    content += `**Custo:** $${cost.toFixed(2)} ($${costPerSecond.toFixed(2)}/segundo × ${actualDuration}s)`

    return {
      provider: 'OpenAI',
      model,
      content,
      latency,
      cost,
      metadata: {
        duration: actualDuration,
        resolution,
        size,
        videoUrl,
        executionTime: executionTime / 1000,
      },
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
  // Definir variáveis no início para uso em catch
  const isMini = model === 'gpt-image-1-mini'
  const modelName = isMini ? 'GPT-Image-1 Mini' : 'GPT-Image-1'
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurado')
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Modelos de imagem não suportam streaming tradicional, mas precisamos gerar a imagem
    // mesmo quando stream=true, então vamos gerar e retornar o resultado completo
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Enviar mensagem inicial de loading
            controller.enqueue(encoder.encode(`🖼️ Gerando imagem com ${modelName}... Isso pode levar alguns segundos.\n\n`))
            
            // Agora gerar a imagem de fato (mesmo com stream=true)
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
            // Valores suportados: 'low', 'medium', 'high', 'auto'
            let quality = 'auto' // Padrão
            if (promptLower.includes('hd') || promptLower.includes('alta qualidade') || promptLower.includes('high quality') || promptLower.includes('máxima qualidade')) {
              quality = 'high'
            } else if (promptLower.includes('baixa qualidade') || promptLower.includes('low quality')) {
              quality = 'low'
            } else if (promptLower.includes('qualidade média') || promptLower.includes('medium quality')) {
              quality = 'medium'
            }

            // Chamar a API de geração de imagens
            let response: any
            
            try {
              // Tentar usar a API de imagens se disponível no SDK
              const requestBody: any = {
                model: model,
                prompt: prompt,
                size: size,
                quality: quality,
                n: 1, // Gerar 1 imagem por padrão
              }
              
              response = await (openai as any).images?.generate?.(requestBody)
            } catch (sdkError: any) {
              // Se o SDK não suportar, usar fetch diretamente
              console.log('[callImageGeneration] SDK não suporta, usando fetch direto')
              
              const requestBody: any = {
                model: model,
                prompt: prompt,
                size: size,
                quality: quality,
                n: 1,
              }
              
              const apiResponse = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              })

              if (!apiResponse.ok) {
                const errorData = await apiResponse.json().catch(() => ({}))
                throw new Error(errorData.error?.message || `API retornou erro: ${apiResponse.status}`)
              }

              response = await apiResponse.json()
            }

            // Extrair URL da imagem gerada
            let imageUrl = response?.data?.[0]?.url || response?.data?.[0]?.b64_json
            
            console.log('[callImageGeneration] Resposta da API completa:', JSON.stringify(response, null, 2))
            console.log('[callImageGeneration] imageUrl extraído:', imageUrl ? imageUrl.substring(0, 100) : 'null')
            
            if (!imageUrl) {
              console.error('[callImageGeneration] Resposta da API:', JSON.stringify(response, null, 2))
              throw new Error('Resposta da API não contém URL de imagem')
            }
            
            // Garantir que a URL seja uma string válida
            imageUrl = String(imageUrl).trim()
            if (!imageUrl) {
              throw new Error('URL de imagem está vazia')
            }
            
            // Se é base64, converter para data URL
            let finalImageUrl = imageUrl
            if (imageUrl.startsWith('iVBORw0KGg') || imageUrl.startsWith('/9j/')) {
              // É base64 sem prefixo data:, adicionar prefixo
              const mimeType = imageUrl.startsWith('iVBORw0KGg') ? 'image/png' : 'image/jpeg'
              finalImageUrl = `data:${mimeType};base64,${imageUrl}`
              console.log('[callImageGeneration] Convertido base64 para data URL, tamanho:', finalImageUrl.length)
            } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:')) {
              console.warn('[callImageGeneration] URL pode estar em formato inválido:', imageUrl.substring(0, 100))
            }

            // Calcular custo: $0.04 por imagem (GPT-Image-1) ou $0.02 (GPT-Image-1 Mini)
            const pricing = MODEL_PRICING[`openai:${model}`] || DEFAULT_PRICING
            const cost = pricing.input
            const latency = Date.now() - startTime

            // Construir resposta em formato de mensagem com imagem
            let content = `🖼️ **Imagem gerada com ${modelName}!**\n\n`
            
            // Incluir a imagem no markdown
            content += `![Imagem gerada](${finalImageUrl})\n\n`
            
            console.log('[callImageGeneration] Conteúdo final (primeiros 200 chars):', content.substring(0, 200))
            
            content += `**Parâmetros:**\n`
            content += `- Resolução: ${size}\n`
            content += `- Qualidade: ${quality}\n`
            content += `\n**Tempo de processamento:** ${(latency / 1000).toFixed(1)}s\n**Custo:** $${cost.toFixed(4)} ($${pricing.input.toFixed(2)}/imagem)`

            // Enviar o conteúdo completo
            controller.enqueue(encoder.encode(content))
            controller.close()
          } catch (error: any) {
            console.error('[callImageGeneration] Erro no stream:', error)
            
            // Mensagens de erro específicas
            let errorMessage = `Erro ao gerar imagem com ${modelName}: ${error.message || error}`
            if (error.message?.includes('images') || error.code === 'invalid_api_function' || error.message?.includes('404')) {
              const docUrl = isMini 
                ? 'https://platform.openai.com/docs/models/gpt-image-1-mini'
                : 'https://platform.openai.com/docs/models/gpt-image-1'
              errorMessage = `API do ${modelName} ainda não está disponível ou requer acesso especial. Verifique: ${docUrl}. Erro: ${error.message}`
            } else if (error.message?.includes('prompt') || error.message?.includes('conteúdo')) {
              errorMessage = `Erro no prompt de geração de imagem: ${error.message}`
            }
            
            controller.enqueue(encoder.encode(`❌ ${errorMessage}`))
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
    // Valores suportados: 'low', 'medium', 'high', 'auto'
    let quality = 'auto' // Padrão
    if (promptLower.includes('hd') || promptLower.includes('alta qualidade') || promptLower.includes('high quality') || promptLower.includes('máxima qualidade')) {
      quality = 'high'
    } else if (promptLower.includes('baixa qualidade') || promptLower.includes('low quality')) {
      quality = 'low'
    } else if (promptLower.includes('qualidade média') || promptLower.includes('medium quality')) {
      quality = 'medium'
    }

    // Chamar a API de geração de imagens
    // Documentação oficial: https://platform.openai.com/docs/models/gpt-image-1
    // Nota: A API pode não suportar o parâmetro 'style' ainda
    let response: any
    
    try {
      // Tentar usar a API de imagens se disponível no SDK
      const requestBody: any = {
        model: model,
        prompt: prompt,
        size: size,
        quality: quality,
        n: 1, // Gerar 1 imagem por padrão
      }
      
      response = await (openai as any).images?.generate?.(requestBody)
    } catch (sdkError: any) {
      // Se o SDK não suportar, usar fetch diretamente
      console.log('[callImageGeneration] SDK não suporta, usando fetch direto')
      
      const requestBody: any = {
        model: model,
        prompt: prompt,
        size: size,
        quality: quality,
        n: 1,
      }
      
      const apiResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `API retornou erro: ${apiResponse.status}`)
      }

      response = await apiResponse.json()
    }

    // Extrair URL da imagem gerada
    let imageUrl = response?.data?.[0]?.url || response?.data?.[0]?.b64_json
    
    console.log('[callImageGeneration] Resposta da API completa:', JSON.stringify(response, null, 2))
    console.log('[callImageGeneration] imageUrl extraído:', imageUrl ? imageUrl.substring(0, 100) : 'null')
    
    if (!imageUrl) {
      console.error('[callImageGeneration] Resposta da API:', JSON.stringify(response, null, 2))
      throw new Error('Resposta da API não contém URL de imagem')
    }
    
    // Garantir que a URL seja uma string válida
    imageUrl = String(imageUrl).trim()
    if (!imageUrl) {
      throw new Error('URL de imagem está vazia')
    }
    
    // Se é base64, converter para data URL
    let finalImageUrl = imageUrl
    if (imageUrl.startsWith('iVBORw0KGg') || imageUrl.startsWith('/9j/')) {
      // É base64 sem prefixo data:, adicionar prefixo
      const mimeType = imageUrl.startsWith('iVBORw0KGg') ? 'image/png' : 'image/jpeg'
      finalImageUrl = `data:${mimeType};base64,${imageUrl}`
      console.log('[callImageGeneration] Convertido base64 para data URL, tamanho:', finalImageUrl.length)
    } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:')) {
      console.warn('[callImageGeneration] URL pode estar em formato inválido:', imageUrl.substring(0, 100))
    }

    // Calcular custo: $0.04 por imagem (GPT-Image-1) ou $0.02 (GPT-Image-1 Mini)
    const pricing = MODEL_PRICING[`openai:${model}`] || DEFAULT_PRICING
    const cost = pricing.input

    const latency = Date.now() - startTime

    // Construir resposta em formato de mensagem com imagem
    let content = `🖼️ **Imagem gerada com ${modelName}!**\n\n`
    
    // Incluir a imagem no markdown
    content += `![Imagem gerada](${finalImageUrl})\n\n`
    
    console.log('[callImageGeneration] Conteúdo final (primeiros 200 chars):', content.substring(0, 200))
    
    content += `**Parâmetros:**\n`
    content += `- Resolução: ${size}\n`
    content += `- Qualidade: ${quality}\n`
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

