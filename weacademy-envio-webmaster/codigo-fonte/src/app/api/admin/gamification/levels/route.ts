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

// GET /api/admin/gamification/levels - Listar todos os níveis
export async function GET(request: NextRequest) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('include_stats') === 'true'

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: levels, error } = await serviceRoleSupabase
      .from('gamification_levels_config')
      .select('*')
      .order('level_number', { ascending: true })

    if (error) {
      console.error('Error fetching levels:', error)
      return NextResponse.json({ error: 'Erro ao buscar níveis' }, { status: 500 })
    }

    // Se solicitado, incluir estatísticas (quantos usuários em cada nível)
    if (includeStats && levels) {
      const { data: userLevels } = await serviceRoleSupabase
        .from('user_levels')
        .select('current_level')

      const statsMap = new Map<number, number>()
      userLevels?.forEach(ul => {
        const current = statsMap.get(ul.current_level) || 0
        statsMap.set(ul.current_level, current + 1)
      })

      const levelsWithStats = levels.map(level => ({
        ...level,
        users_count: statsMap.get(level.level_number) || 0,
      }))

      return NextResponse.json({
        levels: levelsWithStats,
        total: levelsWithStats.length,
      })
    }

    return NextResponse.json({
      levels: levels || [],
      total: levels?.length || 0,
    })
  } catch (error: any) {
    console.error('Error in GET /api/admin/gamification/levels:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/admin/gamification/levels - Criar novo nível
export async function POST(request: NextRequest) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      level_number,
      name,
      min_xp,
      max_xp = null,
      icon = '⭐',
      color = '#29CEDF',
      benefits = [],
      sort_order = 0,
    } = body

    // Validações
    if (!level_number || !name || min_xp === undefined) {
      return NextResponse.json(
        { error: 'level_number, name e min_xp são obrigatórios' },
        { status: 400 }
      )
    }

    if (min_xp < 0) {
      return NextResponse.json(
        { error: 'min_xp deve ser maior ou igual a zero' },
        { status: 400 }
      )
    }

    if (max_xp !== null && max_xp <= min_xp) {
      return NextResponse.json(
        { error: 'max_xp deve ser maior que min_xp' },
        { status: 400 }
      )
    }

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar se level_number já existe
    const { data: existing } = await serviceRoleSupabase
      .from('gamification_levels_config')
      .select('id')
      .eq('level_number', level_number)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um nível com este número' },
        { status: 400 }
      )
    }

    // Verificar sobreposição de XP
    const { data: overlappingLevels } = await serviceRoleSupabase
      .from('gamification_levels_config')
      .select('level_number, name, min_xp, max_xp')
      .or(
        `and(min_xp.lte.${min_xp},max_xp.gte.${min_xp}),` +
        `and(min_xp.lte.${max_xp || 999999},max_xp.gte.${max_xp || 999999})`
      )

    if (overlappingLevels && overlappingLevels.length > 0) {
      return NextResponse.json(
        { error: 'Este nível sobrepõe com níveis existentes' },
        { status: 400 }
      )
    }

    // Criar nível
    const { data: level, error } = await serviceRoleSupabase
      .from('gamification_levels_config')
      .insert({
        level_number,
        name,
        min_xp,
        max_xp,
        icon,
        color,
        benefits,
        sort_order,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating level:', error)
      return NextResponse.json({ error: error.message || 'Erro ao criar nível' }, { status: 500 })
    }

    // Log da mudança
    await serviceRoleSupabase.rpc('log_gamification_change', {
      p_change_type: 'create',
      p_entity_type: 'level',
      p_entity_id: level.id,
      p_old_value: null,
      p_new_value: level,
    })

    return NextResponse.json({
      level,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/admin/gamification/levels:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PUT /api/admin/gamification/levels/reorder - Reordenar níveis
export async function PUT(request: NextRequest) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'reorder') {
      const body = await request.json()
      const { level_orders } = body // Array de { id, sort_order }

      if (!Array.isArray(level_orders)) {
        return NextResponse.json({ error: 'level_orders deve ser um array' }, { status: 400 })
      }

      const serviceRoleSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Atualizar sort_order de cada nível
      const updates = level_orders.map((lo: any) =>
        serviceRoleSupabase
          .from('gamification_levels_config')
          .update({ sort_order: lo.sort_order })
          .eq('id', lo.id)
      )

      await Promise.all(updates)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 })
  } catch (error: any) {
    console.error('Error in PUT /api/admin/gamification/levels:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

