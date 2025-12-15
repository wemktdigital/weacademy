/**
 * Serviço para processamento de imagens usando Replicate
 */

import Replicate from 'replicate'

let replicateInstance: Replicate | null = null

function getReplicateInstance(): Replicate {
  if (!replicateInstance) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN não configurado')
    }
    replicateInstance = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    })
  }
  return replicateInstance
}

export interface ImageProcessingResult {
  success: boolean
  output?: string | string[] // URL da imagem processada ou array de URLs
  error?: string
  processingTime?: number
  cost?: number
}

export interface VideoProcessingResult {
  success: boolean
  output?: string // URL do vídeo processado
  error?: string
  processingTime?: number
  cost?: number
}

export interface VideoGenerationResult {
  success: boolean
  output?: string | string[] // URL do vídeo gerado ou array de URLs
  error?: string
  processingTime?: number
  cost?: number
}

/**
 * Remove fundo de uma imagem usando o modelo background-remover
 */
export async function removeBackground(
  imageUrl: string | File
): Promise<ImageProcessingResult> {
  const startTime = Date.now()

  try {
    const replicate = getReplicateInstance()

    // Converter File para URL se necessário
    let imageUrlString: string
    if (imageUrl instanceof File) {
      // Upload para um serviço temporário ou converter para base64/data URL
      // Por enquanto, assumimos que já temos uma URL
      throw new Error('Upload de arquivo precisa ser convertido para URL primeiro')
    } else {
      imageUrlString = imageUrl
    }

    // Executar o modelo background-remover
    // O modelo espera uma URL de imagem como input
    const output = await replicate.run('851-labs/background-remover', {
      input: {
        image: imageUrlString,
      },
    }) as any

    const processingTime = Date.now() - startTime

    // O output pode ser uma URL ou array de URLs
    let outputUrl: string | string[] = ''
    if (typeof output === 'string') {
      outputUrl = output
    } else if (Array.isArray(output)) {
      outputUrl = output
    } else if (output && typeof output === 'object') {
      outputUrl = output.output || output.url || output.image || JSON.stringify(output)
    }

    // Calcular custo estimado (aproximadamente $0.00039 por execução)
    const cost = 0.00039

    return {
      success: true,
      output: outputUrl,
      processingTime,
      cost,
    }
  } catch (error: any) {
    console.error('[ImageProcessing] Erro ao remover fundo:', error)
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao processar imagem',
      processingTime: Date.now() - startTime,
    }
  }
}

/**
 * Processa uma imagem usando um modelo específico do Replicate
 */
export async function processImageWithModel(
  model: string,
  input: Record<string, any>
): Promise<ImageProcessingResult> {
  const startTime = Date.now()

  try {
    const replicate = getReplicateInstance()

    const output = await replicate.run(model, { input }) as any

    const processingTime = Date.now() - startTime

    // Processar output de diferentes formatos
    let outputUrl: string | string[] = ''
    if (typeof output === 'string') {
      outputUrl = output
    } else if (Array.isArray(output)) {
      outputUrl = output
    } else if (output && typeof output === 'object') {
      outputUrl = output.output || output.url || output.image || output.data || JSON.stringify(output)
    }

    // Custo estimado (pode variar por modelo)
    const cost = 0.00039 // Default para background-remover, ajustar conforme necessário

    return {
      success: true,
      output: outputUrl,
      processingTime,
      cost,
    }
  } catch (error: any) {
    console.error(`[ImageProcessing] Erro ao processar imagem com modelo ${model}:`, error)
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao processar imagem',
      processingTime: Date.now() - startTime,
    }
  }
}

/**
 * Processa vídeo para extrair foreground usando robust_video_matting
 */
export async function processVideoMatting(
  videoUrl: string | File
): Promise<VideoProcessingResult> {
  const startTime = Date.now()

  try {
    const replicate = getReplicateInstance()

    // Converter File para URL se necessário
    let videoUrlString: string
    if (videoUrl instanceof File) {
      // Upload para um serviço temporário ou converter para base64/data URL
      // Por enquanto, assumimos que já temos uma URL
      throw new Error('Upload de arquivo precisa ser convertido para URL primeiro')
    } else {
      videoUrlString = videoUrl
    }

    // Executar o modelo robust_video_matting
    // O modelo espera uma URL de vídeo como input
    const output = await replicate.run('arielreplicate/robust_video_matting', {
      input: {
        video: videoUrlString,
      },
    }) as any

    const processingTime = Date.now() - startTime

    // O output é uma URL do vídeo processado
    let outputUrl: string = ''
    if (typeof output === 'string') {
      outputUrl = output
    } else if (Array.isArray(output) && output.length > 0) {
      outputUrl = output[0]
    } else if (output && typeof output === 'object') {
      outputUrl = output.output || output.url || output.video || output.file || JSON.stringify(output)
    }

    // Calcular custo estimado (aproximadamente $0.090 por execução)
    const cost = 0.090

    return {
      success: true,
      output: outputUrl,
      processingTime,
      cost,
    }
  } catch (error: any) {
    console.error('[VideoProcessing] Erro ao processar vídeo:', error)
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao processar vídeo',
      processingTime: Date.now() - startTime,
    }
  }
}

