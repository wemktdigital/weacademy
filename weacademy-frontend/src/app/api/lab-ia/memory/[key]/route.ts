import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'
import { forget, remember } from '@/modules/laboratorio-ia/services/memory'

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ key: string }> }
) {
  const params = await props.params
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

    // Deletar memória
    await forget({
      userId: user.id,
      agentId: agentId || null,
      key: decodeURIComponent(params.key),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting memory:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ key: string }> }
) {
  const params = await props.params
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

    // Obter dados do body
    const body = await request.json()
    const { value, importance } = body

    // Validar dados
    if (!value || typeof value !== 'string') {
      return NextResponse.json(
        { error: 'Invalid parameters. value is required and must be a string.' },
        { status: 400 }
      )
    }

    // Atualizar memória (remember faz upsert)
    await remember({
      userId: user.id,
      agentId: agentId || null,
      key: decodeURIComponent(params.key),
      value,
      importance: importance || 1,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating memory:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
