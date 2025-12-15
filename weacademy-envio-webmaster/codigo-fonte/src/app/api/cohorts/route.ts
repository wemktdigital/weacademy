import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { cohortSchema, listCohortsSchema, waitlistSchema } from '@/lib/validations'

// GET /api/cohorts - Listar turmas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = listCohortsSchema.parse({
      course_id: searchParams.get('course_id') || undefined,
      status: searchParams.get('status') || undefined,
      start_date_from: searchParams.get('start_date_from') || undefined,
      start_date_to: searchParams.get('start_date_to') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    })

    let query = supabase
      .from('cohorts')
      .select('*')

    if (params.course_id) {
      query = query.eq('course_id', params.course_id)
    }
    if (params.status) {
      query = query.eq('status', params.status)
    }

    const from = (params.page - 1) * params.limit
    const to = from + params.limit - 1

    query = query.range(from, to).order('start_date', { ascending: true })

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ cohorts: data || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao listar turmas' },
      { status: 400 }
    )
  }
}

// POST /api/cohorts - Criar turma
export async function POST(request: NextRequest) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['admin', 'instructor'].includes(profile?.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = cohortSchema.parse(body)

    const { data: cohort, error } = await supabase
      .from('cohorts')
      .insert(validatedData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ cohort }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao criar turma' },
      { status: 400 }
    )
  }
}
