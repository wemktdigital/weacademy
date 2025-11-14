import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { knowledgeBaseSchema } from '@/lib/validations/knowledgeBase.schema'
import { createClient } from '@supabase/supabase-js'

/**
 * PUT /api/lab-ia/admin/knowledge-bases/[id]
 * Atualiza knowledge base
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
    const validatedData = knowledgeBaseSchema.partial().parse(body)

    // Verificar se knowledge base existe e usuário tem acesso
    const { data: knowledgeBase } = await serviceSupabase
      .from('lab_knowledge_bases')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!knowledgeBase) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 })
    }

    // Verificar role do usuário
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile && ['admin', 'gestor_we', 'gestor'].includes(profile.role)
    if (knowledgeBase.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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

    // Atualizar knowledge base
    const updateData: any = {}
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.is_global !== undefined) updateData.is_global = validatedData.is_global
    if (validatedData.chunk_size !== undefined) updateData.chunk_size = validatedData.chunk_size
    if (validatedData.chunk_overlap !== undefined) updateData.chunk_overlap = validatedData.chunk_overlap
    if (validatedData.enabled !== undefined) updateData.enabled = validatedData.enabled
    if (validatedData.agent_id !== undefined) {
      updateData.agent_id = validatedData.agent_id || null
      // Se agent_id é null, garantir que is_global seja true
      if (validatedData.agent_id === null && updateData.is_global === undefined) {
        updateData.is_global = true
      }
    }

    const { data: updatedKb, error: updateError } = await serviceSupabase
      .from('lab_knowledge_bases')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[Knowledge Bases API] Erro ao atualizar:', updateError)
      throw updateError
    }

    return NextResponse.json({
      success: true,
      knowledge_base: updatedKb,
    })
  } catch (error: any) {
    console.error('[Knowledge Bases API] Erro ao atualizar:', error)
    
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

/**
 * DELETE /api/lab-ia/admin/knowledge-bases/[id]
 * Deleta knowledge base
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Verificar se knowledge base existe e usuário tem acesso
    const { data: knowledgeBase } = await serviceSupabase
      .from('lab_knowledge_bases')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!knowledgeBase) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 })
    }

    // Verificar role do usuário
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile && ['admin', 'gestor_we', 'gestor'].includes(profile.role)
    if (knowledgeBase.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Deletar knowledge base (chunks e documentos serão deletados em cascade)
    const { error: deleteError } = await serviceSupabase
      .from('lab_knowledge_bases')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[Knowledge Bases API] Erro ao deletar:', deleteError)
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'Knowledge base deleted successfully',
    })
  } catch (error: any) {
    console.error('[Knowledge Bases API] Erro ao deletar:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

