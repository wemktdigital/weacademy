import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * API route para processar operações de vídeo pendentes em background
 * 
 * Este endpoint faz polling das operações do Google e atualiza o status no banco.
 * Pode ser chamado por um cron job ou webhook.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurado' },
        { status: 500 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Variáveis de ambiente do Supabase não configuradas' },
        { status: 500 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Buscar operações pendentes ou em processamento
    const { data: operations, error: fetchError } = await supabase
      .from('lab_video_operations')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
      .limit(10) // Processar até 10 operações por vez

    if (fetchError) {
      console.error('[VIDEO-POLL] Erro ao buscar operações:', fetchError)
      return NextResponse.json(
        { error: 'Erro ao buscar operações', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!operations || operations.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma operação pendente',
        processed: 0,
      })
    }

    console.log(`[VIDEO-POLL] Processando ${operations.length} operações...`)

    const results = {
      processed: 0,
      completed: 0,
      failed: 0,
      stillPending: 0,
    }

    // Função auxiliar para fazer download do vídeo
    const downloadVideo = async (videoUri: string): Promise<string> => {
      const videoResponse = await fetch(videoUri, {
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY!,
        },
      })

      if (!videoResponse.ok) {
        throw new Error(`Erro ao fazer download do vídeo: ${videoResponse.status} - ${videoResponse.statusText}`)
      }

      const videoBuffer = await videoResponse.arrayBuffer()
      const videoBase64 = Buffer.from(videoBuffer).toString('base64')
      
      return `data:video/mp4;base64,${videoBase64}`
    }

    // Processar cada operação
    for (const operation of operations) {
      try {
        results.processed++

        // Atualizar status para "processing"
        await supabase
          .from('lab_video_operations')
          .update({ status: 'processing' })
          .eq('id', operation.id)

        console.log(`[VIDEO-POLL] Verificando operação ${operation.id} (${operation.operation_name})...`)

        // Fazer polling da operação do Google
        const statusResponse = await fetch(`${BASE_URL}/${operation.operation_name}`, {
          method: 'GET',
          headers: {
            'x-goog-api-key': process.env.GEMINI_API_KEY!,
          },
        })

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text()
          console.error(`[VIDEO-POLL] Erro ao verificar status da operação ${operation.id}:`, statusResponse.status, errorText)
          
          await supabase
            .from('lab_video_operations')
            .update({
              status: 'failed',
              error_message: `Erro ao verificar status: ${statusResponse.status} - ${errorText}`,
            })
            .eq('id', operation.id)
          
          results.failed++
          continue
        }

        const statusData = await statusResponse.json()

        // Se ainda não está pronto, continuar
        if (!statusData.done) {
          console.log(`[VIDEO-POLL] Operação ${operation.id} ainda em progresso...`)
          await supabase
            .from('lab_video_operations')
            .update({ status: 'pending' })
            .eq('id', operation.id)
          
          results.stillPending++
          continue
        }

        // Operação concluída - extrair URI do vídeo
        let videoUri: string | undefined

        if (statusData?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri) {
          videoUri = statusData.response.generateVideoResponse.generatedSamples[0].video.uri
        } else if (statusData?.response?.generatedVideos?.[0]?.video?.uri) {
          videoUri = statusData.response.generatedVideos[0].video.uri
        } else if (statusData?.response?.video?.uri) {
          videoUri = statusData.response.video.uri
        } else if (statusData?.video?.uri) {
          videoUri = statusData.video.uri
        } else if (statusData?.response?.generateVideoResponse?.generatedSamples?.[0]?.uri) {
          videoUri = statusData.response.generateVideoResponse.generatedSamples[0].uri
        }

        if (!videoUri) {
          console.error(`[VIDEO-POLL] URI do vídeo não encontrado na resposta da operação ${operation.id}`)
          await supabase
            .from('lab_video_operations')
            .update({
              status: 'failed',
              error_message: 'URI do vídeo não encontrado na resposta da API',
            })
            .eq('id', operation.id)
          
          results.failed++
          continue
        }

        console.log(`[VIDEO-POLL] Vídeo pronto para operação ${operation.id}, fazendo download...`)

        // Fazer download do vídeo
        const videoDataUrl = await downloadVideo(videoUri)

        // Atualizar operação como concluída
        await supabase
          .from('lab_video_operations')
          .update({
            status: 'completed',
            video_url: videoUri,
            video_data_url: videoDataUrl,
            completed_at: new Date().toISOString(),
          })
          .eq('id', operation.id)

        // Atualizar mensagem no chat com o vídeo gerado
        if (operation.message_id) {
          const modelName = operation.model.includes('fast') ? 'Veo 3.1 Fast Generate' : 'Veo 3.1 Generate'
          const modelIcon = '🎬'
          const videoDuration = 8 // VEO 3.1 gera vídeos de 8 segundos

          const content = `${modelIcon} **Vídeo gerado com ${modelName}!**\n\n` +
            `![Vídeo gerado](${videoDataUrl})\n\n` +
            `**Parâmetros:**\n` +
            `- Duração: ${videoDuration}s\n` +
            `- Resolução: 720p/1080p\n` +
            `- Áudio: Nativo\n` +
            `\n**Status:** Concluído`

          await supabase
            .from('lab_messages')
            .update({
              content: content,
            })
            .eq('id', operation.message_id)
        }

        console.log(`[VIDEO-POLL] Operação ${operation.id} concluída com sucesso`)
        results.completed++

      } catch (error: any) {
        console.error(`[VIDEO-POLL] Erro ao processar operação ${operation.id}:`, error)
        
        await supabase
          .from('lab_video_operations')
          .update({
            status: 'failed',
            error_message: error.message || 'Erro desconhecido ao processar operação',
          })
          .eq('id', operation.id)
        
        results.failed++
      }
    }

    return NextResponse.json({
      message: `Processadas ${results.processed} operações`,
      ...results,
    })

  } catch (error: any) {
    console.error('[VIDEO-POLL] Erro geral:', error)
    return NextResponse.json(
      { error: 'Erro ao processar operações', details: error.message },
      { status: 500 }
    )
  }
}

