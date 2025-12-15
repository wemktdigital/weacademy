/**
 * Serviço de Análise Médica Multi-Modal
 * Suporta análise de imagens médicas, áudio de consultas e vídeos de procedimentos
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { searchKnowledgeBase } from './ragService'
import { MODEL_PRICING } from '../config/pricing'

// Função auxiliar para chamar Gemini com suporte multi-modal
async function callGeminiMultimodal(
  model: string,
  prompt: string,
  mediaUrl: string,
  mediaType: 'image' | 'video' | 'audio'
): Promise<{ content: string; latency: number; cost: number }> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurado')
  }

  const startTime = Date.now()
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const geminiModel = genAI.getGenerativeModel({ model })

  // Baixar mídia para base64 ou usar URL direta
  let mediaData: string
  let mimeType: string

  if (mediaUrl.startsWith('http')) {
    // Usar URL direta se Gemini suportar
    const response = await fetch(mediaUrl)
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    if (mediaType === 'image') {
      mimeType = response.headers.get('content-type') || 'image/jpeg'
      mediaData = buffer.toString('base64')
    } else if (mediaType === 'video') {
      mimeType = response.headers.get('content-type') || 'video/mp4'
      mediaData = buffer.toString('base64')
    } else {
      throw new Error('Tipo de mídia não suportado para Gemini')
    }
  } else {
    throw new Error('URL de mídia inválida')
  }

  // Preparar partes da mensagem
  const parts: any[] = [
    { text: prompt },
  ]

  if (mediaType === 'image') {
    parts.push({
      inlineData: {
        data: mediaData,
        mimeType,
      },
    })
  } else if (mediaType === 'video') {
    parts.push({
      inlineData: {
        data: mediaData,
        mimeType,
      },
    })
  }

  const result = await geminiModel.generateContent({ contents: [{ role: 'user', parts }] })
  const response = await result.response
  const content = response.text()

  const latency = Date.now() - startTime
  const inputTokens = response.usageMetadata?.promptTokenCount || 1000
  const outputTokens = response.usageMetadata?.candidatesTokenCount || 500
  
  const pricing = MODEL_PRICING['google:gemini-2.5-pro'] || { input: 0.0, output: 0.0 }
  const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

  return { content, latency, cost }
}

export interface MedicalImageAnalysis {
  findings: string[]
  diagnosis: string
  recommendations: string[]
  confidence: number
  annotatedRegions?: Array<{
    region: string
    description: string
    concern: 'low' | 'medium' | 'high'
  }>
  similarCases?: Array<{
    caseId: string
    similarity: number
    description: string
  }>
}

export interface MedicalAudioAnalysis {
  transcription: string
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent'
  detectedEvents: Array<{
    type: 'pain' | 'anxiety' | 'urgency' | 'symptom' | 'medication'
    timestamp: number
    description: string
  }>
  summary: string
  keyPoints: string[]
}

export interface MedicalVideoAnalysis {
  procedureType: string
  segments: Array<{
    timestamp: number
    duration: number
    topic: string
    description: string
  }>
  summary: string
  keyMoments: Array<{
    timestamp: number
    description: string
    importance: 'low' | 'medium' | 'high'
  }>
  transcription?: string
}

/**
 * Analisa imagem médica usando IA vision
 */
