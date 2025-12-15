import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação - tentar token primeiro, depois cookies
    let user = null
    
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (token) {
      // Tentar autenticar com token do header
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
    
    // Se não autenticou via token, tentar via cookies
    if (!user) {
      const sb = await supabaseServer()
      const { data: { user: cookieUser }, error: authErr } = await sb.auth.getUser()
      if (!authErr && cookieUser) {
        user = cookieUser
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Buscar configurações do usuário usando service role para garantir acesso
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: settings, error } = await serviceRoleSupabase
      .from('lab_user_settings')
      .select('memory_enabled, memory_auto_extract, memory_reference_history')
      .eq('user_id', user.id)
      .single()

    // Se erro e não for "not found" (PGRST116), verificar se é erro de coluna não existente
    if (error) {
      // PGRST116 = not found (configurações não existem ainda) - OK, retornar padrões
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          memory_enabled: true,
          memory_auto_extract: true,
          memory_reference_history: false,
        })
      }

      // Verificar se é erro de coluna não existente (migration não executada)
      if (error.message && (
        error.message.includes('column') || 
        error.message.includes('does not exist') ||
        error.message.includes('syntax error')
      )) {
        console.warn('[MemorySettings API] Campos de memória não encontrados. Migration pode não ter sido executada.')
        // Retornar configurações padrão mesmo com erro de coluna
        // Isso permite que o frontend funcione enquanto a migration é executada
        return NextResponse.json({
          memory_enabled: true,
          memory_auto_extract: true,
          memory_reference_history: false,
        })
      }

      console.error('Error fetching memory settings:', error)
      return NextResponse.json(
        { error: 'Internal server error', details: error.message },
        { status: 500 }
      )
    }

    // Retornar configurações padrão se não existir
    if (!settings) {
      return NextResponse.json({
        memory_enabled: true,
        memory_auto_extract: true,
        memory_reference_history: false,
      })
    }

    return NextResponse.json({
      memory_enabled: settings.memory_enabled ?? true,
      memory_auto_extract: settings.memory_auto_extract ?? true,
      memory_reference_history: settings.memory_reference_history ?? false,
    })
  } catch (error) {
    console.error('Error fetching memory settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verificar autenticação - tentar token primeiro, depois cookies
    let user = null
    
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (token) {
      // Tentar autenticar com token do header
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
    
    // Se não autenticou via token, tentar via cookies
    if (!user) {
      const sb = await supabaseServer()
      const { data: { user: cookieUser }, error: authErr } = await sb.auth.getUser()
      if (!authErr && cookieUser) {
        user = cookieUser
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Obter dados do body
    const body = await request.json()
    const { memory_enabled, memory_auto_extract, memory_reference_history } = body

    // Validar dados
    if (
      memory_enabled !== undefined && typeof memory_enabled !== 'boolean' ||
      memory_auto_extract !== undefined && typeof memory_auto_extract !== 'boolean' ||
      memory_reference_history !== undefined && typeof memory_reference_history !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'Invalid parameters. All values must be boolean.' },
        { status: 400 }
      )
    }

    // Preparar dados para atualização
    const updateData: {
      memory_enabled?: boolean
      memory_auto_extract?: boolean
      memory_reference_history?: boolean
      user_id?: string
    } = {}

    if (memory_enabled !== undefined) updateData.memory_enabled = memory_enabled
    if (memory_auto_extract !== undefined) updateData.memory_auto_extract = memory_auto_extract
    if (memory_reference_history !== undefined) updateData.memory_reference_history = memory_reference_history

    // Usar service role para garantir acesso
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar se configurações já existem
    const { data: existing } = await serviceRoleSupabase
      .from('lab_user_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      // Atualizar configurações existentes
      const { data, error } = await serviceRoleSupabase
        .from('lab_user_settings')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating memory settings:', error)
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        memory_enabled: data.memory_enabled ?? true,
        memory_auto_extract: data.memory_auto_extract ?? true,
        memory_reference_history: data.memory_reference_history ?? false,
      })
    } else {
      // Criar novas configurações
      updateData.user_id = user.id
      const { data, error } = await serviceRoleSupabase
        .from('lab_user_settings')
        .insert(updateData)
        .select()
        .single()

      if (error) {
        console.error('Error creating memory settings:', error)
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        memory_enabled: data.memory_enabled ?? true,
        memory_auto_extract: data.memory_auto_extract ?? true,
        memory_reference_history: data.memory_reference_history ?? false,
      })
    }
  } catch (error) {
    console.error('Error updating memory settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

