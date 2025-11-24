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

// GET /api/gamification/stats - Obter estatísticas completas do usuário
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id') || user.id

    // Se está pedindo stats de outro usuário, verificar permissões
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

    // Usar função SQL para obter estatísticas
    const { data: stats, error } = await serviceRoleSupabase.rpc('get_user_gamification_stats', {
      p_user_id: userId,
    })

    if (error) {
      console.error('Error fetching stats from RPC:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId
      })
      
      // Se a função não existir, retornar erro mais específico
      if (error.code === '42883' || error.code === 'PGRST202' || error.message?.includes('does not exist') || error.message?.includes('Could not find the function')) {
        return NextResponse.json({ 
          error: 'Sistema de gamificação não inicializado',
          details: 'A função SQL de gamificação não foi encontrada. A migration de gamificação precisa ser aplicada ao banco de dados.',
          hint: 'Execute a migration 20250120000000_gamification.sql no Supabase',
          code: error.code,
          migrationFile: 'supabase/migrations/20250120000000_gamification.sql'
        }, { status: 503 }) // 503 Service Unavailable indica que o serviço não está configurado
      }
      
      return NextResponse.json({ 
        error: 'Erro ao buscar estatísticas',
        details: error.message || error.details || 'Erro desconhecido',
        code: error.code
      }, { status: 500 })
    }

    // Se stats for null ou vazio, retornar objeto padrão
    if (!stats) {
      console.warn('Stats is null or undefined for user:', userId)
      return NextResponse.json({
        stats: {
          user_id: userId,
          total_xp: 0,
          current_level: 1,
          level_xp: 0,
          next_level_xp: 100,
          achievements_unlocked: 0,
          achievements_total: 0,
          current_streak: 0,
          longest_streak: 0,
          courses_completed: 0,
          lessons_completed: 0,
          quizzes_passed: 0,
          certificates_earned: 0
        },
      })
    }

    return NextResponse.json({
      stats: stats,
    })
  } catch (error: any) {
    console.error('Error in GET /api/gamification/stats:', {
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