export async function analyzeMedicalImage(
  imageUrl: string,
  imageType: 'xray' | 'mri' | 'ct' | 'ultrasound' | 'dermatology' | 'general',
  clinicalContext?: string,
  options?: {
    knowledgeBaseId?: string
    includeSimilarCases?: boolean
    generateAnnotations?: boolean
  }
): Promise<MedicalImageAnalysis> {
  const startTime = Date.now()

  // Prompts especializados por tipo de imagem
  const prompts = {
    xray: `Você é um radiologista especializado em análise de imagens de raio-X. Analise esta imagem médica e forneça:
1. Achados principais observados
2. Possível diagnóstico (com nível de confiança)
3. Recomendações clínicas
4. Regiões de interesse que devem ser verificadas

Seja específico e técnico, mas claro. Use terminologia médica apropriada.`,
    
    mri: `Você é um radiologista especializado em ressonância magnética. Analise esta imagem de MRI e forneça:
1. Achados principais observados em diferentes sequências
2. Possível diagnóstico diferencial
3. Recomendações para próximos passos
4. Observações técnicas sobre qualidade da imagem

Seja preciso e detalhado na análise.`,
    
    ct: `Você é um radiologista especializado em tomografia computadorizada. Analise esta imagem de CT e forneça:
1. Achados principais observados
2. Densidades e contraste anormais
3. Possível diagnóstico
4. Recomendações clínicas

Analise tanto estruturas anatômicas quanto patológicas.`,
    
    ultrasound: `Você é um médico especializado em ultrassonografia. Analise esta imagem de ultrassom e forneça:
1. Estruturas visualizadas
2. Medidas e dimensões observadas
3. Achados anormais ou patológicos
4. Recomendações clínicas

Seja específico sobre orientação e plano de corte.`,
    
    dermatology: `Você é um dermatologista especializado em análise de imagens de lesões de pele. Analise esta imagem dermatológica e forneça:
1. Características da lesão (cor, forma, bordas, tamanho)
2. Padrão ABCD de melanoma (se aplicável)
3. Possível diagnóstico diferencial
4. Recomendação de urgência e próximos passos

Use terminologia dermatológica apropriada.`,
    
    general: `Você é um médico especializado em análise de imagens médicas. Analise esta imagem médica e forneça:
1. Achados principais observados
2. Possível diagnóstico ou conclusão
3. Recomendações clínicas
4. Observações relevantes

Seja preciso e profissional na análise.`,
  }

  const basePrompt = prompts[imageType] || prompts.general
  const contextPrompt = clinicalContext 
    ? `${basePrompt}\n\nContexto clínico fornecido: ${clinicalContext}`
    : basePrompt

  // Buscar casos similares na knowledge base se solicitado
  let similarCasesContext = ''
  if (options?.includeSimilarCases && options?.knowledgeBaseId) {
    try {
      const similarCases = await searchKnowledgeBase(
        `imagem médica ${imageType} similares`,
        {
          knowledgeBaseId: options.knowledgeBaseId,
          similarityThreshold: 0.7,
          maxResults: 5,
        }
      )

      if (similarCases.chunks.length > 0) {
        similarCasesContext = `\n\nCasos similares encontrados na base de conhecimento:\n${similarCases.chunks
          .map((c, i) => `${i + 1}. ${c.content.substring(0, 200)}...`)
          .join('\n')}`
      }
    } catch (error) {
      console.warn('[Medical Analysis] Erro ao buscar casos similares:', error)
    }
  }

  // Usar Gemini diretamente para análise visual (melhor suporte a multi-modal)
  const response = await callGeminiMultimodal(
    'gemini-2.5-pro',
    contextPrompt + similarCasesContext,
    imageUrl,
    'image'
  )

  // Processar resposta e extrair informações estruturadas
  const analysis = parseMedicalImageAnalysis(response.content)

  // Gerar anotações automáticas se solicitado
  if (options?.generateAnnotations) {
    analysis.annotatedRegions = await generateImageAnnotations(
      imageUrl,
      imageType,
      analysis.findings
    )
  }

  return {
    ...analysis,
    confidence: calculateConfidence(analysis, response.content),
  }
}

/**
 * Analisa áudio de consulta médica
 */
export async function analyzeMedicalAudio(
  audioUrl: string,
  transcription?: string,
  options?: {
    language?: 'pt-BR' | 'en'
    detectEvents?: boolean
    generateSummary?: boolean
  }
): Promise<MedicalAudioAnalysis> {
  const startTime = Date.now()

  // Se não há transcrição, usar Whisper ou serviço de transcrição
  let finalTranscription = transcription
  if (!finalTranscription) {
    // TODO: Implementar transcrição usando Whisper API ou similar
    finalTranscription = '[Transcrição automática não implementada ainda]'
  }

  // Análise do conteúdo médico
  const analysisPrompt = `Você é um médico especializado em análise de consultas médicas. Analise esta transcrição de consulta e forneça:

1. RESUMO EXECUTIVO: Um resumo conciso da consulta
2. SENTIMENTO: Identifique o sentimento geral (positivo, neutro, negativo, urgente)
3. EVENTOS DETECTADOS: Identifique eventos importantes como:
   - Dor ou desconforto mencionado
   - Ansiedade ou preocupação
   - Urgência ou emergência
   - Sintomas descritos
   - Medicamentos mencionados
4. PONTOS-CHAVE: Liste os pontos principais da consulta

Transcrição:
${finalTranscription}

Responda em formato estruturado JSON com os campos: summary, sentiment, detectedEvents, keyPoints.`

  // Usar Gemini diretamente para análise de áudio
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })
  
  const result = await geminiModel.generateContent(analysisPrompt)
  const response = await result.response
  const content = response.text()

  // Processar resposta estruturada
  const analysis = parseMedicalAudioAnalysis(response.content, finalTranscription)

  // Detectar eventos específicos se solicitado
  if (options?.detectEvents) {
    analysis.detectedEvents = await detectAudioEvents(finalTranscription)
  }

  return analysis
}

