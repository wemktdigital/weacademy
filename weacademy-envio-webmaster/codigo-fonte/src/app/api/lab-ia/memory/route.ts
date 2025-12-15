import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'
import { listMemories, clearAllMemories, remember } from '@/modules/laboratorio-ia/services/memory'

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

    // Buscar parâmetros
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    // Listar memórias
    const memories = await listMemories({
      userId: user.id,
      agentId: agentId || null,
    })

    return NextResponse.json({ memories })
  } catch (error) {
    console.error('Error fetching memories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
    const { key, value, importance, agentId } = body

    // Validar dados
    if (!key || typeof key !== 'string' || !value || typeof value !== 'string') {
      return NextResponse.json(
        { error: 'Invalid parameters. key and value are required and must be strings.' },
        { status: 400 }
      )
    }

    // Validar importância
    const validImportance = importance && typeof importance === 'number' && importance >= 1 && importance <= 5
      ? importance
      : 1

    // Criar/atualizar memória (remember faz upsert)
    await remember({
      userId: user.id,
      agentId: agentId || null,
      key: key.trim(),
      value: value.trim(),
      importance: validImportance,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error creating memory:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    // Buscar parâmetros
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    // Limpar memórias
    await clearAllMemories({
      userId: user.id,
      agentId: agentId || null,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing memories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
