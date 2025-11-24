import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = "force-dynamic"

async function authenticateAdmin(request: NextRequest) {
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
    
    const { data: { user: tokenUser }, error: tokenError } = await supabaseWithToken.auth.getUser(token)
    if (!tokenError && tokenUser) {
      user = tokenUser
    }
  }
  
  if (!user) {
    const sb = await supabaseServer()
    const { data: { user: cookieUser }, error: authErr } = await sb.auth.getUser()
    if (!authErr && cookieUser) {
      user = cookieUser
    }
  }

  if (!user) {
    return { user: null, isAdmin: false }
  }

  const serviceRoleSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await serviceRoleSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    user,
    isAdmin: profile?.role === 'admin',
  }
}

// GET /api/admin/gamification/achievements/[id] - Obter um achievement
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: achievement, error } = await serviceRoleSupabase
      .from('achievements')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !achievement) {
      return NextResponse.json({ error: 'Achievement não encontrado' }, { status: 404 })
    }

    // Buscar estatísticas
    const { data: stats } = await serviceRoleSupabase
      .from('user_achievements')
      .select('user_id')
      .eq('achievement_id', id)

    return NextResponse.json({
      achievement: {
        ...achievement,
        unlocked_count: stats?.length || 0,
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/admin/gamification/achievements/[id]:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PUT /api/admin/gamification/achievements/[id] - Atualizar achievement
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar achievement atual
    const { data: oldAchievement, error: fetchError } = await serviceRoleSupabase
      .from('achievements')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !oldAchievement) {
      return NextResponse.json({ error: 'Achievement não encontrado' }, { status: 404 })
    }

    // Validar category e rarity se fornecidos
    if (body.category) {
      const validCategories = ['courses', 'quizzes', 'lab-ia', 'community', 'special']
      if (!validCategories.includes(body.category)) {
        return NextResponse.json(
          { error: `category deve ser um de: ${validCategories.join(', ')}` },
          { status: 400 }
        )
      }
    }

    if (body.rarity) {
      const validRarities = ['common', 'rare', 'epic', 'legendary']
      if (!validRarities.includes(body.rarity)) {
        return NextResponse.json(
          { error: `rarity deve ser um de: ${validRarities.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Verificar se code já existe (se está sendo alterado)
    if (body.code && body.code !== oldAchievement.code) {
      const { data: existing } = await serviceRoleSupabase
        .from('achievements')
        .select('id')
        .eq('code', body.code)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Já existe um achievement com este código' },
          { status: 400 }
        )
      }
    }

    // Atualizar achievement
    const updateData: any = {}
    const allowedFields = ['code', 'name', 'description', 'icon', 'category', 'points', 'rarity', 'conditions', 'active', 'sort_order']
    
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })

    const { data: achievement, error } = await serviceRoleSupabase
      .from('achievements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating achievement:', error)
      return NextResponse.json({ error: error.message || 'Erro ao atualizar achievement' }, { status: 500 })
    }

    // Log da mudança
    await serviceRoleSupabase.rpc('log_gamification_change', {
      p_change_type: 'update',
      p_entity_type: 'achievement',
      p_entity_id: id,
      p_old_value: oldAchievement,
      p_new_value: achievement,
    })

    return NextResponse.json({
      achievement,
    })
  } catch (error: any) {
    console.error('Error in PUT /api/admin/gamification/achievements/[id]:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE /api/admin/gamification/achievements/[id] - Deletar achievement
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar achievement antes de deletar
    const { data: oldAchievement, error: fetchError } = await serviceRoleSupabase
      .from('achievements')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !oldAchievement) {
      return NextResponse.json({ error: 'Achievement não encontrado' }, { status: 404 })
    }

    // Deletar achievement (cascade vai deletar user_achievements relacionados)
    const { error } = await serviceRoleSupabase
      .from('achievements')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting achievement:', error)
      return NextResponse.json({ error: error.message || 'Erro ao deletar achievement' }, { status: 500 })
    }

    // Log da mudança
    await serviceRoleSupabase.rpc('log_gamification_change', {
      p_change_type: 'delete',
      p_entity_type: 'achievement',
      p_entity_id: id,
      p_old_value: oldAchievement,
      p_new_value: null,
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/gamification/achievements/[id]:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

