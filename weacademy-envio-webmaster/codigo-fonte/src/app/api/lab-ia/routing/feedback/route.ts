import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error: fetchError } = await serviceRoleSupabase
      .from('lab_model_feedback')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (fetchError) {
      throw fetchError
    }

    return NextResponse.json({ success: true, feedback: data || [] })
  } catch (err: any) {
    console.error('[Routing][Feedback][GET] Erro ao listar feedbacks:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao carregar feedbacks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      messageId,
      provider,
      model,
      originalProvider,
      originalModel,
      taskCategory,
      rating,
      comment,
    } = body

    if (!provider || !model || !rating) {
      return NextResponse.json({ error: 'Dados insuficientes para registrar feedback' }, { status: 400 })
    }

    const normalizedRating = Math.sign(Number(rating))
    if (normalizedRating === 0) {
      return NextResponse.json({ error: 'Rating inválido' }, { status: 400 })
    }

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const insertPayload: Record<string, any> = {
      user_id: user.id,
      provider,
      model,
      original_provider: originalProvider || null,
      original_model: originalModel || null,
      task_category: taskCategory || null,
      rating: normalizedRating,
      comment: comment && String(comment).trim().length > 0 ? String(comment).trim().slice(0, 500) : null,
    }

    if (messageId) {
      insertPayload.message_id = messageId
    }

    const { data, error: insertError } = await serviceRoleSupabase
      .from('lab_model_feedback')
      .upsert(insertPayload, { onConflict: 'user_id,message_id' })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ success: true, feedback: data })
  } catch (err: any) {
    console.error('[Routing][Feedback][POST] Erro ao registrar feedback:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao registrar feedback' }, { status: 500 })
  }
}


