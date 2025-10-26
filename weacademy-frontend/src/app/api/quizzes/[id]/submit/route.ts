import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/quizzes/[id]/submit - Submeter quiz
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Buscar o quiz com questões e opções
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select(`
        *,
        questions:questions(
          *,
          options:question_options(*)
        )
      `)
      .eq('id', params.id)
      .single()

    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Quiz não encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const { answers } = body // { question_id: answer_data }

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json(
        { error: 'Respostas não fornecidas' },
        { status: 400 }
      )
    }

    // Calcular pontuação
    let totalPoints = 0
    let earnedPoints = 0

    for (const question of quiz.questions) {
      totalPoints += question.points || 1

      const userAnswer = answers[question.id]
      
      if (!userAnswer) {
        continue // Não respondeu
      }

      let isCorrect = false

      if (question.question_type === 'multiple_choice') {
        // Verificar se a resposta está nas opções corretas
        const correctOptions = question.options
          ?.filter((opt: any) => opt.is_correct)
          .map((opt: any) => opt.id)

        if (correctOptions && correctOptions.includes(userAnswer)) {
          isCorrect = true
          earnedPoints += question.points || 1
        }
      } else if (question.question_type === 'true_false' || question.question_type === 'single_answer') {
        // Comparar com a resposta correta
        if (userAnswer === question.correct_answer) {
          isCorrect = true
          earnedPoints += question.points || 1
        }
      }
    }

    const scorePercentage = totalPoints > 0 
      ? Math.round((earnedPoints / totalPoints) * 100) 
      : 0

    const passed = scorePercentage >= quiz.passing_score

    // Salvar tentativa
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        user_id: user.id,
        quiz_id: params.id,
        answers,
        score: scorePercentage,
        passed,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (attemptError) {
      return NextResponse.json({ error: attemptError.message }, { status: 400 })
    }

    // Se passou, usar a função SQL para calcular score automaticamente
    const { data: calculatedScore } = await supabase
      .rpc('calculate_quiz_score', {
        p_quiz_id: params.id,
        p_answers: answers
      })

    return NextResponse.json({
      attempt,
      score: scorePercentage,
      totalPoints,
      earnedPoints,
      passed,
      passing_score: quiz.passing_score,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao submeter quiz' },
      { status: 400 }
    )
  }
}
