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

// GET /api/gamification/badges - Listar todos os badges disponíveis
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const includeUnlocked = searchParams.get('include_unlocked') === 'true'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Buscar achievements
    let query = supabase
      .from('achievements')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    const { data: achievements, error: achievementsError } = await query

    if (achievementsError) {
      console.error('Error fetching achievements:', achievementsError)
      // Se a tabela não existir, retornar erro mais específico
      if (achievementsError.code === '42P01' || achievementsError.code === 'PGRST202' || achievementsError.message?.includes('does not exist') || achievementsError.message?.includes('Could not find the table')) {
        return NextResponse.json({ 
          error: 'Sistema de gamificação não inicializado',
          details: 'As tabelas de gamificação não foram encontradas. A migration de gamificação precisa ser aplicada ao banco de dados.',
          hint: 'Execute a migration 20250120000000_gamification.sql no Supabase',
          code: achievementsError.code,
          migrationFile: 'supabase/migrations/20250120000000_gamification.sql'
        }, { status: 503 }) // 503 Service Unavailable indica que o serviço não está configurado
      }
      return NextResponse.json({ 
        error: 'Erro ao buscar badges',
        details: achievementsError.message || achievementsError.details || 'Erro desconhecido',
        code: achievementsError.code
      }, { status: 500 })
    }

    // Se solicitado, incluir informação de desbloqueio
    if (includeUnlocked && achievements) {
      const { data: unlockedAchievements } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', user.id)

      const unlockedIds = new Set(unlockedAchievements?.map(ua => ua.achievement_id) || [])

      const achievementsWithUnlocked = achievements.map(achievement => ({
        ...achievement,
        unlocked: unlockedIds.has(achievement.id),
        unlocked_at: null,
      }))

      // Buscar datas de desbloqueio
      if (unlockedIds.size > 0) {
        const { data: unlockedData } = await supabase
          .from('user_achievements')
          .select('achievement_id, unlocked_at')
          .eq('user_id', user.id)
          .in('achievement_id', Array.from(unlockedIds))

        const unlockedMap = new Map(
          unlockedData?.map(ud => [ud.achievement_id, ud.unlocked_at]) || []
        )

        achievementsWithUnlocked.forEach(achievement => {
          if (achievement.unlocked) {
            achievement.unlocked_at = unlockedMap.get(achievement.id) || null
          }
        })
      }

      return NextResponse.json({
        badges: achievementsWithUnlocked,
        total: achievementsWithUnlocked.length,
      })
    }

    return NextResponse.json({
      badges: achievements || [],
      total: achievements?.length || 0,
    })
  } catch (error: any) {
    console.error('Error in GET /api/gamification/badges:', {
      error: error,
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    })
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error?.message || 'Erro desconhecido',
      type: error?.name || 'UnknownError'
    }, { status: 500 })
  }
}

