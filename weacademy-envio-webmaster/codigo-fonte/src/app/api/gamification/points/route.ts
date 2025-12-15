import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = "force-dynamic"

// Função auxiliar para autenticação
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

// GET /api/gamification/points - Obter histórico de pontos do usuário
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sourceType = searchParams.get('source_type')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${request.headers.get('authorization')?.replace('Bearer ', '')}`,
          },
        },
      }
    )

    let query = supabase
      .from('user_points')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (sourceType) {
      query = query.eq('source_type', sourceType)
    }

    const { data: points, error, count } = await query

    if (error) {
      console.error('Error fetching points:', error)
      return NextResponse.json({ error: 'Erro ao buscar pontos' }, { status: 500 })
    }

    return NextResponse.json({
      points: points || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('Error in GET /api/gamification/points:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/gamification/points - Adicionar pontos manualmente (admin apenas)
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar se é admin
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

    const body = await request.json()
    const { user_id, points, source_type, source_id, metadata } = body

    // Validações
    if (!user_id || !points || !source_type) {
      return NextResponse.json(
        { error: 'user_id, points e source_type são obrigatórios' },
        { status: 400 }
      )
    }

    if (points <= 0) {
      return NextResponse.json(
        { error: 'Pontos devem ser maiores que zero' },
        { status: 400 }
      )
    }

    // Usar função SQL para adicionar pontos (garante consistência)
    const { data, error } = await serviceRoleSupabase.rpc('add_user_points', {
      p_user_id: user_id,
      p_points: points,
      p_source_type: source_type,
      p_source_id: source_id || null,
      p_metadata: metadata || {},
    })

    if (error) {
      console.error('Error adding points:', error)
      return NextResponse.json({ error: error.message || 'Erro ao adicionar pontos' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      point_id: data,
    })
  } catch (error: any) {
    console.error('Error in POST /api/gamification/points:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

