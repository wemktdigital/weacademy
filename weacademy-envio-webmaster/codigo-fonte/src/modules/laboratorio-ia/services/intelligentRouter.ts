// Sistema de Routing Inteligente de Modelos
// Detecta automaticamente o melhor modelo para cada tarefa

import { AVAILABLE_MODELS, LLMModel } from '../config/models'
import { optimizeRecommendations, recordModelPerformance, learnUserPreferences } from './routingOptimizer'
import { MODEL_PRICING } from '../config/pricing'

export type TaskCategory = 
  | 'text-analysis'      // Análise de texto simples
  | 'text-generation'    // Geração de texto criativo
  | 'code-generation'    // Geração de código
  | 'code-analysis'      // Análise/revisão de código
  | 'image-analysis'     // Análise de imagens
  | 'image-generation'    // Geração de imagens
  | 'image-editing'      // Edição de imagens
  | 'audio-analysis'     // Análise de áudio
  | 'audio-transcription' // Transcrição de áudio
  | 'music-generation'   // Geração de música
  | 'video-analysis'     // Análise de vídeo
  | 'video-generation'   // Geração de vídeo
  | 'multi-modal'        // Múltiplas mídias
  | 'medical-analysis'   // Análise médica especializada
  | 'reasoning'          // Raciocínio complexo
  | 'translation'        // Tradução
  | 'summarization'      // Resumo
  | 'qa'                 // Perguntas e respostas
  | 'chat'               // Conversa geral

export interface TaskCharacteristics {
  category: TaskCategory
  hasImages?: boolean
  hasAudio?: boolean
  hasVideo?: boolean
  requiresReasoning?: boolean
  requiresSpeed?: boolean
  requiresAccuracy?: boolean
  maxCost?: number  // Custo máximo desejado (em dólares)
  language?: string  // Idioma da tarefa
  complexity?: 'low' | 'medium' | 'high'
}

export interface ModelRecommendation {
  provider: string
  model: string
  score: number  // 0-100, quanto maior melhor
  reason: string  // Motivo da recomendação
  estimatedCost?: number
  estimatedLatency?: number  // ms
}

export interface RoutingResult {
  recommended: ModelRecommendation
  alternatives: ModelRecommendation[]
  fallbackChain: Array<{ provider: string; model: string }>
}

