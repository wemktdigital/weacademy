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

// POST /api/admin/gamification/migrate - Executar migração de usuários existentes
export async function POST(request: NextRequest) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Executar função de migração
    const { data: migratedCount, error } = await serviceRoleSupabase.rpc('migrate_existing_users_gamification')

    if (error) {
      console.error('Error migrating users:', error)
      return NextResponse.json({ error: error.message || 'Erro ao migrar usuários' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      migrated_count: migratedCount || 0,
      message: `${migratedCount || 0} usuário(s) migrado(s) com sucesso`,
    })
  } catch (error: any) {
    console.error('Error in POST /api/admin/gamification/migrate:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

