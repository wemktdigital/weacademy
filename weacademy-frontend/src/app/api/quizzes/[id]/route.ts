import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/quizzes/[id] - Obter quiz
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: quiz, error } = await supabase
      .from('quizzes')
      .select(`
        *,
        questions:questions(
          *,
          options:question_options(*)
        ),
        lesson:lessons(*)
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ quiz })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar quiz' },
      { status: 400 }
    )
  }
}

// PUT /api/quizzes/[id] - Atualizar quiz
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar autenticação
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar permissão (admin ou instructor)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['admin', 'instructor'].includes(profile?.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, passing_score, time_limit_minutes } = body

    const updateData: any = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (passing_score !== undefined) updateData.passing_score = passing_score
    if (time_limit_minutes !== undefined) updateData.time_limit_minutes = time_limit_minutes

    const { data: quiz, error } = await supabase
      .from('quizzes')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ quiz })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar quiz' },
      { status: 400 }
    )
  }
}
