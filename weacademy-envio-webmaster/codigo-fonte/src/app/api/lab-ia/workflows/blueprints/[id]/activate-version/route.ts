import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

const bodySchema = z.object({
  versionId: z.string().uuid(),
  updateDraft: z.boolean().optional().default(false),
})

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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const json = await request.json()
    const { versionId, updateDraft } = bodySchema.parse(json)

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
      .select('*')
      .eq('id', params.id)
      .eq('owner_user_id', user.id)
      .single()

    if (blueprintError || !blueprint) {
      return NextResponse.json({ error: 'Blueprint não encontrado' }, { status: 404 })
    }

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: versionRecord, error: versionError } = await serviceSupabase
      .from('lab_workflow_versions')
      .select('*')
      .eq('id', versionId)
      .single()

    if (versionError || !versionRecord) {
      return NextResponse.json({ error: 'Versão não encontrada' }, { status: 404 })
    }

    const workflowId =
      versionRecord.workflow_id ||
      blueprint.settings?.workflowId ||
      null

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow não encontrado para esta versão' }, { status: 400 })
    }

    // Desativar versões anteriores e ativar versão escolhida
    await serviceSupabase
      .from('lab_workflow_versions')
      .update({ is_active: false })
      .eq('workflow_id', workflowId)

    await serviceSupabase
      .from('lab_workflow_versions')
      .update({ is_active: true })
      .eq('id', versionId)

    let updatedCanvas = blueprint.canvas
    let updatedSettings = {
      ...(blueprint.settings || {}),
      workflowId,
      lastPublishedVersionLabel: versionRecord.version_label,
      lastPublishedAt: new Date().toISOString(),
    }

    if (updateDraft) {
      const { data: stages } = await serviceSupabase
        .from('lab_workflow_stages')
        .select('*')
        .eq('workflow_version_id', versionId)
        .order('order_hint', { ascending: true })

      const { data: edges } = await serviceSupabase
        .from('lab_workflow_edges')
        .select('*')
        .eq('workflow_version_id', versionId)

      const stageKeyMap = new Map<string, string>()
      ;(stages || []).forEach((stage: any) => {
        stageKeyMap.set(stage.id, stage.stage_key)
      })

      const nodes = (stages || []).map(mapStageToNode)
      const connections = (edges || [])
        .map((edge: any) => mapEdgeToConnection(edge, stageKeyMap))
        .filter(Boolean)

      updatedCanvas = {
        nodes,
        edges: connections,
        viewport: { x: 0, y: 0, zoom: 1 },
      }

      updatedSettings = {
        ...updatedSettings,
        global: versionRecord.settings?.global || blueprint.settings?.global || {},
      }
    }

    updatedSettings = {
      ...updatedSettings,
    }

    await serviceSupabase
      .from('lab_workflow_blueprints')
      .update({
        published_workflow_version_id: versionId,
        canvas: updatedCanvas,
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', blueprint.id)

    return NextResponse.json({
      success: true,
      workflowId,
      versionId,
      blueprint: { ...blueprint, canvas: updatedCanvas, settings: updatedSettings },
    })
  } catch (error: any) {
    console.error('[Workflows][Blueprints][ActivateVersion] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao ativar versão' },
      { status: 500 }
    )
  }
}


