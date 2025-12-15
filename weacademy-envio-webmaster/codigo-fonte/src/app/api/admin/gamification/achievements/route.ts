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

  // Verificar se é admin
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

// GET /api/admin/gamification/achievements - Listar todos os achievements
export async function GET(request: NextRequest) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const active = searchParams.get('active')
    const includeStats = searchParams.get('include_stats') === 'true'

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = serviceRoleSupabase
      .from('achievements')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    if (active !== null) {
      query = query.eq('active', active === 'true')
    }

    const { data: achievements, error } = await query

    if (error) {
      console.error('Error fetching achievements:', error)
      return NextResponse.json({ error: 'Erro ao buscar achievements' }, { status: 500 })
    }

    // Se solicitado, incluir estatísticas (quantos usuários desbloquearam)
    if (includeStats && achievements) {
      const achievementIds = achievements.map(a => a.id)
      
      const { data: stats } = await serviceRoleSupabase
        .from('user_achievements')
        .select('achievement_id')
        .in('achievement_id', achievementIds)

      const statsMap = new Map<string, number>()
      stats?.forEach(stat => {
        const current = statsMap.get(stat.achievement_id) || 0
        statsMap.set(stat.achievement_id, current + 1)
      })

      const achievementsWithStats = achievements.map(achievement => ({
        ...achievement,
        unlocked_count: statsMap.get(achievement.id) || 0,
      }))

      return NextResponse.json({
        achievements: achievementsWithStats,
        total: achievementsWithStats.length,
      })
    }

    return NextResponse.json({
      achievements: achievements || [],
      total: achievements?.length || 0,
    })
  } catch (error: any) {
    console.error('Error in GET /api/admin/gamification/achievements:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/admin/gamification/achievements - Criar novo achievement
export async function POST(request: NextRequest) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      code,
      name,
      description,
      icon = '🏆',
      category,
      points = 0,
      rarity = 'common',
      conditions = {},
      active = true,
      sort_order = 0,
    } = body

    // Validações
    if (!code || !name || !description || !category) {
      return NextResponse.json(
        { error: 'code, name, description e category são obrigatórios' },
        { status: 400 }
      )
    }

    const validCategories = ['courses', 'quizzes', 'lab-ia', 'community', 'special']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `category deve ser um de: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    const validRarities = ['common', 'rare', 'epic', 'legendary']
    if (!validRarities.includes(rarity)) {
      return NextResponse.json(
        { error: `rarity deve ser um de: ${validRarities.join(', ')}` },
        { status: 400 }
      )
    }

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar se code já existe
    const { data: existing } = await serviceRoleSupabase
      .from('achievements')
      .select('id')
      .eq('code', code)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um achievement com este código' },
        { status: 400 }
      )
    }

    // Criar achievement
    const { data: achievement, error } = await serviceRoleSupabase
      .from('achievements')
      .insert({
        code,
        name,
        description,
        icon,
        category,
        points,
        rarity,
        conditions,
        active,
        sort_order,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating achievement:', error)
      return NextResponse.json({ error: error.message || 'Erro ao criar achievement' }, { status: 500 })
    }

    // Log da mudança
    await serviceRoleSupabase.rpc('log_gamification_change', {
      p_change_type: 'create',
      p_entity_type: 'achievement',
      p_entity_id: achievement.id,
      p_old_value: null,
      p_new_value: achievement,
    })

    return NextResponse.json({
      achievement,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/admin/gamification/achievements:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

