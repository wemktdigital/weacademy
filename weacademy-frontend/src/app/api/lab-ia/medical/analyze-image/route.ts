import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { analyzeMedicalImage } from '@/modules/laboratorio-ia/services/medicalMultimodalAnalysis'

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
    const { imageUrl, imageType, clinicalContext, options } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl é obrigatório' },
        { status: 400 }
      )
    }

    if (!imageType || !['xray', 'mri', 'ct', 'ultrasound', 'dermatology', 'general'].includes(imageType)) {
      return NextResponse.json(
        { error: 'imageType inválido. Deve ser: xray, mri, ct, ultrasound, dermatology ou general' },
        { status: 400 }
      )
    }

    const startTime = Date.now()

    // Analisar imagem médica
    const analysis = await analyzeMedicalImage(
      imageUrl,
      imageType,
      clinicalContext,
      options
    )

    const latency = Date.now() - startTime

    // Log da análise (opcional)
    try {
      await supabase.from('lab_medical_analyses').insert({
        user_id: user.id,
        analysis_type: 'image',
        image_type: imageType,
        image_url: imageUrl,
        findings: analysis.findings,
        diagnosis: analysis.diagnosis,
        recommendations: analysis.recommendations,
        confidence: analysis.confidence,
        latency_ms: latency,
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      console.warn('[Medical Analysis] Erro ao salvar log:', error)
      // Não falhar a requisição se o log falhar
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
      { error: error.message || 'Erro ao analisar imagem médica' },
      { status: 500 }
    )
  }
}