/**
 * Gera vídeo a partir de texto ou imagem usando Sora 2
 */
export async function generateVideoWithSora2(
  prompt: string,
  imageUrl?: string,
  options?: {
    duration?: number // em segundos (4-12)
    resolution?: '720p' | '1080p'
    aspectRatio?: '16:9' | '9:16'
  }
): Promise<VideoGenerationResult> {
  const startTime = Date.now()

  try {
    const replicate = getReplicateInstance()

    // Preparar input
    const input: Record<string, any> = {
      prompt,
    }

    if (imageUrl) {
      input.image = imageUrl
    }

    if (options?.duration) {
      input.duration = options.duration
    }

    if (options?.resolution) {
      input.resolution = options.resolution
    }

    if (options?.aspectRatio) {
      input.aspect_ratio = options.aspectRatio
    }

    // Executar o modelo sora-2
    const output = await replicate.run('openai/sora-2', {
      input,
    }) as any

    const processingTime = Date.now() - startTime

    // O output é uma URL do vídeo gerado
    let outputUrl: string = ''
    if (typeof output === 'string') {
      outputUrl = output
    } else if (Array.isArray(output) && output.length > 0) {
      outputUrl = output[0]
    } else if (output && typeof output === 'object') {
      outputUrl = output.output || output.url || output.video || output.file || JSON.stringify(output)
    }

    // Custo estimado varia muito, mas vamos usar uma média baseada na documentação
    // Sora 2 é mais caro que outros modelos, estimativa conservadora
    const cost = options?.duration && options.duration > 8 ? 0.15 : 0.10

    return {
      success: true,
      output: outputUrl,
      processingTime,
      cost,
    }
  } catch (error: any) {
    console.error('[VideoGeneration] Erro ao gerar vídeo com Sora 2:', error)
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao gerar vídeo',
      processingTime: Date.now() - startTime,
    }
  }
}

/**
 * Gera vídeo usando Seedance 1.0 Pro Fast
 */
export async function generateVideo(
  prompt: string,
  options?: {
    image?: string // Imagem inicial (opcional)
    duration?: number // Duração do vídeo em segundos
    motion?: number // Intensidade do movimento (0-1)
    seed?: number // Seed para reproduzibilidade
  }
): Promise<VideoGenerationResult> {
  const startTime = Date.now()

  try {
    const replicate = getReplicateInstance()

    // Preparar input do modelo
    const input: Record<string, any> = {
      prompt: prompt,
    }

    if (options?.image) {
      input.image = options.image
    }

    if (options?.duration !== undefined) {
      input.duration = options.duration
    }

    if (options?.motion !== undefined) {
      input.motion = options.motion
    }

    if (options?.seed !== undefined) {
      input.seed = options.seed
    }

    // Executar o modelo Seedance 1.0 Pro Fast
    const output = await replicate.run('bytedance/seedance-1-pro-fast', {
      input,
    }) as any

    const processingTime = Date.now() - startTime

    // O output pode ser uma URL ou array de URLs
    let outputUrl: string | string[] = ''
    if (typeof output === 'string') {
      outputUrl = output
    } else if (Array.isArray(output)) {
      outputUrl = output
    } else if (output && typeof output === 'object') {
      outputUrl = output.output || output.url || output.video || output.file || JSON.stringify(output)
    }

    // Custo estimado (varia com duração e complexidade)
    // Estimativa conservadora: ~$0.10-0.20 por vídeo curto
    const cost = 0.15

    return {
      success: true,
      output: outputUrl,
      processingTime,
      cost,
    }
  } catch (error: any) {
    console.error('[VideoGeneration] Erro ao gerar vídeo:', error)
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao gerar vídeo',
      processingTime: Date.now() - startTime,
    }
  }
}

/**
 * Upload de imagem para um serviço temporário
 * Por enquanto, retorna a URL diretamente (assumindo que já é uma URL acessível)
 * Em produção, pode usar Supabase Storage ou outro serviço
 */
export async function uploadImage(file: File): Promise<string> {
  // TODO: Implementar upload para Supabase Storage ou outro serviço
  // Por enquanto, converter para data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Converte File para URL usando Supabase Storage (se disponível)
 */
export async function uploadImageToStorage(file: File, bucket: string = 'ai-lab-images'): Promise<string> {
  // Esta função será implementada quando Supabase Storage estiver configurado
  // Por enquanto, usar data URL
  return uploadImage(file)
}

