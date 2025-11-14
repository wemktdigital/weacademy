import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

// GET: Listar histórico de recomendações aceitas
// POST: Salvar nova recomendação aceita
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: history, error } = await serviceRoleSupabase
      .from('lab_model_recommendations_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ success: true, history: history || [] })
  } catch (error: any) {
    console.error('[API] Erro ao buscar histórico:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar histórico' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const {
      originalProvider,
      originalModel,
      recommendedProvider,
      recommendedModel,
      recommendationScore,
      recommendationReason,
      taskCategory,
      promptPreview,
    } = await request.json()

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await serviceRoleSupabase
      .from('lab_model_recommendations_history')
      .insert({
        user_id: user.id,
        original_provider: originalProvider,
        original_model: originalModel,
        recommended_provider: recommendedProvider,
        recommended_model: recommendedModel,
        recommendation_score: recommendationScore,
        recommendation_reason: recommendationReason,
        task_category: taskCategory,
        prompt_preview: promptPreview?.substring(0, 200),
        accepted: true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, recommendation: data })
  } catch (error: any) {
    console.error('[API] Erro ao salvar recomendação:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar recomendação' },
      { status: 500 }
    )
  }
}

