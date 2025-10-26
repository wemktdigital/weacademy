import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { updateProgressSchema, completeCourseSchema } from '@/lib/validations'

// PUT /api/enrollments/[courseId]/progress - Atualizar progresso
export async function PUT(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateProgressSchema.parse(body)

    // Verificar se está inscrito
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', params.courseId)
      .single()

    if (!enrollment) {
      return NextResponse.json({ error: 'Não inscrito no curso' }, { status: 404 })
    }

    // Salvar progresso da lição
    const { data: progress, error: progressError } = await supabase
      .from('lesson_progress')
      .upsert({
        user_id: user.id,
        lesson_id: validatedData.lesson_id,
        watch_time_seconds: validatedData.watch_time_seconds,
        completed_at: validatedData.completed ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (progressError) {
      return NextResponse.json({ error: progressError.message }, { status: 400 })
    }

    // Calcular progresso total do curso
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id')
      .in('module_id', 
        supabase
          .from('modules')
          .select('id')
          .eq('course_id', params.courseId)
      )

    const { data: completedLessons } = await supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .in('lesson_id', lessons?.map(l => l.id) || [])

    const totalLessons = lessons?.length || 1
    const completedCount = completedLessons?.length || 0
    const progressPercentage = Math.round((completedCount / totalLessons) * 100)

    // Atualizar progresso na inscrição
    await supabase
      .from('enrollments')
      .update({ progress_percentage: progressPercentage })
      .eq('user_id', user.id)
      .eq('course_id', params.courseId)

    return NextResponse.json({ 
      progress,
      progress_percentage: progressPercentage 
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar progresso' },
      { status: 400 }
    )
  }
}

// POST /api/enrollments/[courseId]/complete - Completar curso
export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Marcar curso como completo
    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .update({
        completed_at: new Date().toISOString(),
        progress_percentage: 100,
      })
      .eq('user_id', user.id)
      .eq('course_id', params.courseId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Certificado será gerado automaticamente pelo trigger
    return NextResponse.json({ enrollment })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao completar curso' },
      { status: 400 }
    )
  }
}

// GET /api/enrollments/[courseId]/progress - Obter progresso
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Obter progresso das lições
    const { data: progress, error } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('user_id', user.id)
      .in('lesson_id',
        supabase
          .from('lessons')
          .select('id')
          .in('module_id',
            supabase
              .from('modules')
              .select('id')
              .eq('course_id', params.courseId)
          )
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ progress: progress || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar progresso' },
      { status: 400 }
    )
  }
}
