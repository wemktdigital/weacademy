import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/courses/[id] - Buscar curso específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Usar service role para bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: course, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (!course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 })
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Ler body
    let body
    try {
      body = await request.json()
    } catch (error: any) {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }
    
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'Dados não fornecidos' }, { status: 400 })
    }

    // Autenticar
    let user = null
    
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      )
      
      const { data: { user: tokenUser } } = await supabaseWithToken.auth.getUser(token)
      if (tokenUser) user = tokenUser
    }
    
    if (!user) {
      const sb = await supabaseServer()
      const { data: { user: cookieUser } } = await sb.auth.getUser()
      if (cookieUser) user = cookieUser
    }

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    // Verificar role via service role
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await serviceRoleSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['admin', 'instructor'].includes(profile?.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Validar campos básicos
    const { 
      title, 
      slug, 
      description, 
      short_description, 
      price, 
      is_free, 
      status, 
      level,
      category_id,
      instructor_id,
      duration_hours 
    } = body

    const updateData: any = {}

    if (title !== undefined) {
      if (!title || title.length < 3) {
        return NextResponse.json({ error: 'Título deve ter no mínimo 3 caracteres' }, { status: 400 })
      }
      updateData.title = title
    }

    if (slug !== undefined && slug) {
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return NextResponse.json({ error: 'Slug inválido. Use apenas letras minúsculas, números e hífens' }, { status: 400 })
      }

      // Verificar se slug existe em outro curso
      const { data: existingCourse } = await serviceRoleSupabase
        .from('courses')
        .select('id')
        .eq('slug', slug)
        .neq('id', id)
        .maybeSingle()

      if (existingCourse) {
        return NextResponse.json({ error: 'Slug já existe' }, { status: 400 })
      }
      updateData.slug = slug
    }

    if (description !== undefined) {
      updateData.description = description
    }

    if (short_description !== undefined) {
      updateData.short_description = short_description
    }

    if (price !== undefined) {
      updateData.price = Number(price)
    }

    if (is_free !== undefined) {
      updateData.is_free = Boolean(is_free)
    }

    if (status !== undefined) {
      updateData.status = status
    }

    if (level !== undefined) {
      updateData.level = level
    }

    if (category_id !== undefined) {
      updateData.category_id = category_id
    }

    if (instructor_id !== undefined) {
      updateData.instructor_id = instructor_id
    }

    if (duration_hours !== undefined) {
      updateData.duration_hours = Number(duration_hours)
    }

    // Atualizar curso
    const { data: course, error: courseError } = await serviceRoleSupabase
      .from('courses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (courseError) {
      console.error("[LABAUTH][COURSE][PUT][DBERR]", courseError)
      return NextResponse.json({ error: courseError.message }, { status: 400 })
    }

    if (!course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ course })
  } catch (error: any) {
    console.error("[LABAUTH][COURSE][PUT][ERROR]", error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar curso' },
      { status: 400 }
    )
  }
}

// DELETE /api/courses/[id] - Deletar curso
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    let user = null
    
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      )
      
      const { data: { user: tokenUser } } = await supabaseWithToken.auth.getUser(token)
      if (tokenUser) user = tokenUser
    }
    
    if (!user) {
      const sb = await supabaseServer()
      const { data: { user: cookieUser } } = await sb.auth.getUser()
      if (cookieUser) user = cookieUser
    }

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    // Verificar role via service role
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await serviceRoleSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Somente admin pode deletar cursos' }, { status: 403 })
    }

    // Deletar curso
    const { error: deleteError } = await serviceRoleSupabase
      .from('courses')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar curso' },
      { status: 400 }
    )
  }
}
