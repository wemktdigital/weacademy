import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { rollbackToVersion } from '@/modules/laboratorio-ia/services/pipelineVersioning'

/**
 * POST /api/lab-ia/admin/pipelines/[id]/versions/[version]/rollback
 * Faz rollback para uma versão específica
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  try {
    const { id: pipelineId, version } = await params

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

    const body = await request.json()
    const { changelog } = body

    const rollbackVersion = await rollbackToVersion(pipelineId, version, user.id, changelog)

    return NextResponse.json({
      success: true,
      version: rollbackVersion,
      message: `Rollback realizado para versão ${version}`,
    })
  } catch (error: any) {
    console.error('[Pipeline Versions API] Erro ao fazer rollback:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

