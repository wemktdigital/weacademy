import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Criar cliente com service role para operações admin
const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// Helper para autenticação
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

  // Verificar se é admin
  const { data: profile } = await serviceRoleSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  return { user, isAdmin }
}

// GET - Listar notificações (com filtros)
export async function GET(request: NextRequest) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = serviceRoleSupabase
      .from('notifications')
      .select(`
        *,
        user:profiles!notifications_user_id_fkey(id, email, full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Erro ao buscar notificações:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar notificações', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      notifications: data || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('Erro inesperado:', error)
    return NextResponse.json(
      { error: 'Erro inesperado', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Criar notificação(s)
export async function POST(request: NextRequest) {
  try {
    const { user, isAdmin } = await authenticateAdmin(request)
    
    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      user_ids, // Array de IDs ou 'all' para todos os usuários
      title, 
      message, 
      type = 'info',
      metadata = {}
    } = body

    // Validação
    if (!title || !message) {
      return NextResponse.json(
        { error: 'Título e mensagem são obrigatórios' },
        { status: 400 }
      )
    }

    if (!['info', 'success', 'warning', 'error', 'achievement', 'level_up', 'streak', 'leaderboard'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de notificação inválido' },
        { status: 400 }
      )
    }

    let targetUserIds: string[] = []

    if (user_ids === 'all') {
      // Buscar todos os usuários
      const { data: users, error: usersError } = await serviceRoleSupabase
        .from('profiles')
        .select('id')

      if (usersError) {
        return NextResponse.json(
          { error: 'Erro ao buscar usuários', details: usersError.message },
          { status: 500 }
        )
      }

      targetUserIds = users?.map(u => u.id) || []
    } else if (Array.isArray(user_ids) && user_ids.length > 0) {
      targetUserIds = user_ids
    } else {
      return NextResponse.json(
        { error: 'É necessário especificar user_ids (array) ou "all"' },
        { status: 400 }
      )
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum usuário encontrado para enviar notificação' },
        { status: 400 }
      )
    }

    // Criar notificações para todos os usuários
    const notifications = targetUserIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type,
      read: false,
      metadata,
    }))

    const { data, error } = await serviceRoleSupabase
      .from('notifications')
      .insert(notifications)
      .select()

    if (error) {
      console.error('Erro ao criar notificações:', error)
      return NextResponse.json(
        { error: 'Erro ao criar notificações', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Notificação enviada para ${targetUserIds.length} usuário(s)`,
      notifications: data,
      count: targetUserIds.length,
    })
  } catch (error: any) {
    console.error('Erro inesperado:', error)
    return NextResponse.json(
      { error: 'Erro inesperado', details: error.message },
      { status: 500 }
    )
  }
}

