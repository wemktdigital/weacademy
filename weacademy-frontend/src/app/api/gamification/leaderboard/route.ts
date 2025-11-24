import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = "force-dynamic"

async function authenticateUser(request: NextRequest) {
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

  return user
}

// GET /api/gamification/leaderboard - Obter ranking
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    
    // Leaderboard é público, mas autenticação ajuda a destacar posição do usuário
    
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all-time' // weekly, monthly, all-time
    const limit = parseInt(searchParams.get('limit') || '100')

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Calcular period_value baseado no período
    let periodValue = 'all-time'
    if (period === 'weekly') {
      const now = new Date()
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
      periodValue = `${weekStart.getFullYear()}-W${String(Math.ceil((now.getDate() + 6) / 7)).padStart(2, '0')}`
    } else if (period === 'monthly') {
      const now = new Date()
      periodValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }

    // Verificar se leaderboard já existe e está atualizado (cache de 1 hora)
    const { data: existingEntries } = await serviceRoleSupabase
      .from('leaderboard_entries')
      .select('*')
      .eq('period_type', period)
      .eq('period_value', periodValue)
      .order('rank', { ascending: true })
      .limit(limit)
      .gte('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Cache de 1 hora

    // Se existe cache válido, retornar
    if (existingEntries && existingEntries.length > 0) {
      // Enriquecer com dados do perfil
      const userIds = existingEntries.map(e => e.user_id)
      const { data: profiles } = await serviceRoleSupabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds)

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

      const leaderboard = existingEntries.map(entry => ({
        rank: entry.rank,
        user_id: entry.user_id,
        points: entry.points,
        user: profileMap.get(entry.user_id) || { id: entry.user_id, full_name: null, avatar_url: null },
        is_current_user: user ? entry.user_id === user.id : false,
      }))

      // Buscar posição do usuário se autenticado
      let userRank = null
      if (user) {
        const { data: userEntry } = await serviceRoleSupabase
          .from('leaderboard_entries')
          .select('rank, points')
          .eq('period_type', period)
          .eq('period_value', periodValue)
          .eq('user_id', user.id)
          .single()

        if (userEntry) {
          userRank = {
            rank: userEntry.rank,
            points: userEntry.points,
          }
        }
      }

      return NextResponse.json({
        leaderboard,
        period,
        period_value: periodValue,
        user_rank: userRank,
        cached: true,
      })
    }

    // Se não há cache, atualizar leaderboard
    await serviceRoleSupabase.rpc('refresh_leaderboard', {
      p_period_type: period,
      p_period_value: periodValue,
    })

    // Buscar entradas atualizadas
    const { data: entries } = await serviceRoleSupabase
      .from('leaderboard_entries')
      .select('*')
      .eq('period_type', period)
      .eq('period_value', periodValue)
      .order('rank', { ascending: true })
      .limit(limit)

    // Enriquecer com dados do perfil
    const userIds = entries?.map(e => e.user_id) || []
    const { data: profiles } = await serviceRoleSupabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    const leaderboard = (entries || []).map(entry => ({
      rank: entry.rank,
      user_id: entry.user_id,
      points: entry.points,
      user: profileMap.get(entry.user_id) || { id: entry.user_id, full_name: null, avatar_url: null },
      is_current_user: user ? entry.user_id === user.id : false,
    }))

    // Buscar posição do usuário se autenticado
    let userRank = null
    if (user) {
      const { data: userEntry } = await serviceRoleSupabase
        .from('leaderboard_entries')
        .select('rank, points')
        .eq('period_type', period)
        .eq('period_value', periodValue)
        .eq('user_id', user.id)
        .single()

      if (userEntry) {
        userRank = {
          rank: userEntry.rank,
          points: userEntry.points,
        }
      }
    }

    return NextResponse.json({
      leaderboard,
      period,
      period_value: periodValue,
      user_rank: userRank,
      cached: false,
    })
  } catch (error: any) {
    console.error('Error in GET /api/gamification/leaderboard:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

