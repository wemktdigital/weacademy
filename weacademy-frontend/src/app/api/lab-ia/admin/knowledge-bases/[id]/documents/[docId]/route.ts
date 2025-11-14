import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

/**
 * DELETE /api/lab-ia/admin/knowledge-bases/[id]/documents/[docId]
 * Deleta um documento da knowledge base
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: knowledgeBaseId, docId } = await params

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

    // Verificar se documento existe e usuário tem acesso
    const { data: document } = await serviceSupabase
      .from('lab_knowledge_documents')
      .select('knowledge_base_id')
      .eq('id', docId)
      .eq('knowledge_base_id', knowledgeBaseId)
      .single()

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verificar acesso à knowledge base
    const { data: knowledgeBase } = await serviceSupabase
      .from('lab_knowledge_bases')
      .select('user_id')
      .eq('id', knowledgeBaseId)
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

    // Deletar documento (chunks serão deletados em cascade)
    const { error: deleteError } = await serviceSupabase
      .from('lab_knowledge_documents')
      .delete()
      .eq('id', docId)

    if (deleteError) {
      console.error('[Documents API] Erro ao deletar:', deleteError)
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    })
  } catch (error: any) {
    console.error('[Documents API] Erro ao deletar:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

