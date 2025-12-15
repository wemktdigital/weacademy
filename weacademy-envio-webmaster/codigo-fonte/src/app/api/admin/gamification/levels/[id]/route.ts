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

// PUT /api/admin/gamification/levels/[id] - Atualizar nível
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

    // Buscar nível atual
    const { data: oldLevel, error: fetchError } = await serviceRoleSupabase
      .from('gamification_levels_config')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !oldLevel) {
      return NextResponse.json({ error: 'Nível não encontrado' }, { status: 404 })
    }

    // Validações
    if (body.min_xp !== undefined && body.min_xp < 0) {
      return NextResponse.json(
        { error: 'min_xp deve ser maior ou igual a zero' },
        { status: 400 }
      )
    }

    const minXp = body.min_xp !== undefined ? body.min_xp : oldLevel.min_xp
    const maxXp = body.max_xp !== undefined ? body.max_xp : oldLevel.max_xp

    if (maxXp !== null && maxXp <= minXp) {
      return NextResponse.json(
        { error: 'max_xp deve ser maior que min_xp' },
        { status: 400 }
      )
    }

    // Verificar sobreposição de XP (excluindo o próprio nível)
    if (body.min_xp !== undefined || body.max_xp !== undefined) {
      const { data: overlappingLevels } = await serviceRoleSupabase
        .from('gamification_levels_config')
        .select('level_number, name, min_xp, max_xp')
        .neq('id', id)
        .or(
          `and(min_xp.lte.${minXp},or(max_xp.gte.${minXp},max_xp.is.null)),` +
          `and(min_xp.lte.${maxXp || 999999},or(max_xp.gte.${maxXp || 999999},max_xp.is.null))`
        )

      if (overlappingLevels && overlappingLevels.length > 0) {
        return NextResponse.json(
          { error: 'Este nível sobrepõe com níveis existentes' },
          { status: 400 }
        )
      }
    }

    // Verificar se level_number já existe (se está sendo alterado)
    if (body.level_number && body.level_number !== oldLevel.level_number) {
      const { data: existing } = await serviceRoleSupabase
        .from('gamification_levels_config')
        .select('id')
        .eq('level_number', body.level_number)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Já existe um nível com este número' },
          { status: 400 }
        )
      }
    }

    // Atualizar nível
    const updateData: any = {}
    const allowedFields = ['level_number', 'name', 'min_xp', 'max_xp', 'icon', 'color', 'benefits', 'sort_order']
    
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })

    const { data: level, error } = await serviceRoleSupabase
      .from('gamification_levels_config')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating level:', error)
      return NextResponse.json({ error: error.message || 'Erro ao atualizar nível' }, { status: 500 })
    }

    // Log da mudança
    await serviceRoleSupabase.rpc('log_gamification_change', {
      p_change_type: 'update',
      p_entity_type: 'level',
      p_entity_id: id,
      p_old_value: oldLevel,
      p_new_value: level,
    })

    return NextResponse.json({
      level,
    })
  } catch (error: any) {
    console.error('Error in PUT /api/admin/gamification/levels/[id]:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE /api/admin/gamification/levels/[id] - Deletar nível
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

    // Buscar nível antes de deletar
    const { data: oldLevel, error: fetchError } = await serviceRoleSupabase
      .from('gamification_levels_config')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !oldLevel) {
      return NextResponse.json({ error: 'Nível não encontrado' }, { status: 404 })
    }

    // Verificar se há usuários neste nível
    const { data: usersInLevel } = await serviceRoleSupabase
      .from('user_levels')
      .select('user_id')
      .eq('current_level', oldLevel.level_number)
      .limit(1)

    if (usersInLevel && usersInLevel.length > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar um nível que possui usuários. Reatribua os usuários primeiro.' },
        { status: 400 }
      )
    }

    // Deletar nível
    const { error } = await serviceRoleSupabase
      .from('gamification_levels_config')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting level:', error)
      return NextResponse.json({ error: error.message || 'Erro ao deletar nível' }, { status: 500 })
    }

    // Log da mudança
    await serviceRoleSupabase.rpc('log_gamification_change', {
      p_change_type: 'delete',
      p_entity_type: 'level',
      p_entity_id: id,
      p_old_value: oldLevel,
      p_new_value: null,
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/gamification/levels/[id]:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

