import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/lessons/[id] - Obter lição
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

    const { data: lesson, error } = await supabase
      .from('lessons')
      .select(`
        *,
        module:modules(
          *,
          course:courses(*)
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ lesson })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar lição' },
      { status: 400 }
    )
  }
}

// PUT /api/lessons/[id] - Atualizar lição
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
    const { title, description, type, content, video_url, video_provider, attachments, duration_minutes, is_preview, is_free, order_index } = body

    const updateData: any = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (type !== undefined) updateData.type = type
    if (content !== undefined) updateData.content = content
    if (video_url !== undefined) updateData.video_url = video_url
    if (video_provider !== undefined) updateData.video_provider = video_provider
    if (attachments !== undefined) updateData.attachments = attachments
    if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes
    if (is_preview !== undefined) updateData.is_preview = is_preview
    if (is_free !== undefined) updateData.is_free = is_free
    if (order_index !== undefined) updateData.order_index = order_index

    const { data: lesson, error } = await supabase
      .from('lessons')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ lesson })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar lição' },
      { status: 400 }
    )
  }
}

// DELETE /api/lessons/[id] - Deletar lição
export async function DELETE(
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

    const { error } = await supabase
      .from('lessons')
      .delete()
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Lição deletada com sucesso' })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar lição' },
      { status: 400 }
    )
  }
}
