import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createEnrollmentSchema, listEnrollmentsSchema } from '@/lib/validations'

// POST /api/enrollments - Inscrever em curso
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createEnrollmentSchema.parse(body)

    // Verificar se já está inscrito
    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', validatedData.course_id)
      .single()

    if (existingEnrollment) {
      return NextResponse.json(
        { error: 'Você já está inscrito neste curso' },
        { status: 400 }
      )
    }

    // Criar inscrição
    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .insert({
        user_id: user.id,
        course_id: validatedData.course_id,
        cohort_id: validatedData.cohort_id,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ enrollment }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao inscrever em curso' },
      { status: 400 }
    )
  }
}

// GET /api/enrollments - Listar minhas inscrições
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const params = listEnrollmentsSchema.parse({
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    })

    let query = supabase
      .from('enrollments')
      .select(`
        *,
        course:courses(*,
          category:categories(*),
          instructor:profiles!instructor_id(id, full_name, avatar_url)
        ),
        cohort:cohorts(*)
      `)
      .eq('user_id', user.id)

    if (params.status) {
      query = query.eq('status', params.status)
    }

    const from = (params.page - 1) * params.limit
    const to = from + params.limit - 1

    query = query.range(from, to).order('enrolled_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ enrollments: data || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao listar inscrições' },
      { status: 400 }
    )
  }
}
