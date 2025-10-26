import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/quizzes - Listar quizzes
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { searchParams } = new URL(request.url)
    const lessonId = searchParams.get('lesson_id')
    const courseId = searchParams.get('course_id')

    let query = supabase
      .from('quizzes')
      .select('*')

    if (lessonId) {
      query = query.eq('lesson_id', lessonId)
    }

    if (courseId) {
      // Buscar quizzes do course através de lessons
      const { data: modules } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseId)

      if (modules && modules.length > 0) {
        const moduleIds = modules.map(m => m.id)
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id')
          .in('module_id', moduleIds)

        if (lessons && lessons.length > 0) {
          const lessonIds = lessons.map(l => l.id)
          query = query.in('lesson_id', lessonIds)
        }
      }
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ quizzes: data || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao listar quizzes' },
      { status: 400 }
    )
  }
}

// POST /api/quizzes - Criar quiz
export async function POST(request: NextRequest) {
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
    const { lesson_id, title, description, passing_score, time_limit_minutes, questions } = body

    // Validações básicas
    if (!lesson_id || !title || !questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: lesson_id, title, questions (array)' },
        { status: 400 }
      )
    }

    // Criar o quiz
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        lesson_id,
        title,
        description: description || null,
        passing_score: passing_score || 70,
        time_limit_minutes: time_limit_minutes || null,
      })
      .select()
      .single()

    if (quizError) {
      return NextResponse.json({ error: quizError.message }, { status: 400 })
    }

    // Criar as questões
    for (const questionData of questions) {
      const { question_text, question_type, points, options, correct_answer } = questionData

      const { data: question, error: questionError } = await supabase
        .from('questions')
        .insert({
          quiz_id: quiz.id,
          question_text,
          question_type: question_type || 'multiple_choice',
          points: points || 1,
          correct_answer: correct_answer || null,
        })
        .select()
        .single()

      if (questionError) {
        // Rollback: deletar quiz se falhar
        await supabase.from('quizzes').delete().eq('id', quiz.id)
        return NextResponse.json(
          { error: 'Erro ao criar questão: ' + questionError.message },
          { status: 400 }
        )
      }

      // Criar as opções (apenas para multiple_choice)
      if (question_type === 'multiple_choice' && options && Array.isArray(options)) {
        for (const optionData of options) {
          const { option_text, is_correct } = optionData

          const { error: optionError } = await supabase
            .from('question_options')
            .insert({
              question_id: question.id,
              option_text,
              is_correct: is_correct || false,
            })

          if (optionError) {
            return NextResponse.json(
              { error: 'Erro ao criar opção: ' + optionError.message },
              { status: 400 }
            )
          }
        }
      }
    }

    // Buscar quiz completo com questões
    const { data: completeQuiz } = await supabase
      .from('quizzes')
      .select(`
        *,
        questions:questions(
          *,
          options:question_options(*)
        )
      `)
      .eq('id', quiz.id)
      .single()

    return NextResponse.json({ quiz: completeQuiz }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao criar quiz' },
      { status: 400 }
    )
  }
}
