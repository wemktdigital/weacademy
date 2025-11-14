import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import {
  getPipelineVersions,
  createPipelineVersion,
  getLatestVersion,
  getNextVersion,
  rollbackToVersion,
  getVersionHistory,
  getReleaseTags,
  createReleaseTag,
} from '@/modules/laboratorio-ia/services/pipelineVersioning'

/**
 * GET /api/lab-ia/admin/pipelines/[id]/versions
 * Lista versões de um pipeline
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pipelineId } = await params

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
    const includeDrafts = searchParams.get('include_drafts') === 'true'
    const includeArchived = searchParams.get('include_archived') === 'true'

    const versions = await getPipelineVersions(pipelineId, {
      includeDrafts,
      includeArchived,
    })

    // Buscar histórico e tags
    const history = await getVersionHistory(pipelineId, 20)
    const tags = await getReleaseTags(pipelineId)

    return NextResponse.json({
      versions,
      history,
      tags,
    })
  } catch (error: any) {
    console.error('[Pipeline Versions API] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lab-ia/admin/pipelines/[id]/versions
 * Cria uma nova versão de pipeline
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pipelineId } = await params

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
    const { version, changelog, release_notes, is_release, release_tag, change_type } = body

    let finalVersion = version

    // Se não forneceu versão, calcular próxima baseada no tipo de mudança
    if (!finalVersion && change_type) {
      const nextVersion = await getNextVersion(pipelineId, change_type)
      finalVersion = nextVersion.version
    }

    if (!finalVersion) {
      return NextResponse.json(
        { error: 'version ou change_type é obrigatório' },
        { status: 400 }
      )
    }

    const newVersion = await createPipelineVersion(pipelineId, finalVersion, {
      changelog,
      release_notes,
      is_release: is_release || false,
      release_tag,
      userId: user.id,
    })

    return NextResponse.json({
      success: true,
      version: newVersion,
    }, { status: 201 })
  } catch (error: any) {
    console.error('[Pipeline Versions API] Erro ao criar versão:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

