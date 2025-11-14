import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { generateVideo } from '@/modules/laboratorio-ia/services/imageProcessing'

/**
 * POST /api/lab-ia/video/generate
 * Gera vídeo usando Seedance 1.0 Pro Fast
 */
export async function POST(request: NextRequest) {
  try {
    // Autenticar usuário
    const supabase = await supabaseServer()
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user
    if (token) {
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      }
    }

    if (!user) {
      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !sessionUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = sessionUser
    }

    const body = await request.json()
    const { prompt, image, duration, motion, seed } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'prompt é obrigatório' },
        { status: 400 }
      )
    }

    // Processar vídeo
    const result = await generateVideo(prompt, {
      image,
      duration,
      motion,
      seed,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Erro ao gerar vídeo' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      output: result.output,
      processingTime: result.processingTime,
      cost: result.cost,
    })
  } catch (error: any) {
    console.error('[Video Generation API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
