import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

// GET: Obter preferências do usuário
// PUT: Atualizar preferências do usuário
export async function GET(request: NextRequest) {
  try {
    // Tentar autenticar via header Authorization primeiro
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    let user = null

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

    // Fallback para cookies se não autenticou via token
    if (!user) {
      const supabase = await supabaseServer()
      const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
      if (!authError && cookieUser) {
        user = cookieUser
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: preferences, error } = await serviceRoleSupabase
      .from('lab_user_routing_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = não encontrado

    // Retornar preferências ou defaults
    return NextResponse.json({
      success: true,
      preferences: preferences || {
        intelligent_routing_enabled: true,
        max_cost_usd: null,
        prefer_speed: false,
        prefer_accuracy: false,
      },
    })
  } catch (error: any) {
    console.error('[API] Erro ao buscar preferências:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar preferências' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Tentar autenticar via header Authorization primeiro
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    let user = null

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

    // Fallback para cookies se não autenticou via token
    if (!user) {
      const supabase = await supabaseServer()
      const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
      if (!authError && cookieUser) {
        user = cookieUser
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const {
      intelligentRoutingEnabled,
      maxCostUsd,
      preferSpeed,
      preferAccuracy,
    } = await request.json()

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar se já existe preferência para este usuário
    const { data: existing } = await serviceRoleSupabase
      .from('lab_user_routing_preferences')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let data, error

    if (existing) {
      // Atualizar registro existente
      const updateResult = await serviceRoleSupabase
        .from('lab_user_routing_preferences')
        .update({
          intelligent_routing_enabled: intelligentRoutingEnabled ?? true,
          max_cost_usd: maxCostUsd || null,
          prefer_speed: preferSpeed ?? false,
          prefer_accuracy: preferAccuracy ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single()
      
      data = updateResult.data
      error = updateResult.error
    } else {
      // Inserir novo registro
      const insertResult = await serviceRoleSupabase
        .from('lab_user_routing_preferences')
        .insert({
          user_id: user.id,
          intelligent_routing_enabled: intelligentRoutingEnabled ?? true,
          max_cost_usd: maxCostUsd || null,
          prefer_speed: preferSpeed ?? false,
          prefer_accuracy: preferAccuracy ?? false,
        })
        .select()
        .single()
      
      data = insertResult.data
      error = insertResult.error
    }

    if (error) throw error

    return NextResponse.json({ success: true, preferences: data })
  } catch (error: any) {
    console.error('[API] Erro ao atualizar preferências:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar preferências' },
      { status: 500 }
    )
  }
}

