import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { knowledgeBaseSchema } from '@/lib/validations/knowledgeBase.schema'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/lab-ia/admin/knowledge-bases
 * Lista knowledge bases
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticar usuário
    const supabase = await supabaseServer()
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user
    if (token) {
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      }
    }

    if (!user) {
      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !sessionUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = sessionUser
    }

    // Usar service role para bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar role do usuário
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Buscar parâmetros
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')
    const isGlobal = searchParams.get('is_global')

    let query = serviceSupabase
      .from('lab_knowledge_bases')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filtrar por usuário se não for admin
    if (!profile || profile.role !== 'admin') {
      query = query.eq('user_id', user.id)
    }

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    if (isGlobal !== null) {
      query = query.eq('is_global', isGlobal === 'true')
    }

    const { data: knowledgeBases, error, count } = await query

    if (error) {
      console.error('[Knowledge Bases API] Erro ao buscar:', error)
      return NextResponse.json(
        { error: error.message || 'Erro ao buscar knowledge bases' },
        { status: 400 }
      )
    }

    // Buscar informações dos agentes separadamente se necessário
    const knowledgeBasesWithAgents = await Promise.all(
      (knowledgeBases || []).map(async (kb) => {
        if (kb.agent_id) {
          const { data: agent } = await serviceSupabase
            .from('lab_agents')
            .select('id, name')
            .eq('id', kb.agent_id)
            .single()
          
          return {
            ...kb,
            agent: agent || null,
          }
        }
        return {
          ...kb,
          agent: null,
        }
      })
    )

    return NextResponse.json({
      knowledge_bases: knowledgeBasesWithAgents,
      total: count || 0,
    })
  } catch (error: any) {
    console.error('[Knowledge Bases API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lab-ia/admin/knowledge-bases
 * Cria nova knowledge base
 */
export async function POST(request: NextRequest) {
  try {
    // Autenticar usuário
    const supabase = await supabaseServer()
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let user
    if (token) {
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      if (!tokenError && tokenUser) {
        user = tokenUser
      }
    }

    if (!user) {
      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !sessionUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = sessionUser
    }

    // Usar service role para bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Validar e parsear body
    const body = await request.json()
    const validatedData = knowledgeBaseSchema.parse(body)

    // Verificar se agente existe (se fornecido)
    if (validatedData.agent_id) {
      const { data: agent } = await serviceSupabase
        .from('lab_agents')
        .select('id')
        .eq('id', validatedData.agent_id)
        .single()

      if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
      }
    }

    // Criar knowledge base
    const { data: knowledgeBase, error: insertError } = await serviceSupabase
      .from('lab_knowledge_bases')
      .insert({
        user_id: user.id,
        agent_id: validatedData.agent_id || null,
        name: validatedData.name,
        description: validatedData.description,
        is_global: validatedData.is_global ?? false,
        chunk_size: validatedData.chunk_size,
        chunk_overlap: validatedData.chunk_overlap,
        enabled: validatedData.enabled ?? true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Knowledge Bases API] Erro ao criar:', insertError)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      knowledge_base: knowledgeBase,
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Knowledge Bases API] Erro ao criar:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

