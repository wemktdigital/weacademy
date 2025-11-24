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

// GET /api/admin/gamification/analytics - Estatísticas gerais
export async function GET(request: NextRequest) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Estatísticas gerais
    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: totalAchievements },
      { count: totalLevels },
      { data: userLevels },
      { data: userAchievements },
      { data: allAchievements },
      { data: topUsers },
    ] = await Promise.all([
      serviceRoleSupabase.from('profiles').select('id', { count: 'exact', head: true }),
      serviceRoleSupabase.from('user_levels').select('user_id', { count: 'exact', head: true }),
      serviceRoleSupabase.from('achievements').select('id', { count: 'exact', head: true }).eq('active', true),
      serviceRoleSupabase.from('gamification_levels_config').select('id', { count: 'exact', head: true }),
      serviceRoleSupabase.from('user_levels').select('current_level, total_xp').order('total_xp', { ascending: false }).limit(10),
      serviceRoleSupabase.from('user_achievements').select('achievement_id'),
      serviceRoleSupabase.from('achievements').select('id, name, code, icon, category').eq('active', true),
      serviceRoleSupabase
        .from('user_levels')
        .select(`
          total_xp,
          current_level,
          user_id
        `)
        .order('total_xp', { ascending: false })
        .limit(10),
    ])

    // Buscar perfis dos top usuários
    const topUserIds = topUsers?.map(tu => tu.user_id) || []
    const { data: topUsersProfiles } = await serviceRoleSupabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', topUserIds)

    const profileMap = new Map(topUsersProfiles?.map(p => [p.id, p]) || [])
    const topUsersWithProfiles = topUsers?.map(tu => ({
      user_id: tu.user_id,
      full_name: profileMap.get(tu.user_id)?.full_name || null,
      avatar_url: profileMap.get(tu.user_id)?.avatar_url || null,
      total_xp: tu.total_xp || 0,
      current_level: tu.current_level || 1,
    })) || []

    // Calcular distribuição de níveis
    const levelDistribution: Record<number, number> = {}
    userLevels?.forEach(ul => {
      const level = ul.current_level
      levelDistribution[level] = (levelDistribution[level] || 0) + 1
    })

    // Calcular taxa de engajamento
    const engagementRate = totalUsers > 0 ? ((activeUsers || 0) / totalUsers) * 100 : 0

    // Calcular badges mais desbloqueados
    const achievementUnlockCounts = new Map<string, number>()
    userAchievements?.forEach(ua => {
      const current = achievementUnlockCounts.get(ua.achievement_id) || 0
      achievementUnlockCounts.set(ua.achievement_id, current + 1)
    })

    const mostUnlocked = Array.from(achievementUnlockCounts.entries())
      .map(([id, count]) => {
        const achievement = allAchievements?.find((a: any) => a.id === id)
        return achievement ? { ...achievement, unlocked_count: count } : null
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.unlocked_count - a.unlocked_count)
      .slice(0, 10)

    return NextResponse.json({
      analytics: {
        overview: {
          total_users: totalUsers || 0,
          active_users: activeUsers || 0,
          engagement_rate: Math.round(engagementRate * 100) / 100,
          total_achievements: totalAchievements || 0,
          total_levels: totalLevels || 0,
        },
        level_distribution: levelDistribution,
        top_users: topUsersWithProfiles,
        most_unlocked_achievements: mostUnlocked,
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/admin/gamification/analytics:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

