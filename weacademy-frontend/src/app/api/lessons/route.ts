import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/lessons - Listar lições
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { searchParams } = new URL(request.url)
    const moduleId = searchParams.get('module_id')
    const courseId = searchParams.get('course_id')

    let query = supabase
      .from('lessons')
      .select('*')
      .order('order_index', { ascending: true })

    if (moduleId) {
      query = query.eq('module_id', moduleId)
    }

    if (courseId) {
      // Buscar lessons do course através de modules
      const { data: modules } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseId)

      if (modules && modules.length > 0) {
        const moduleIds = modules.map(m => m.id)
        query = query.in('module_id', moduleIds)
      }
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ lessons: data || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao listar lições' },
      { status: 400 }
    )
  }
}

// POST /api/lessons - Criar lição
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
    const { module_id, title, description, type, content, video_url, video_provider, attachments, duration_minutes, is_preview, is_free, order_index } = body

    // Validações básicas
    if (!module_id || !title || !type) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: module_id, title, type' },
        { status: 400 }
      )
    }

    const { data: lesson, error } = await supabase
      .from('lessons')
      .insert({
        module_id,
        title,
        description: description || null,
        type,
        content: content || null,
        video_url: video_url || null,
        video_provider: video_provider || null,
        attachments: attachments || [],
        duration_minutes: duration_minutes || 0,
        is_preview: is_preview || false,
        is_free: is_free || false,
        order_index: order_index || 0,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ lesson }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao criar lição' },
      { status: 400 }
    )
  }
}
