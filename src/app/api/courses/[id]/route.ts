import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { updateCourseSchema } from '@/lib/validations'

// GET /api/courses/[id] - Obter curso
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: course, error } = await supabase
      .from('courses')
      .select(`
        *,
        category:categories(*),
        instructor:profiles!instructor_id(id, full_name, avatar_url),
        modules:modules(
          *,
          lessons:lessons(*)
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ course })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar curso' },
      { status: 400 }
    )
  }
}

// PUT /api/courses/[id] - Atualizar curso
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar permissão
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', params.id)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && course.instructor_id !== user.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateCourseSchema.parse(body)

    const { data: updatedCourse, error } = await supabase
      .from('courses')
      .update(validatedData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ course: updatedCourse })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar curso' },
      { status: 400 }
    )
  }
}

// DELETE /api/courses/[id] - Deletar curso
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar permissão
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', params.id)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && course.instructor_id !== user.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Curso deletado com sucesso' })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar curso' },
      { status: 400 }
    )
  }
}
