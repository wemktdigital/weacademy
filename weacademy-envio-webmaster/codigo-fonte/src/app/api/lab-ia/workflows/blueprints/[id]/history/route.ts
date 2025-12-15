import { NextRequest, NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabaseServer'

function parseHistorySettings(settings: any) {
  const notes = settings?.notes ?? null
  const tags = Array.isArray(settings?.tags) ? settings.tags : null
  return { notes, tags }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await supabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: blueprint, error: blueprintError } = await supabase
      .from('lab_workflow_blueprints')
      .select('id, published_workflow_version_id, settings')
      .eq('id', params.id)
      .eq('owner_user_id', user.id)
      .single()

    if (blueprintError || !blueprint) {
      return NextResponse.json({ error: 'Blueprint não encontrado' }, { status: 404 })
    }

    let workflowId: string | null = blueprint?.settings?.workflowId || null

    if (!workflowId && blueprint.published_workflow_version_id) {
      const { data: latestVersion } = await supabase
        .from('lab_workflow_versions')
        .select('workflow_id')
        .eq('id', blueprint.published_workflow_version_id)
        .single()
      workflowId = latestVersion?.workflow_id ?? null
    }

    if (!workflowId) {
      return NextResponse.json({ history: [] })
    }

    const { data: versions, error: versionsError } = await supabase
      .from('lab_workflow_versions')
      .select('id, version_label, created_at, is_active, settings')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false })

    if (versionsError) {
      throw versionsError
    }

    const versionIds = versions?.map((version) => version.id) ?? []

    const { data: stageAgg } = versionIds.length
      ? await supabase
          .from('lab_workflow_stages')
          .select('workflow_version_id, id')
          .in('workflow_version_id', versionIds)
      : { data: [] }

    const { data: edgeAgg } = versionIds.length
      ? await supabase
          .from('lab_workflow_edges')
          .select('workflow_version_id, id')
          .in('workflow_version_id', versionIds)
      : { data: [] }

    const stageByVersion = new Map<string, number>()
    ;(stageAgg || []).forEach((row: any) => {
      stageByVersion.set(row.workflow_version_id, (stageByVersion.get(row.workflow_version_id) ?? 0) + 1)
    })

    const edgeByVersion = new Map<string, number>()
    ;(edgeAgg || []).forEach((row: any) => {
      edgeByVersion.set(row.workflow_version_id, (edgeByVersion.get(row.workflow_version_id) ?? 0) + 1)
    })

    const enriched = (versions || []).map((version) => {
      const extracted = parseHistorySettings(version.settings)
      return {
        version_id: version.id,
        version_label: version.version_label,
        created_at: version.created_at,
        is_active: version.is_active,
        stage_count: stageByVersion.get(version.id) ?? 0,
        edge_count: edgeByVersion.get(version.id) ?? 0,
        notes: extracted.notes,
        tags: extracted.tags,
      }
    })

    return NextResponse.json({ history: enriched })
  } catch (error: any) {
    console.error('[Workflows][Blueprints][History] Erro ao listar histórico:', error)
    return NextResponse.json({ error: error.message || 'Erro ao listar histórico' }, { status: 500 })
  }
}