// Matriz de recomendações por categoria de tarefa
const TASK_MODEL_MATRIX: Record<TaskCategory, ModelRecommendation[]> = {
  'text-analysis': [
    { provider: 'Google', model: 'gemini-2.5-flash', score: 95, reason: 'Análise rápida e econômica' },
    { provider: 'DeepSeek', model: 'deepseek-chat', score: 90, reason: 'Boa relação custo/benefício' },
    { provider: 'OpenAI', model: 'gpt-4o-mini', score: 85, reason: 'Alta qualidade' },
  ],
  'text-generation': [
    { provider: 'OpenAI', model: 'gpt-5.1', score: 98, reason: 'Melhor criatividade e qualidade' },
    { provider: 'Google', model: 'gemini-3-pro-preview-high', score: 97, reason: 'Melhor modelo Google, raciocínio avançado' },
    { provider: 'OpenAI', model: 'gpt-4o', score: 95, reason: 'Excelente criatividade' },
    { provider: 'Google', model: 'gemini-2.5-pro', score: 90, reason: 'Excelente geração' },
    { provider: 'OpenAI', model: 'gpt-4o-mini', score: 80, reason: 'Boa qualidade, menor custo' },
  ],
  'code-generation': [
    { provider: 'OpenAI', model: 'gpt-5.1', score: 98, reason: 'Melhor para código e raciocínio' },
    { provider: 'Google', model: 'gemini-3-pro-preview-high', score: 97, reason: 'Melhor modelo Google, excelente para código e raciocínio avançado' },
    { provider: 'OpenAI', model: 'gpt-4o', score: 95, reason: 'Excelente para código' },
    { provider: 'DeepSeek', model: 'deepseek-chat', score: 90, reason: 'Especializado em código' },
    { provider: 'Google', model: 'gemini-2.5-pro', score: 85, reason: 'Boas capacidades de código' },
  ],
  'code-analysis': [
    { provider: 'OpenAI', model: 'gpt-5.1', score: 98, reason: 'Melhor análise de código e raciocínio' },
    { provider: 'Google', model: 'gemini-3-pro-preview-high', score: 97, reason: 'Melhor modelo Google, raciocínio profundo para análise de código' },
    { provider: 'OpenAI', model: 'gpt-4o', score: 95, reason: 'Excelente análise de código' },
    { provider: 'DeepSeek', model: 'deepseek-reasoner', score: 92, reason: 'Raciocínio profundo' },
    { provider: 'Google', model: 'gemini-2.5-pro', score: 85, reason: 'Análise detalhada' },
  ],
  'image-analysis': [
    { provider: 'Google', model: 'gemini-3-pro-preview-high', score: 99, reason: 'Melhor modelo Google, análise multimodal avançada' },
    { provider: 'Google', model: 'gemini-2.5-pro', score: 98, reason: 'Melhor análise multimodal' },
    { provider: 'OpenAI', model: 'gpt-5.1', score: 97, reason: 'Excelente visão e análise' },
    { provider: 'OpenAI', model: 'gpt-4o', score: 95, reason: 'Excelente visão' },
    { provider: 'Google', model: 'gemini-2.5-flash', score: 85, reason: 'Rápido e econômico' },
  ],
  'audio-analysis': [
    { provider: 'Google', model: 'gemini-2.5-pro', score: 95, reason: 'Suporte nativo a áudio' },
    { provider: 'OpenAI', model: 'gpt-4o', score: 85, reason: 'Boa compreensão' },
  ],
  'audio-transcription': [
    { provider: 'OpenAI', model: 'gpt-4o-transcribe-diarize', score: 100, reason: 'Melhor para conversas com múltiplos falantes (diarização)' },
    { provider: 'OpenAI', model: 'gpt-4o-transcribe', score: 99, reason: 'Melhor precisão e suporte a múltiplos idiomas' },
    { provider: 'OpenAI', model: 'gpt-4o-mini-transcribe', score: 98, reason: 'Especializado em transcrição de áudio' },
    { provider: 'Google', model: 'gemini-2.5-pro', score: 90, reason: 'Boa transcrição multimodal' },
    { provider: 'Google', model: 'gemini-2.5-flash', score: 85, reason: 'Transcrição rápida' },
  ],
  'music-generation': [
    { provider: 'Google', model: 'lyria-realtime-exp', score: 100, reason: 'Modelo especializado em geração de música instrumental em tempo real via WebSocket' },
  ],
  'video-analysis': [
    { provider: 'Google', model: 'gemini-2.5-pro', score: 98, reason: 'Melhor análise de vídeo' },
    { provider: 'OpenAI', model: 'gpt-4o', score: 90, reason: 'Suporte a vídeo' },
  ],
  'video-generation': [
    { provider: 'OpenAI', model: 'sora-2-pro', score: 98, reason: 'Melhor qualidade de vídeo gerado' },
    { provider: 'OpenAI', model: 'sora-2', score: 95, reason: 'Excelente geração de vídeo' },
    { provider: 'Google', model: 'veo-3.1-generate-preview', score: 90, reason: 'Boa alternativa' },
    { provider: 'Replicate', model: 'bytedance/seedance-1-pro-fast', score: 85, reason: 'Opção econômica' },
  ],
  'image-generation': [
    { provider: 'OpenAI', model: 'gpt-image-1', score: 98, reason: 'Melhor qualidade e controle de estilo' },
    { provider: 'Replicate', model: 'black-forest-labs/flux-1.1-pro', score: 97, reason: 'Excelente qualidade e aderência ao prompt' },
    { provider: 'Replicate', model: 'black-forest-labs/flux-krea-dev', score: 96, reason: 'Fotorealismo excepcional que evita o "AI look" oversaturado, estética distintiva' },
    { provider: 'Replicate', model: 'ideogram-ai/ideogram-v3-quality', score: 95, reason: 'Máxima qualidade, renderização precisa de texto e fotorealismo superior' },
    { provider: 'Replicate', model: 'ideogram-ai/ideogram-v3-balanced', score: 94, reason: 'Bom equilíbrio entre velocidade e qualidade' },
    { provider: 'Replicate', model: 'bytedance/seedream-4', score: 93, reason: 'Geração e edição unificadas, suporte a 4K' },
    { provider: 'Replicate', model: 'ideogram-ai/ideogram-v3-turbo', score: 92, reason: 'Excelente renderização de texto e fotorealismo' },
    { provider: 'Replicate', model: 'ideogram-ai/ideogram-character', score: 91, reason: 'Geração de personagens consistentes a partir de referência' },
    { provider: 'OpenAI', model: 'gpt-image-1-mini', score: 90, reason: 'Versão econômica com boa qualidade' },
  ],
  'image-editing': [
    { provider: 'Replicate', model: 'black-forest-labs/flux-kontext-max', score: 100, reason: 'Máxima performance em edição de imagem, geração de tipografia melhorada, melhor em classe' },
    { provider: 'Replicate', model: 'black-forest-labs/flux-kontext-pro', score: 99, reason: 'Performance state-of-the-art com alta qualidade, excelente seguimento de prompt e resultados consistentes' },
    { provider: 'Replicate', model: 'black-forest-labs/flux-kontext-dev', score: 98, reason: 'Versão open-weight com boa performance, uso comercial disponível' },
    { provider: 'Replicate', model: 'bytedance/seedream-4', score: 95, reason: 'Geração e edição unificadas, suporte a 4K' },
  ],
  'multi-modal': [
    { provider: 'Google', model: 'gemini-2.5-pro', score: 98, reason: 'Melhor multimodal' },
    { provider: 'OpenAI', model: 'gpt-5.1', score: 97, reason: 'Excelente multimodal aprimorado' },
    { provider: 'OpenAI', model: 'gpt-4o', score: 95, reason: 'Excelente multimodal' },
  ],
  'medical-analysis': [
    { provider: 'PubMed', model: 'pubmed-search', score: 100, reason: 'Busca especializada em artigos científicos médicos' },
    { provider: 'Google', model: 'gemini-2.5-pro', score: 95, reason: 'Melhor para análise médica multimodal' },
    { provider: 'OpenAI', model: 'gpt-5.1', score: 93, reason: 'Alta precisão médica' },
    { provider: 'OpenAI', model: 'gpt-4o', score: 90, reason: 'Alta precisão' },
    { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022', score: 88, reason: 'Análise detalhada' },
  ],
  'reasoning': [
    { provider: 'OpenAI', model: 'gpt-5.1', score: 100, reason: 'Melhor raciocínio e capacidade de pensamento' },
    { provider: 'Google', model: 'gemini-3-pro-preview-high', score: 99, reason: 'Melhor modelo Google, raciocínio avançado com thinking_level high' },
    { provider: 'DeepSeek', model: 'deepseek-reasoner', score: 95, reason: 'Especializado em raciocínio' },
    { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022', score: 92, reason: 'Raciocínio profundo' },
    { provider: 'OpenAI', model: 'gpt-4o', score: 90, reason: 'Boa capacidade de raciocínio' },
  ],
  'translation': [
    { provider: 'Google', model: 'gemini-2.5-flash', score: 95, reason: 'Rápido e preciso para tradução' },
    { provider: 'OpenAI', model: 'gpt-4o-mini', score: 90, reason: 'Boa qualidade' },
    { provider: 'DeepSeek', model: 'deepseek-chat', score: 85, reason: 'Custo-benefício' },
  ],
  'summarization': [
    { provider: 'Google', model: 'gemini-2.5-flash', score: 95, reason: 'Rápido e eficiente' },
    { provider: 'OpenAI', model: 'gpt-4o-mini', score: 90, reason: 'Boa qualidade' },
    { provider: 'DeepSeek', model: 'deepseek-chat', score: 85, reason: 'Econômico' },
  ],
  'qa': [
    { provider: 'Google', model: 'gemini-2.5-flash', score: 95, reason: 'Rápido para Q&A' },
    { provider: 'OpenAI', model: 'gpt-4o-mini', score: 90, reason: 'Respostas precisas' },
    { provider: 'DeepSeek', model: 'deepseek-chat', score: 85, reason: 'Bom custo-benefício' },
  ],
  'chat': [
    { provider: 'Google', model: 'gemini-2.5-flash', score: 95, reason: 'Rápido e natural' },
    { provider: 'OpenAI', model: 'gpt-4o-mini', score: 90, reason: 'Conversação fluida' },
    { provider: 'DeepSeek', model: 'deepseek-chat', score: 85, reason: 'Econômico' },
  ],
}

/**
 * Detecta a categoria da tarefa baseado nas características
 */
export function detectTaskCategory(characteristics: TaskCharacteristics): TaskCategory {
  const { category, hasImages, hasAudio, hasVideo } = characteristics

  // Se já foi especificado, usar
  if (category) return category

  // Detectar baseado em mídia
  if (hasVideo || (hasImages && hasAudio)) {
    return 'multi-modal'
  }
  if (hasVideo) return 'video-analysis'
  if (hasAudio) return 'audio-analysis'
  // image-editing é detectado em analyzePrompt, não aqui
  if (hasImages) return 'image-analysis'

  // Detectar baseado em complexidade
  if (characteristics.requiresReasoning) {
    return 'reasoning'
  }

  // Padrão: chat geral
  return 'chat'
}

/**
 * Analisa o prompt para detectar características da tarefa
 */
export function analyzePrompt(prompt: string, messages: Array<{ role: string; content: string }> = []): TaskCharacteristics {
  const lowerPrompt = prompt.toLowerCase()
  const allContent = [prompt, ...messages.map(m => String(m.content || ''))].join(' ').toLowerCase()

  // Detectar mídia
  const hasImages = allContent.includes('imagem') || allContent.includes('foto') || 
                    allContent.includes('image') || allContent.includes('photo') ||
                    messages.some(m => typeof m.content === 'string' && m.content.includes('data:image'))
  
  const hasAudio = allContent.includes('áudio') || allContent.includes('audio') ||
                   messages.some(m => typeof m.content === 'string' && m.content.includes('data:audio'))
  
  const hasVideo = allContent.includes('vídeo') || allContent.includes('video') ||
                   messages.some(m => typeof m.content === 'string' && m.content.includes('data:video'))

  // Detectar categoria por palavras-chave
  let category: TaskCategory = 'chat'
  
  if (hasVideo || (hasImages && hasAudio)) {
    category = 'multi-modal'
  } else if (hasVideo) {
    category = 'video-analysis'
  } else if (hasAudio) {
    // Detectar se é transcrição ou análise
    if (allContent.includes('transcrever') || allContent.includes('transcrição') || allContent.includes('transcribe') || allContent.includes('transcription')) {
      // Detectar se precisa de diarização (múltiplos falantes)
      if (allContent.includes('diarização') || allContent.includes('diarize') || allContent.includes('falantes') || allContent.includes('speakers') || allContent.includes('quem falou') || allContent.includes('identificar falantes') || allContent.includes('múltiplos participantes') || allContent.includes('conversa') || allContent.includes('reunião') || allContent.includes('entrevista')) {
        category = 'audio-transcription' // O routing inteligente escolherá o modelo diarize
      } else {
        category = 'audio-transcription'
      }
    } else {
      category = 'audio-analysis'
    }
  } else if (hasImages) {
    // Verificar se é edição de imagem (requer imagem anexada + palavras-chave de edição)
    const hasImageAttachment = messages.some((m: any) => 
      m.attachments && Array.isArray(m.attachments) && 
      m.attachments.some((a: any) => a.type === 'image')
    )
    
    const hasEditingKeywords = allContent.includes('editar') ||
                              allContent.includes('edit') ||
                              allContent.includes('modificar') ||
                              allContent.includes('modify') ||
                              allContent.includes('alterar') ||
                              allContent.includes('change') ||
                              allContent.includes('trocar') ||
                              allContent.includes('substituir') ||
                              allContent.includes('replace') ||
                              allContent.includes('remover') ||
                              allContent.includes('remove') ||
                              allContent.includes('adicionar') ||
                              allContent.includes('add') ||
                              allContent.includes('mudar') ||
                              allContent.includes('transformar') ||
                              allContent.includes('transform') ||
                              allContent.includes('estilo') ||
                              allContent.includes('style') ||
                              allContent.includes('fundo') ||
                              allContent.includes('background')
    
    if (hasImageAttachment && hasEditingKeywords) {
      category = 'image-editing'
    } else {
      // Verificar se é geração de personagem (requer imagem de referência)
      const hasCharacterKeywords = allContent.includes('personagem') || 
                                   allContent.includes('character') ||
                                   allContent.includes('variação') ||
                                   allContent.includes('variation') ||
                                   allContent.includes('consistente') ||
                                   allContent.includes('consistent') ||
                                   allContent.includes('mesmo personagem') ||
                                   allContent.includes('same character')
      
      if (hasCharacterKeywords && hasImageAttachment) {
        category = 'image-generation' // Ideogram Character será sugerido
      } else if (allContent.includes('gerar imagem') || allContent.includes('criar imagem') || allContent.includes('generate image') || allContent.includes('create image') || allContent.includes('desenhar') || allContent.includes('draw') || allContent.includes('pintar') || allContent.includes('paint')) {
        category = 'image-generation'
      } else {
        category = 'image-analysis'
      }
    }
  } else if (allContent.includes('logo') || allContent.includes('design gráfico') || allContent.includes('graphic design') || allContent.includes('tipografia') || allContent.includes('typography') || allContent.includes('marca') || allContent.includes('branding') || allContent.includes('publicidade') || allContent.includes('advertising') || allContent.includes('marketing') || allContent.includes('texto na imagem') || allContent.includes('text in image')) {
    // Casos específicos de design gráfico - Ideogram é ideal
    category = 'image-generation'
  } else if (allContent.includes('gerar música') || allContent.includes('criar música') || allContent.includes('generate music') || allContent.includes('create music') || 
             allContent.includes('compor') || allContent.includes('compose') || allContent.includes('música') || allContent.includes('music') ||
             allContent.includes('lyria') || allContent.includes('realtime') || allContent.includes('bpm') ||
             allContent.includes('techno') || allContent.includes('jazz') || allContent.includes('rock') || 
             allContent.includes('instrumental') || allContent.includes('melodia') || allContent.includes('melody') ||
             allContent.includes('beat') || allContent.includes('ritmo') || allContent.includes('rhythm')) {
    category = 'music-generation'
  } else if (allContent.includes('gerar vídeo') || allContent.includes('criar vídeo') || allContent.includes('generate video') || allContent.includes('create video') || allContent.includes('sora')) {
    category = 'video-generation'
  } else if (allContent.includes('código') || allContent.includes('code') || allContent.includes('programar')) {
    category = allContent.includes('analisar') || allContent.includes('review') ? 'code-analysis' : 'code-generation'
  } else if (allContent.includes('traduzir') || allContent.includes('translate')) {
    category = 'translation'
  } else if (allContent.includes('resumir') || allContent.includes('resumo') || allContent.includes('summary')) {
    category = 'summarization'
  } else if (allContent.includes('médico') || allContent.includes('medical') || allContent.includes('diagnóstico') || 
             allContent.includes('pubmed') || allContent.includes('artigo científico') || 
             allContent.includes('scientific article') || allContent.includes('pesquisa médica') ||
             allContent.includes('medical research') || allContent.includes('estudo científico') ||
             allContent.includes('scientific study') || allContent.includes('literatura médica') ||
             allContent.includes('medical literature')) {
    category = 'medical-analysis'
  } else if (allContent.includes('por que') || allContent.includes('raciocinar') || allContent.includes('reasoning')) {
    category = 'reasoning'
  } else if (allContent.includes('gerar') || allContent.includes('criar') || allContent.includes('escrever')) {
    category = 'text-generation'
  } else if (allContent.includes('analisar') || allContent.includes('analise')) {
    category = 'text-analysis'
  }

  // Detectar complexidade
  const requiresReasoning = allContent.includes('raciocinar') || allContent.includes('pensar') ||
                           allContent.includes('explique') || allContent.includes('por que')
  
  const requiresSpeed = allContent.includes('rápido') || allContent.includes('urgente') ||
                       allContent.includes('fast') || allContent.includes('quick')
  
  const requiresAccuracy = allContent.includes('preciso') || allContent.includes('exato') ||
                          allContent.includes('accurate') || allContent.includes('precise')

  return {
    category,
    hasImages,
    hasAudio,
    hasVideo,
    requiresReasoning,
    requiresSpeed,
    requiresAccuracy,
    complexity: requiresReasoning ? 'high' : (hasImages || hasAudio || hasVideo ? 'medium' : 'low'),
  }
}

/**
 * Filtra modelos baseado nas capacidades necessárias
 */
function filterModelsByCapabilities(
  characteristics: TaskCharacteristics,
  models: LLMModel[]
): LLMModel[] {
  if (!characteristics.hasImages && !characteristics.hasAudio && !characteristics.hasVideo) {
    // Tarefa apenas de texto - todos os modelos servem
    return models
  }

  return models.filter(model => {
    if (!model.capabilities) return false

    const needsImage = characteristics.hasImages && model.capabilities.input.includes('image')
    const needsAudio = characteristics.hasAudio && model.capabilities.input.includes('audio')
    const needsVideo = characteristics.hasVideo && model.capabilities.input.includes('video')

    if (characteristics.hasImages && !needsImage) return false
    if (characteristics.hasAudio && !needsAudio) return false
    if (characteristics.hasVideo && !needsVideo) return false

    return true
  })
}

/**
 * Calcula custo estimado baseado no tamanho do prompt
 */
function estimateCost(
  provider: string,
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number = 500
): number {
  const pricingKey = `${provider.toLowerCase()}:${model}`
  const pricing = MODEL_PRICING[pricingKey]
  
  if (!pricing) return 0

  const inputCost = (estimatedInputTokens / 1_000_000) * pricing.input
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.output

  return inputCost + outputCost
}

/**
 * Ajusta recomendações baseado em preferências de custo e velocidade
 */
function adjustRecommendationsByPreferences(
  recommendations: ModelRecommendation[],
  characteristics: TaskCharacteristics,
  estimatedTokens: number,
  prompt?: string
): ModelRecommendation[] {
  const promptLower = (prompt || '').toLowerCase()
  
  // Detectar se é geração de personagem
  const isCharacterGeneration = (promptLower.includes('personagem') || 
                                 promptLower.includes('character') ||
                                 promptLower.includes('variação') ||
                                 promptLower.includes('variation') ||
                                 promptLower.includes('consistente') ||
                                 promptLower.includes('consistent')) &&
                                characteristics.hasImages
  
  return recommendations.map(rec => {
    let score = rec.score
    let reason = rec.reason

    // Boost para Ideogram Character quando detecta geração de personagem
    if (isCharacterGeneration && rec.model === 'ideogram-ai/ideogram-character') {
      score += 10
      reason = 'Ideal para geração de personagens consistentes'
    }

    // Boost para Ideogram v3 Quality quando detecta necessidade de máxima qualidade
    const needsMaxQuality = promptLower.includes('máxima qualidade') ||
                           promptLower.includes('maximum quality') ||
                           promptLower.includes('melhor qualidade') ||
                           promptLower.includes('best quality') ||
                           promptLower.includes('alta qualidade') ||
                           promptLower.includes('high quality') ||
                           promptLower.includes('premium') ||
                           promptLower.includes('profissional') ||
                           promptLower.includes('professional')
    
    if (needsMaxQuality && rec.model === 'ideogram-ai/ideogram-v3-quality') {
      score += 8
      reason = 'Máxima qualidade disponível'
    } else if (needsMaxQuality && rec.model === 'ideogram-ai/ideogram-v3-balanced') {
      // Reduzir score do Balanced quando precisa de máxima qualidade
      score -= 3
      reason += ' (considere Quality para máxima qualidade)'
    } else if (needsMaxQuality && rec.model === 'ideogram-ai/ideogram-v3-turbo') {
      // Reduzir score do Turbo quando precisa de máxima qualidade
      score -= 5
      reason += ' (considere Quality para máxima qualidade)'
    }

    // Boost para Balanced quando detecta necessidade de equilíbrio
    const needsBalance = promptLower.includes('equilíbrio') ||
                        promptLower.includes('balance') ||
                        promptLower.includes('intermediário') ||
                        promptLower.includes('intermediate') ||
                        promptLower.includes('moderado') ||
                        promptLower.includes('moderate')
    
    if (needsBalance && rec.model === 'ideogram-ai/ideogram-v3-balanced') {
      score += 5
      reason = 'Equilíbrio ideal entre velocidade e qualidade'
    }

    // Boost para FLUX Krea quando detecta necessidade de fotorealismo sem "AI look"
    const needsPhotorealism = promptLower.includes('fotorealismo') ||
                             promptLower.includes('photorealistic') ||
                             promptLower.includes('realista') ||
                             promptLower.includes('realistic') ||
                             promptLower.includes('sem ai look') ||
                             promptLower.includes('no ai look') ||
                             promptLower.includes('natural') ||
                             promptLower.includes('orgânico') ||
                             promptLower.includes('organic')
    
    if (needsPhotorealism && rec.model === 'black-forest-labs/flux-krea-dev') {
      score += 7
      reason = 'Fotorealismo excepcional sem o "AI look" oversaturado'
    }

    // Boost para FLUX Kontext quando detecta edição de texto/tipografia
    const needsTextEditing = promptLower.includes('texto') ||
                            promptLower.includes('text') ||
                            promptLower.includes('tipografia') ||
                            promptLower.includes('typography') ||
                            promptLower.includes('substituir texto') ||
                            promptLower.includes('replace text') ||
                            promptLower.includes('trocar texto') ||
                            promptLower.includes('change text') ||
                            promptLower.includes('"') // Aspas indicam edição de texto
    
    if (needsTextEditing) {
      if (rec.model === 'black-forest-labs/flux-kontext-max') {
        score += 10
        reason = 'Melhor em classe para edição de texto e tipografia melhorada'
      } else if (rec.model === 'black-forest-labs/flux-kontext-pro') {
        score += 9
        reason = 'Excelente para edição de texto com alta qualidade e seguimento de prompt'
      } else if (rec.model === 'black-forest-labs/flux-kontext-dev') {
        score += 8
        reason = 'Excelente para edição de texto, versão open-weight'
      }
    }

    // Boost para PubMed quando detecta busca de artigos científicos
    const needsPubMedSearch = promptLower.includes('pubmed') ||
                             promptLower.includes('artigo científico') ||
                             promptLower.includes('scientific article') ||
                             promptLower.includes('pesquisa médica') ||
                             promptLower.includes('medical research') ||
                             promptLower.includes('estudo científico') ||
                             promptLower.includes('scientific study') ||
                             promptLower.includes('literatura médica') ||
                             promptLower.includes('medical literature') ||
                             promptLower.includes('buscar artigos') ||
                             promptLower.includes('search articles') ||
                             promptLower.includes('encontrar estudos') ||
                             promptLower.includes('find studies')
    
    if (needsPubMedSearch && rec.model === 'pubmed-search') {
      score += 15
      reason = 'Busca especializada em artigos científicos do PubMed'
    }

    // Ajustar por velocidade
    if (characteristics.requiresSpeed) {
      const fastModels = ['gemini-2.5-flash', 'gpt-4o-mini', 'deepseek-chat']
      if (fastModels.includes(rec.model)) {
        score += 5
        reason += ' (rápido)'
      } else {
        score -= 5
      }
    }

    // Ajustar por precisão
    if (characteristics.requiresAccuracy) {
      const accurateModels = ['gpt-5.1', 'gpt-5', 'gpt-4o', 'gemini-2.5-pro', 'claude-3-5-sonnet-20241022']
      if (accurateModels.includes(rec.model)) {
        score += 5
        reason += ' (preciso)'
      }
    }

    // Ajustar por custo máximo
    if (characteristics.maxCost) {
      const cost = estimateCost(rec.provider, rec.model, estimatedTokens)
      rec.estimatedCost = cost
      
      if (cost > characteristics.maxCost) {
        score -= 20
        reason += ' (acima do orçamento)'
      } else if (cost < characteristics.maxCost * 0.5) {
        score += 5
        reason += ' (econômico)'
      }
    }

    return {
      ...rec,
      score: Math.max(0, Math.min(100, score)),
      reason,
    }
  }).sort((a, b) => b.score - a.score)
}

/**
 * Gera recomendações de modelos baseado nas características da tarefa
 */
export function recommendModels(
  characteristics: TaskCharacteristics,
  estimatedTokens: number = 1000,
  prompt?: string
): RoutingResult {
  const category = detectTaskCategory(characteristics)
  
  // Obter recomendações base para a categoria
  let recommendations = [...(TASK_MODEL_MATRIX[category] || TASK_MODEL_MATRIX['chat'])]

  // Filtrar por capacidades
  const availableModels = AVAILABLE_MODELS.filter(m => {
    const matchingRec = recommendations.find(r => 
      r.provider.toLowerCase() === m.provider.toLowerCase() && r.model === m.model
    )
    return matchingRec !== undefined
  })

  const capableModels = filterModelsByCapabilities(characteristics, availableModels)
  
  // Filtrar recomendações para apenas modelos com capacidades adequadas
  recommendations = recommendations.filter(rec =>
    capableModels.some(m => 
      m.provider.toLowerCase() === rec.provider.toLowerCase() && m.model === rec.model
    )
  )

  // Se não houver recomendações com capacidades adequadas, usar todas
  if (recommendations.length === 0) {
    recommendations = [...TASK_MODEL_MATRIX[category] || TASK_MODEL_MATRIX['chat']]
  }

  // Ajustar por preferências
  recommendations = adjustRecommendationsByPreferences(recommendations, characteristics, estimatedTokens, prompt)

  // Gerar cadeia de fallback (top 3 modelos)
  const fallbackChain = recommendations.slice(0, 3).map(rec => ({
    provider: rec.provider,
    model: rec.model,
  }))

  return {
    recommended: recommendations[0],
    alternatives: recommendations.slice(1, 4),
    fallbackChain,
  }
}

/**
 * Routing inteligente: analisa o prompt e retorna o melhor modelo
 * FASE 2: Inclui otimização automática baseada em histórico
 */
export async function intelligentRoute(
  prompt: string,
  messages: Array<{ role: string; content: string }> = [],
  preferences?: {
    maxCost?: number
    requiresSpeed?: boolean
    requiresAccuracy?: boolean
  },
  userId?: string,
  enableOptimization: boolean = true
): Promise<RoutingResult> {
  const characteristics = analyzePrompt(prompt, messages)
  
  // Aplicar preferências do usuário
  if (preferences) {
    if (preferences.maxCost) characteristics.maxCost = preferences.maxCost
    if (preferences.requiresSpeed) characteristics.requiresSpeed = true
    if (preferences.requiresAccuracy) characteristics.requiresAccuracy = true
  }

  const estimatedTokens = estimateTokens(prompt + messages.map(m => String(m.content || '')).join(' '))
  
  // Obter recomendações base
  const baseResult = recommendModels(characteristics, estimatedTokens, prompt)

  // Se otimização está ativada e temos userId, otimizar baseado em histórico
  if (enableOptimization && userId) {
    try {
      // Aprender preferências do usuário para esta categoria
      const userPreferences = await learnUserPreferences(userId, characteristics.category)
      
      // Otimizar recomendações baseado em performance histórica
      const optimization = await optimizeRecommendations(
        [baseResult.recommended, ...baseResult.alternatives],
        characteristics.category,
        userId,
        preferences
      )

      // Aplicar preferências aprendidas do usuário
      const finalRecommendations = optimization.optimizedRecommendations.map(rec => {
        const userPref = userPreferences.preferredModels.find(
          p => p.provider === rec.provider && p.model === rec.model
        )
        
        if (userPref) {
          // Boost se usuário já aceitou este modelo antes
          return {
            ...rec,
            score: Math.min(100, rec.score + Math.round(userPref.score * 0.1)),
            reason: `${rec.reason} [Preferência aprendida]`,
          }
        }
        
        return rec
      }).sort((a, b) => b.score - a.score)

      return {
        recommended: finalRecommendations[0] || baseResult.recommended,
        alternatives: finalRecommendations.slice(1, 4),
        fallbackChain: finalRecommendations.slice(0, 3).map(r => ({
          provider: r.provider,
          model: r.model,
        })),
      }
    } catch (error) {
      console.error('[Routing] Erro na otimização, usando recomendações base:', error)
      // Em caso de erro, retornar recomendações base
      return baseResult
    }
  }

  return baseResult
}

// Helper para estimar tokens (simplificado)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

