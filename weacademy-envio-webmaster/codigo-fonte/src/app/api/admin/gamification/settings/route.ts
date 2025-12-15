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

// GET /api/admin/gamification/settings - Obter configurações
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

    const { data: settings, error } = await serviceRoleSupabase
      .from('gamification_settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error)
      return NextResponse.json({ error: 'Erro ao buscar configurações' }, { status: 500 })
    }

    // Retornar configurações padrão se não existir
    if (!settings) {
      return NextResponse.json({
        settings: {
          id: '00000000-0000-0000-0000-000000000000',
          settings: {
            xp_multiplier: 1.0,
            streak_bonus: 0.1,
          },
          enabled: true,
          beta_users: [],
          updated_at: new Date().toISOString(),
          updated_by: null,
        },
      })
    }

    return NextResponse.json({
      settings,
    })
  } catch (error: any) {
    console.error('Error in GET /api/admin/gamification/settings:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PUT /api/admin/gamification/settings - Atualizar configurações
export async function PUT(request: NextRequest) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { settings, enabled, beta_users } = body

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar configurações atuais
    const { data: oldSettings } = await serviceRoleSupabase
      .from('gamification_settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single()

    const updateData: any = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }

    if (settings !== undefined) {
      updateData.settings = settings
    }

    if (enabled !== undefined) {
      updateData.enabled = enabled
    }

    if (beta_users !== undefined) {
      updateData.beta_users = beta_users
    }

    // Upsert configurações
    const { data: updatedSettings, error } = await serviceRoleSupabase
      .from('gamification_settings')
      .upsert({
        id: '00000000-0000-0000-0000-000000000000',
        ...updateData,
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating settings:', error)
      return NextResponse.json({ error: error.message || 'Erro ao atualizar configurações' }, { status: 500 })
    }

    // Log da mudança
    await serviceRoleSupabase.rpc('log_gamification_change', {
      p_change_type: 'update',
      p_entity_type: 'settings',
      p_entity_id: '00000000-0000-0000-0000-000000000000',
      p_old_value: oldSettings,
      p_new_value: updatedSettings,
    })

    return NextResponse.json({
      settings: updatedSettings,
    })
  } catch (error: any) {
    console.error('Error in PUT /api/admin/gamification/settings:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

