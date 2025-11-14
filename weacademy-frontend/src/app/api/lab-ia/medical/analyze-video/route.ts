import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { analyzeMedicalVideo } from '@/modules/laboratorio-ia/services/medicalMultimodalAnalysis'

export async function POST(request: NextRequest) {
  try {
    // Autenticação
    const supabase = await supabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { videoUrl, procedureType, options } = body

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl é obrigatório' },
        { status: 400 }
      )
    }

    const startTime = Date.now()

    // Analisar vídeo médico
    const analysis = await analyzeMedicalVideo(videoUrl, procedureType, options)

    const latency = Date.now() - startTime

    // Log da análise (opcional)
    try {
      await supabase.from('lab_medical_analyses').insert({
        user_id: user.id,
        analysis_type: 'video',
        video_url: videoUrl,
        procedure_type: analysis.procedureType,
        summary: analysis.summary,
        segments: analysis.segments,
        key_moments: analysis.keyMoments,
        latency_ms: latency,
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      console.warn('[Medical Analysis] Erro ao salvar log:', error)
    }

    return NextResponse.json({
      success: true,
      analysis,
      latency,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Medical Analysis] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao analisar vídeo médico' },
      { status: 500 }
    )
  }
}

