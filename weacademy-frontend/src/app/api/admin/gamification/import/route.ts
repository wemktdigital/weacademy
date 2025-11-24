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

// POST /api/admin/gamification/import - Importar configuração
export async function POST(request: NextRequest) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { achievements, levels, settings, mode = 'merge' } = body // mode: 'merge' ou 'replace'

    if (!achievements && !levels && !settings) {
      return NextResponse.json({ error: 'Nenhum dado para importar' }, { status: 400 })
    }

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const results: any = {
      achievements: { imported: 0, updated: 0, errors: [] },
      levels: { imported: 0, updated: 0, errors: [] },
      settings: { imported: false, error: null },
    }

    // Importar achievements
    if (achievements && Array.isArray(achievements)) {
      for (const achievement of achievements) {
        try {
          const { id, created_at, ...achievementData } = achievement

          if (mode === 'replace') {
            // Deletar e recriar
            await serviceRoleSupabase.from('achievements').delete().eq('code', achievementData.code)
          }

          const { error } = await serviceRoleSupabase
            .from('achievements')
            .upsert(achievementData, { onConflict: 'code' })

          if (error) {
            results.achievements.errors.push({ code: achievementData.code, error: error.message })
          } else {
            results.achievements.imported++
          }
        } catch (error: any) {
          results.achievements.errors.push({ achievement, error: error.message })
        }
      }
    }

    // Importar levels
    if (levels && Array.isArray(levels)) {
      for (const level of levels) {
        try {
          const { id, created_at, updated_at, ...levelData } = level

          if (mode === 'replace') {
            await serviceRoleSupabase.from('gamification_levels_config').delete().eq('level_number', levelData.level_number)
          }

          const { error } = await serviceRoleSupabase
            .from('gamification_levels_config')
            .upsert(levelData, { onConflict: 'level_number' })

          if (error) {
            results.levels.errors.push({ level_number: levelData.level_number, error: error.message })
          } else {
            results.levels.imported++
          }
        } catch (error: any) {
          results.levels.errors.push({ level, error: error.message })
        }
      }
    }

    // Importar settings
    if (settings) {
      try {
        const { id, ...settingsData } = settings
        const { error } = await serviceRoleSupabase
          .from('gamification_settings')
          .upsert({
            id: '00000000-0000-0000-0000-000000000000',
            ...settingsData,
            updated_by: user.id,
          })

        if (error) {
          results.settings.error = error.message
        } else {
          results.settings.imported = true
        }
      } catch (error: any) {
        results.settings.error = error.message
      }
    }

    return NextResponse.json({
      success: true,
      results,
      mode,
    })
  } catch (error: any) {
    console.error('Error in POST /api/admin/gamification/import:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

