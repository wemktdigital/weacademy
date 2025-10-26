import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createCourseSchema, listCoursesSchema } from '@/lib/validations'

// GET /api/courses - Listar cursos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Validar query params
    const params = listCoursesSchema.parse({
      category: searchParams.get('category') || undefined,
      instructor: searchParams.get('instructor') || undefined,
      status: searchParams.get('status') || undefined,
      level: searchParams.get('level') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    })

    let query = supabase
      .from('courses')
      .select(`
        *,
        category:categories(*),
        instructor:profiles!instructor_id(id, full_name, avatar_url)
      `)

    // Aplicar filtros
    if (params.category) {
      query = query.eq('category_id', params.category)
    }
    if (params.instructor) {
      query = query.eq('instructor_id', params.instructor)
    }
    if (params.status) {
      query = query.eq('status', params.status)
    }
    if (params.level) {
      query = query.eq('level', params.level)
    }
    if (params.search) {
      query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`)
    }

    // Paginação
    const from = (params.page - 1) * params.limit
    const to = from + params.limit - 1
    
    query = query.range(from, to).order('created_at', { ascending: false })

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      courses: data || [],
      pagination: {
        page: params.page,
        limit: params.limit,
        total: count || 0,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao listar cursos' },
      { status: 400 }
    )
  }
}

// POST /api/courses - Criar curso
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar se é admin ou instrutor
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['admin', 'instructor'].includes(profile?.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validar dados
    const validatedData = createCourseSchema.parse(body)
    
    // Verificar se slug já existe
    const { data: existingCourse } = await supabase
      .from('courses')
      .select('id')
      .eq('slug', validatedData.slug)
      .single()

    if (existingCourse) {
      return NextResponse.json(
        { error: 'Slug já existe' },
        { status: 400 }
      )
    }

    // Criar curso
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .insert({
        title: validatedData.title,
        slug: validatedData.slug,
        description: validatedData.description,
        short_description: validatedData.short_description,
        thumbnail_url: validatedData.thumbnail_url,
        video_url: validatedData.video_url,
        video_provider: validatedData.video_provider,
        price: validatedData.price,
        is_free: validatedData.is_free,
        status: validatedData.status,
        level: validatedData.level,
        duration_hours: validatedData.duration_hours,
        category_id: validatedData.category_id,
        instructor_id: validatedData.instructor_id || user.id,
      })
      .select()
      .single()

    if (courseError) {
      return NextResponse.json(
        { error: courseError.message },
        { status: 400 }
      )
    }

    // Criar módulos e lições
    for (const moduleData of validatedData.modules) {
      const { data: module, error: moduleError } = await supabase
        .from('modules')
        .insert({
          course_id: course.id,
          title: moduleData.title,
          description: moduleData.description,
          order_index: moduleData.order_index,
        })
        .select()
        .single()

      if (moduleError) {
        // Rollback: deletar curso se falhar
        await supabase.from('courses').delete().eq('id', course.id)
        return NextResponse.json(
          { error: 'Erro ao criar módulo: ' + moduleError.message },
          { status: 400 }
        )
      }

      // Criar lições
      for (const lessonData of moduleData.lessons) {
        const { error: lessonError } = await supabase
          .from('lessons')
          .insert({
            module_id: module.id,
            title: lessonData.title,
            description: lessonData.description,
            type: lessonData.type,
            content: lessonData.content,
            video_url: lessonData.video_url,
            video_provider: lessonData.video_provider,
            attachments: lessonData.attachments || [],
            duration_minutes: lessonData.duration_minutes,
            is_preview: lessonData.is_preview,
            is_free: lessonData.is_free,
            order_index: lessonData.order_index,
          })

        if (lessonError) {
          return NextResponse.json(
            { error: 'Erro ao criar lição: ' + lessonError.message },
            { status: 400 }
          )
        }
      }
    }

    return NextResponse.json({ course }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao criar curso' },
      { status: 400 }
    )
  }
}
