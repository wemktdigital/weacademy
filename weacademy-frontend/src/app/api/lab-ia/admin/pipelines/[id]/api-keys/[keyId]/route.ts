import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

/**
 * DELETE /api/lab-ia/admin/pipelines/[id]/api-keys/[keyId]
 * Deleta uma API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  try {
    const { id: pipelineId, keyId } = await params

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

    // Verificar se API key existe e usuário tem acesso
    const { data: apiKey } = await serviceSupabase
      .from('lab_pipeline_api_keys')
      .select('user_id, pipeline_id')
      .eq('id', keyId)
      .eq('pipeline_id', pipelineId)
      .single()

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Verificar role do usuário
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile && ['admin', 'gestor_we', 'gestor'].includes(profile.role)
    if (apiKey.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Deletar API key
    const { error: deleteError } = await serviceSupabase
      .from('lab_pipeline_api_keys')
      .delete()
      .eq('id', keyId)

    if (deleteError) {
      console.error('[API Keys] Erro ao deletar key:', deleteError)
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully',
    })
  } catch (error: any) {
    console.error('[API Keys] Erro ao deletar key:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