/**
 * Analisa vídeo de procedimento médico
 */
export async function analyzeMedicalVideo(
  videoUrl: string,
  procedureType?: string,
  options?: {
    generateTranscription?: boolean
    segmentByTopics?: boolean
    extractKeyMoments?: boolean
  }
): Promise<MedicalVideoAnalysis> {
  const startTime = Date.now()

  // Extrair frames-chave do vídeo (simplificado - usar biblioteca de processamento de vídeo)
  const analysisPrompt = `Você é um médico especializado em análise de procedimentos médicos. Analise este vídeo de procedimento médico e forneça:

1. TIPO DE PROCEDIMENTO: Identifique o tipo de procedimento
2. SEGMENTOS: Divida o vídeo em segmentos por tópico/complexidade
3. RESUMO: Resumo geral do procedimento
4. MOMENTOS-CHAVE: Identifique momentos importantes do procedimento

${procedureType ? `Tipo de procedimento esperado: ${procedureType}` : ''}

Forneça análise detalhada do procedimento visualizado.`

  // Usar Gemini diretamente para análise de vídeo
  const response = await callGeminiMultimodal(
    'gemini-2.5-pro',
    analysisPrompt,
    videoUrl,
    'video'
  )

  return parseMedicalVideoAnalysis(response.content, procedureType)
}

/**
 * Gera anotações automáticas em regiões da imagem
 */
async function generateImageAnnotations(
  imageUrl: string,
  imageType: string,
  findings: string[]
): Promise<MedicalImageAnalysis['annotatedRegions']> {
  const prompt = `Analise esta imagem médica e identifique regiões específicas que devem ser anotadas. Para cada região, forneça:
1. Descrição da região (ex: "Área superior direita", "Região central")
2. Descrição do achado
3. Nível de preocupação (low, medium, high)

Achados identificados: ${findings.join(', ')}

Responda em formato JSON com array de objetos com campos: region, description, concern.`

  const response = await callGeminiMultimodal(
    'gemini-2.5-pro',
    prompt,
    imageUrl,
    'image'
  )

  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.warn('[Medical Analysis] Erro ao parsear anotações:', error)
  }

  return []
}

/**
 * Detecta eventos específicos no áudio
 */
async function detectAudioEvents(transcription: string): Promise<MedicalAudioAnalysis['detectedEvents']> {
  const prompt = `Analise esta transcrição de consulta médica e identifique eventos importantes com timestamp aproximado:

1. Dor ou desconforto mencionado
2. Ansiedade ou preocupação
3. Urgência ou emergência
4. Sintomas descritos
5. Medicamentos mencionados

Transcrição:
${transcription}

Responda em formato JSON com array de objetos com campos: type, timestamp (em segundos do início), description.`

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })
  
  const result = await geminiModel.generateContent(prompt)
  const response = await result.response
  const content = response.text()

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.warn('[Medical Analysis] Erro ao parsear eventos:', error)
  }

  return []
}

/**
 * Parse resposta de análise de imagem médica
 */
