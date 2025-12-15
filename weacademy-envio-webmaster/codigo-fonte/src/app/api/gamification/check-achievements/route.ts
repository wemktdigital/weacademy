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

// POST /api/gamification/check-achievements - Verificar e desbloquear conquistas
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const userId = body.user_id || user.id

    // Verificar permissões se está verificando para outro usuário
    if (userId !== user.id) {
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
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
      }
    }

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar e desbloquear achievements
    const { data: unlockedCount, error } = await serviceRoleSupabase.rpc('check_and_unlock_achievements', {
      p_user_id: userId,
    })

    if (error) {
      console.error('Error checking achievements:', error)
      return NextResponse.json({ error: error.message || 'Erro ao verificar conquistas' }, { status: 500 })
    }

    // Buscar achievements recém-desbloqueados
    const { data: newAchievements } = await serviceRoleSupabase
      .from('user_achievements')
      .select(`
        unlocked_at,
        achievement:achievements(*)
      `)
      .eq('user_id', userId)
      .gte('unlocked_at', new Date(Date.now() - 5000).toISOString()) // Últimos 5 segundos

    return NextResponse.json({
      success: true,
      unlocked_count: unlockedCount || 0,
      new_achievements: newAchievements?.map(ua => ua.achievement) || [],
    })
  } catch (error: any) {
    console.error('Error in POST /api/gamification/check-achievements:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

