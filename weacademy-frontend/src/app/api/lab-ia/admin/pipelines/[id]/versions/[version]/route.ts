import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import {
  getPipelineVersion,
  getVersionDiff,
  rollbackToVersion,
} from '@/modules/laboratorio-ia/services/pipelineVersioning'

/**
 * GET /api/lab-ia/admin/pipelines/[id]/versions/[version]
 * Busca uma versão específica
 */
export async function GET(
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

    const { searchParams } = new URL(request.url)
    const compareWith = searchParams.get('compare')

    const versionData = await getPipelineVersion(pipelineId, version)

    if (!versionData) {
      return NextResponse.json(
        { error: 'Versão não encontrada' },
        { status: 404 }
      )
    }

    let diff = null
    if (compareWith) {
      // Se solicitar diff, calcular diferenças
      try {
        diff = await getVersionDiff(pipelineId, compareWith, version)
      } catch (error: any) {
        console.warn('Erro ao calcular diff:', error.message)
      }
    }

    return NextResponse.json({
      version: versionData,
      diff,
    })
  } catch (error: any) {
    console.error('[Pipeline Versions API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


