import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { analyzeMedicalAudio } from '@/modules/laboratorio-ia/services/medicalMultimodalAnalysis'

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
    const { audioUrl, transcription, options } = body

    if (!audioUrl && !transcription) {
      return NextResponse.json(
        { error: 'audioUrl ou transcription é obrigatório' },
        { status: 400 }
      )
    }

    const startTime = Date.now()

    // Analisar áudio médico
    const analysis = await analyzeMedicalAudio(audioUrl || '', transcription, options)

    const latency = Date.now() - startTime

    // Log da análise (opcional)
    try {
      await supabase.from('lab_medical_analyses').insert({
        user_id: user.id,
        analysis_type: 'audio',
        audio_url: audioUrl,
        transcription: analysis.transcription,
        sentiment: analysis.sentiment,
        summary: analysis.summary,
        key_points: analysis.keyPoints,
        detected_events: analysis.detectedEvents,
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
      { error: error.message || 'Erro ao analisar áudio médico' },
      { status: 500 }
    )
  }
}