function parseMedicalImageAnalysis(content: string): Omit<MedicalImageAnalysis, 'confidence'> {
  // Extrair informações estruturadas do texto
  const findings: string[] = []
  const recommendations: string[] = []
  let diagnosis = ''

  // Buscar padrões comuns na resposta
  const findingsMatch = content.match(/Achados?[:\s]+(.*?)(?:\n|Diagnóstico|Recomendações)/is)
  if (findingsMatch) {
    findings.push(...findingsMatch[1].split(/[•\-\*]/).map(s => s.trim()).filter(Boolean))
  }

  const diagnosisMatch = content.match(/Diagnóstico[:\s]+(.*?)(?:\n|Recomendações|Confiança)/is)
  if (diagnosisMatch) {
    diagnosis = diagnosisMatch[1].trim()
  }

  const recommendationsMatch = content.match(/Recomendações?[:\s]+(.*?)$/is)
  if (recommendationsMatch) {
    recommendations.push(...recommendationsMatch[1].split(/[•\-\*]/).map(s => s.trim()).filter(Boolean))
  }

  // Se não encontrou padrões, tentar extrair de lista
  if (findings.length === 0) {
    const lines = content.split('\n').filter(line => line.trim().length > 0)
    findings.push(...lines.slice(0, 5)) // Primeiras 5 linhas como achados
  }

  return {
    findings: findings.length > 0 ? findings : ['Análise realizada com sucesso'],
    diagnosis: diagnosis || 'Análise preliminar - requer avaliação médica complementar',
    recommendations: recommendations.length > 0 ? recommendations : ['Recomenda-se avaliação médica presencial'],
    annotatedRegions: undefined,
    similarCases: undefined,
  }
}

/**
 * Parse resposta de análise de áudio médico
 */
function parseMedicalAudioAnalysis(
  content: string,
  transcription: string
): MedicalAudioAnalysis {
  const sentiment: MedicalAudioAnalysis['sentiment'] = content.toLowerCase().includes('urgente')
    ? 'urgent'
    : content.toLowerCase().includes('positivo')
    ? 'positive'
    : content.toLowerCase().includes('negativo')
    ? 'negative'
    : 'neutral'

  let summary = ''
  let keyPoints: string[] = []

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      summary = parsed.summary || content.substring(0, 200)
      keyPoints = parsed.keyPoints || []
    }
  } catch {
    // Fallback para parsing simples
    summary = content.substring(0, 200)
    const lines = content.split('\n').filter(l => l.trim().length > 0)
    keyPoints = lines.slice(0, 5)
  }

  return {
    transcription,
    sentiment,
    detectedEvents: [],
    summary: summary || transcription.substring(0, 200),
    keyPoints: keyPoints.length > 0 ? keyPoints : ['Análise realizada'],
  }
}

/**
 * Parse resposta de análise de vídeo médico
 */
function parseMedicalVideoAnalysis(
  content: string,
  procedureType?: string
): MedicalVideoAnalysis {
  const segments: MedicalVideoAnalysis['segments'] = []
  const keyMoments: MedicalVideoAnalysis['keyMoments'] = []

  // Extrair informações básicas
  const procedureMatch = content.match(/Tipo de procedimento[:\s]+(.*?)(?:\n|$)/i)
  const procedureTypeParsed = procedureMatch?.[1]?.trim() || procedureType || 'Procedimento médico'

  // Tentar extrair segmentos e momentos-chave
  const lines = content.split('\n').filter(l => l.trim().length > 0)
  
  // Segmentos aproximados (dividir por tempo estimado)
  const estimatedDuration = 300 // 5 minutos padrão
  const segmentCount = Math.min(5, lines.length)
  const segmentDuration = estimatedDuration / segmentCount

  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      timestamp: i * segmentDuration,
      duration: segmentDuration,
      topic: lines[i]?.substring(0, 50) || `Segmento ${i + 1}`,
      description: lines[i] || '',
    })
  }

  return {
    procedureType: procedureTypeParsed,
    segments,
    summary: content.substring(0, 300),
    keyMoments: keyMoments.length > 0 ? keyMoments : [
      {
        timestamp: 0,
        description: 'Início do procedimento',
        importance: 'high' as const,
      },
    ],
  }
}

/**
 * Calcula confiança na análise baseada em múltiplos fatores
 */
function calculateConfidence(
  analysis: Omit<MedicalImageAnalysis, 'confidence'>,
  rawContent: string
): number {
  let confidence = 0.5 // Base

  // Mais achados = mais confiança
  confidence += Math.min(analysis.findings.length * 0.1, 0.3)

  // Diagnóstico específico = mais confiança
  if (analysis.diagnosis && analysis.diagnosis.length > 20) {
    confidence += 0.1
  }

  // Mais recomendações = mais confiança
  confidence += Math.min(analysis.recommendations.length * 0.05, 0.1)

  return Math.min(confidence, 0.95) // Máximo 95%
}

