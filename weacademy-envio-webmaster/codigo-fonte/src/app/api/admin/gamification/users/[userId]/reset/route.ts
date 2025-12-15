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

// POST /api/admin/gamification/users/[userId]/reset - Resetar XP/badges de usuário
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { userId } = await params
    const body = await request.json()
    const { reset_xp = true, reset_achievements = true, reset_streak = true } = body

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar se usuário existe
    const { data: targetUser } = await serviceRoleSupabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const results: any = {
      xp_reset: false,
      achievements_reset: false,
      streak_reset: false,
    }

    // Resetar XP
    if (reset_xp) {
      await serviceRoleSupabase
        .from('user_levels')
        .update({
          total_xp: 0,
          current_level: 1,
          level_xp: 0,
          next_level_xp: 100,
        })
        .eq('user_id', userId)

      // Deletar histórico de pontos
      await serviceRoleSupabase
        .from('user_points')
        .delete()
        .eq('user_id', userId)

      results.xp_reset = true
    }

    // Resetar achievements
    if (reset_achievements) {
      await serviceRoleSupabase
        .from('user_achievements')
        .delete()
        .eq('user_id', userId)

      results.achievements_reset = true
    }

    // Resetar streak
    if (reset_streak) {
      await serviceRoleSupabase
        .from('user_streaks')
        .update({
          current_streak: 0,
          longest_streak: 0,
          last_study_date: null,
        })
        .eq('user_id', userId)

      results.streak_reset = true
    }

    return NextResponse.json({
      success: true,
      results,
      message: 'Usuário resetado com sucesso',
    })
  } catch (error: any) {
    console.error('Error in POST /api/admin/gamification/users/[userId]/reset:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

