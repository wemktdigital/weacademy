import { NextRequest, NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabaseServer'

type Params = { params: { id: string; versionId: string } }

function mapStageToNode(stage: any, index: number) {
  const orderHint = stage.order_hint ?? index
  const defaultPosition = {
    x: (orderHint % 4) * 240,
    y: Math.floor(orderHint / 4) * 180,
  }

  const config = stage.config || {}
  const {
    notifications,
    validateOutput,
    assignment,
    instructions,
    formSchema,
    position,
    ...restConfig
  } = config

  return {
    id: stage.id,
    type: 'default',
    position: position || defaultPosition,
    data: {
      label: stage.name || stage.stage_key,
      stageKey: stage.stage_key,
      stageType: stage.type,
      stageConfig: restConfig,
      humanConfig:
        stage.type === 'human'
          ? {
              assignment: assignment ?? '',
              instructions: instructions ?? '',
              formSchema: formSchema ?? null,
            }
          : {},
      stageConditions: stage.entry_conditions ?? {},
      outputTransforms: stage.exit_actions ?? [],
      validateOutput: Boolean(validateOutput),
      notifications: Array.isArray(notifications) ? notifications : [],
      loopConfig: stage.loop_config || {},
    },
  }
}

function mapEdgeToConnection(edge: any, stageKeyMap: Map<string, string>) {
  const fromKey = stageKeyMap.get(edge.from_stage_id)
  const toKey = stageKeyMap.get(edge.to_stage_id)
  if (!fromKey || !toKey) return null

  return {
    id: edge.id,
    source: edge.from_stage_id,
    target: edge.to_stage_id,
    data: {
      condition: edge.condition || {},
      fromKey,
      toKey,
    },
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
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
      .select('id, owner_user_id, settings, published_workflow_version_id')
      .eq('id', params.id)
      .eq('owner_user_id', user.id)
      .single()

    if (blueprintError || !blueprint) {
      return NextResponse.json({ error: 'Blueprint não encontrado' }, { status: 404 })
    }

    const { data: version, error: versionError } = await supabase
      .from('lab_workflow_versions')
      .select('*')
      .eq('id', params.versionId)
      .single()

    if (versionError || !version) {
      return NextResponse.json({ error: 'Versão não encontrada' }, { status: 404 })
    }

    const { data: stages, error: stagesError } = await supabase
      .from('lab_workflow_stages')
      .select('*')
      .eq('workflow_version_id', version.id)
      .order('order_hint', { ascending: true })

    if (stagesError) {
      throw stagesError
    }

    const stageKeyMap = new Map<string, string>()
    stages?.forEach((stage: any) => {
      stageKeyMap.set(stage.id, stage.stage_key)
    })

    const { data: edges, error: edgesError } = await supabase
      .from('lab_workflow_edges')
      .select('*')
      .eq('workflow_version_id', version.id)

    if (edgesError) {
      throw edgesError
    }

    const nodes = (stages || []).map(mapStageToNode)
    const connections = (edges || [])
      .map((edge: any) => mapEdgeToConnection(edge, stageKeyMap))
      .filter(Boolean)

    const snapshot = {
      version: {
        id: version.id,
        label: version.version_label,
        createdAt: version.created_at,
        isActive: version.is_active,
      },
      nodes,
      edges: connections,
      globalSettings: version.settings?.global || null,
    }

    return NextResponse.json(snapshot)
  } catch (error: any) {
    console.error('[Workflows][Blueprints][History][Detail] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao carregar versão' }, { status: 500 })
  }
}


