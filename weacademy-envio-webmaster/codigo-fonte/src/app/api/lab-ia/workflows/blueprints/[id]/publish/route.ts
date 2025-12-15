import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { supabaseServer } from '@/lib/supabaseServer'

const publishSchema = z.object({
  versionLabel: z.string().trim().min(1, 'Informe um rótulo de versão (ex: v1.0.0)'),
  activate: z.boolean().optional().default(true),
})

function isUuid(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value
  )
}

type BlueprintRecord = {
  id: string
  owner_user_id: string
  name: string
  description?: string | null
  category?: string | null
  tags?: string[] | null
  canvas?: {
    nodes?: any[]
    edges?: any[]
  } | null
  settings?: Record<string, any> | null
  published_workflow_version_id?: string | null
}

const ALLOWED_STAGE_TYPES = new Set(['pipeline', 'human', 'delay', 'webhook'])

function sanitizeStageType(input: any): 'pipeline' | 'human' | 'delay' | 'webhook' {
  if (typeof input !== 'string') return 'pipeline'
  const value = input.toLowerCase()
  if (ALLOWED_STAGE_TYPES.has(value)) {
    return value as 'pipeline' | 'human' | 'delay' | 'webhook'
  }
  return 'pipeline'
}

function slugify(value: string, fallback: string) {
  const base = (value || fallback || 'stage')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return base || fallback || 'stage'
}

function normalizeConditions(value: any): any[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'object') return [value]
  if (typeof value === 'string' && value.trim().length > 0) {
    return [{ expression: value.trim() }]
  }
  return []
}

function normalizeArray(value: any, fallback: any[] = []): any[] {
  if (!value) return fallback
  if (Array.isArray(value)) return value
  return fallback
}

function normalizeHumanAssignment(input: any) {
  if (!input || typeof input !== 'object') return null
  const mode = typeof input.mode === 'string' ? input.mode.toLowerCase() : undefined
  if (!['user', 'role', 'group', 'dynamic'].includes(mode || '')) {
    return null
  }

  const result: Record<string, any> = { mode }
  if (Array.isArray(input.users)) result.users = input.users.filter(Boolean)
  if (Array.isArray(input.roles)) result.roles = input.roles.filter(Boolean)
  if (Array.isArray(input.groups)) result.groups = input.groups.filter(Boolean)
  if (typeof input.dynamicPath === 'string' && input.dynamicPath.trim()) {
    result.dynamicPath = input.dynamicPath.trim()
  }
  if (typeof input.allowSelfAssign === 'boolean') {
    result.allowSelfAssign = input.allowSelfAssign
  }
  if (input.fallback && typeof input.fallback === 'object') {
    const fallbackMode = typeof input.fallback.mode === 'string' ? input.fallback.mode.toLowerCase() : undefined
    if (['user', 'role', 'group', 'dynamic'].includes(fallbackMode || '')) {
      const fallback: Record<string, any> = { mode: fallbackMode }
      if (Array.isArray(input.fallback.targetIds)) {
        fallback.targetIds = input.fallback.targetIds.filter(Boolean)
      }
      if (typeof input.fallback.dynamicPath === 'string' && input.fallback.dynamicPath.trim()) {
        fallback.dynamicPath = input.fallback.dynamicPath.trim()
      }
      result.fallback = fallback
    }
  }
  return result
}

function normalizeHumanApproval(input: any) {
  if (!input || typeof input !== 'object') return null
  const type = typeof input.type === 'string' ? input.type.toLowerCase() : 'single'
  if (!['single', 'majority', 'unanimous'].includes(type)) return null

  const result: Record<string, any> = { type }
  if (typeof input.requiredApprovals === 'number') {
    result.requiredApprovals = Math.max(1, Math.floor(input.requiredApprovals))
  }
  if (typeof input.allowRejectionComments === 'boolean') {
    result.allowRejectionComments = input.allowRejectionComments
  }
  if (typeof input.autoApproveAfterMinutes === 'number') {
    result.autoApproveAfterMinutes = Math.max(1, Math.floor(input.autoApproveAfterMinutes))
  }
  if (typeof input.autoRejectAfterMinutes === 'number') {
    result.autoRejectAfterMinutes = Math.max(1, Math.floor(input.autoRejectAfterMinutes))
  }
  if (typeof input.allowDelegation === 'boolean') {
    result.allowDelegation = input.allowDelegation
  }
  return result
}

function normalizeHumanSla(input: any) {
  if (!input || typeof input !== 'object') return null
  const enabled = Boolean(input.enabled)
  if (!enabled) return null

  const duration = Number(input.durationMinutes)
  if (!Number.isFinite(duration) || duration <= 0) return null

  const result: Record<string, any> = {
    enabled: true,
    durationMinutes: Math.ceil(duration),
  }

  if (input.reminderEveryMinutes != null) {
    const reminder = Number(input.reminderEveryMinutes)
    if (Number.isFinite(reminder) && reminder > 0) {
      result.reminderEveryMinutes = Math.ceil(reminder)
    }
  }

  if (input.maxReminders != null) {
    const maxReminders = Number(input.maxReminders)
    if (Number.isFinite(maxReminders) && maxReminders > 0) {
      result.maxReminders = Math.ceil(maxReminders)
    }
  }

  if (Array.isArray(input.escalationChain)) {
    const escalationChain = input.escalationChain
      .map((item: any) => {
        const mode = typeof item.mode === 'string' ? item.mode.toLowerCase() : undefined
        if (!['user', 'role', 'group', 'dynamic'].includes(mode || '')) return null
        const afterMinutes = Number(item.afterMinutes)
        if (!Number.isFinite(afterMinutes) || afterMinutes <= 0) return null
        const entry: Record<string, any> = {
          mode,
          afterMinutes: Math.ceil(afterMinutes),
        }
        if (typeof item.targetId === 'string' && item.targetId.trim()) {
          entry.targetId = item.targetId.trim()
        }
        if (Array.isArray(item.notifyChannels)) {
          entry.notifyChannels = item.notifyChannels.filter((channel: any) =>
            ['email', 'sms', 'teams', 'webhook', 'whatsapp'].includes(String(channel).toLowerCase())
          )
        }
        return entry
      })
      .filter(Boolean)
    if (escalationChain.length > 0) {
      result.escalationChain = escalationChain
    }
  }

  return result
}

function normalizeExternalActions(input: any) {
  if (!input || typeof input !== 'object') return null
  const result: Record<string, any> = {}
  if (Array.isArray(input.notifyChannels)) {
    result.notifyChannels = input.notifyChannels.filter((channel: any) =>
      ['email', 'sms', 'teams', 'whatsapp', 'webhook'].includes(String(channel).toLowerCase())
    )
  }
  if (typeof input.webhookUrl === 'string' && input.webhookUrl.trim()) {
    result.webhookUrl = input.webhookUrl.trim()
  }
  if (input.webhookHeaders && typeof input.webhookHeaders === 'object') {
    result.webhookHeaders = input.webhookHeaders
  }
  if (typeof input.includeContext === 'boolean') {
    result.includeContext = input.includeContext
  }
  return Object.keys(result).length > 0 ? result : null
}

function normalizeHumanConfig(input: any) {
  if (!input || typeof input !== 'object') return {}
  const normalized: Record<string, any> = {}

  if (typeof input.instructions === 'string' && input.instructions.trim()) {
    normalized.instructions = input.instructions.trim()
  }
  if (input.formSchema && typeof input.formSchema === 'object') {
    normalized.formSchema = input.formSchema
  }
  const assignment = normalizeHumanAssignment(input.assignment)
  if (assignment) {
    normalized.assignment = assignment
  }
  const approval = normalizeHumanApproval(input.approval)
  if (approval) {
    normalized.approval = approval
  }
  const sla = normalizeHumanSla(input.sla)
  if (sla) {
    normalized.sla = sla
  }
  const externalActions = normalizeExternalActions(input.externalActions)
  if (externalActions) {
    normalized.externalActions = externalActions
  }
  if (typeof input.allowAttachments === 'boolean') {
    normalized.allowAttachments = input.allowAttachments
  }
  if (input.metadata && typeof input.metadata === 'object') {
    normalized.metadata = input.metadata
  }
  if (input.outputPath && typeof input.outputPath === 'string') {
    normalized.outputPath = input.outputPath
  }
  return normalized
}

function buildStageConfig(data: any, stageType: string) {
  const config: Record<string, any> = { ...(data?.stageConfig || {}) }

  if (stageType === 'human') {
    Object.assign(config, normalizeHumanConfig(data?.humanConfig))
  }

  if (data?.validateOutput !== undefined) {
    config.validateOutput = Boolean(data.validateOutput)
  }

  if (Array.isArray(data?.outputTransforms)) {
    config.outputTransforms = data.outputTransforms
  }

  if (Array.isArray(data?.notifications) && data.notifications.length > 0) {
    config.notifications = data.notifications
  }

  return config
}

function buildLoopConfig(data: any) {
  const loop = data?.loopConfig || {}
  const inner = loop.inner || {}
  return {
    itemsPath: loop.itemsPath || '',
    itemAlias: loop.itemAlias || 'item',
    maxParallel: Number(loop.maxParallel) || 1,
    iterationContextPath: loop.iterationContextPath || '',
    outputPath: loop.outputPath || '',
    accumulateContextPath: loop.accumulateContextPath || '',
    untilCondition: loop.untilCondition || null,
    inner: {
      stageType: inner.stageType || 'pipeline',
      stageConfig: inner.stageConfig || {},
      loopConfig: inner.loopConfig || null,
    },
  }
}

function computeOrderHint(node: any, index: number) {
  const position = node?.position || {}
  const baseY = typeof position.y === 'number' ? position.y : index * 100
  const baseX = typeof position.x === 'number' ? position.x : 0
  return Math.round(baseY * 100) + Math.round(baseX)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await supabaseServer()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsedBody = publishSchema.safeParse(body)
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten().formErrors.join('; ') }, { status: 400 })
    }
    const { versionLabel, activate } = parsedBody.data

    const { data: blueprint, error: blueprintError } = await supabase
      .from('lab_workflow_blueprints')
      .select('*')
      .eq('id', params.id)
      .eq('owner_user_id', authData.user.id)
      .single()

    if (blueprintError || !blueprint) {
      return NextResponse.json({ error: 'Blueprint não encontrado' }, { status: 404 })
    }

    const blueprintRecord = blueprint as BlueprintRecord
    const canvasNodes = Array.isArray(blueprintRecord.canvas?.nodes) ? blueprintRecord.canvas?.nodes ?? [] : []
    const canvasEdges = Array.isArray(blueprintRecord.canvas?.edges) ? blueprintRecord.canvas?.edges ?? [] : []

    if (canvasNodes.length === 0) {
      return NextResponse.json({ error: 'Adicione ao menos uma etapa antes de publicar.' }, { status: 400 })
    }

    const uniqueKeys = new Set<string>()
    const nodeIdToStageKey = new Map<string, string>()

    const sortedNodes = [...canvasNodes].sort((a, b) => {
      const ay = typeof a?.position?.y === 'number' ? a.position.y : 0
      const by = typeof b?.position?.y === 'number' ? b.position.y : 0
      if (ay === by) {
        const ax = typeof a?.position?.x === 'number' ? a.position.x : 0
        const bx = typeof b?.position?.x === 'number' ? b.position.x : 0
        return ax - bx
      }
      return ay - by
    })

    const stagePayloads = sortedNodes.map((node: any, index: number) => {
      const data = node?.data || {}
      const stageType = sanitizeStageType(data.stageType)
      const desiredKey = slugify(data.stageKey || data.label || `stage_${index + 1}`, `stage_${index + 1}`)

      let stageKey = desiredKey
      let counter = 1
      while (uniqueKeys.has(stageKey)) {
        stageKey = `${desiredKey}_${counter++}`
      }
      uniqueKeys.add(stageKey)
      nodeIdToStageKey.set(node.id, stageKey)

      return {
        stage_key: stageKey,
        type: stageType,
        name: data.label || stageKey,
        config: stageType === 'loop' ? {} : buildStageConfig(data, stageType),
        loop_config: stageType === 'loop' ? buildLoopConfig(data) : null,
        entry_conditions: normalizeConditions(data.stageConditions),
        exit_actions: normalizeArray(data.outputTransforms),
        order_hint: computeOrderHint(node, index),
      }
    })

    const supabaseSettings = blueprintRecord.settings || {}

    let workflowId: string | null = null
    let workflowRecord: any = null

    if (blueprintRecord.published_workflow_version_id) {
      const { data: latestVersion } = await supabase
        .from('lab_workflow_versions')
        .select('id, workflow_id')
        .eq('id', blueprintRecord.published_workflow_version_id)
        .single()

      if (latestVersion?.workflow_id) {
        workflowId = latestVersion.workflow_id
        const { data: existingWorkflow } = await supabase
          .from('lab_workflows')
          .select('*')
          .eq('id', workflowId)
          .single()
        if (existingWorkflow) {
          workflowRecord = existingWorkflow
        }
      }
    }

    if (!workflowId) {
      const workflowInsert = {
        name: blueprintRecord.name,
        description: blueprintRecord.description ?? null,
        category: blueprintRecord.category ?? null,
        tags: blueprintRecord.tags ?? [],
        metadata: supabaseSettings?.metadata || {},
        created_by: authData.user.id,
      }

      const { data: newWorkflow, error: workflowError } = await supabase
        .from('lab_workflows')
        .insert(workflowInsert)
        .select('*')
        .single()

      if (workflowError || !newWorkflow) {
        throw workflowError || new Error('Não foi possível criar o workflow')
      }

      workflowId = newWorkflow.id
      workflowRecord = newWorkflow
    }

    if (!workflowRecord) {
      const { data: workflowData, error: workflowFetchError } = await supabase
        .from('lab_workflows')
        .select('*')
        .eq('id', workflowId)
        .single()
      if (workflowFetchError || !workflowData) {
        throw workflowFetchError || new Error('Não foi possível recuperar o workflow associado')
      }
      workflowRecord = workflowData
    }

    if (activate) {
      const { error: deactivateError } = await supabase
        .from('lab_workflow_versions')
        .update({ is_active: false })
        .eq('workflow_id', workflowId)

      if (deactivateError) {
        throw deactivateError
      }
    }

    const versionInsert = {
      workflow_id: workflowId,
      version_label: versionLabel,
      is_active: activate,
      settings: supabaseSettings || {},
    }

    const { data: newVersion, error: versionError } = await supabase
      .from('lab_workflow_versions')
      .insert(versionInsert)
      .select('*')
      .single()

    if (versionError || !newVersion) {
      if ((versionError as any)?.code === '23505') {
        return NextResponse.json(
          { error: `Já existe uma versão com o rótulo "${versionLabel}". Escolha outro identificador.` },
          { status: 409 }
        )
      }
      throw versionError || new Error('Não foi possível criar a versão do workflow')
    }

    const stagesInsertPayload = stagePayloads.map((stage) => ({
      ...stage,
      workflow_version_id: newVersion.id,
    }))

    const { data: insertedStages, error: stagesError } = await supabase
      .from('lab_workflow_stages')
      .insert(stagesInsertPayload)
      .select('*')

    if (stagesError || !insertedStages) {
      throw stagesError || new Error('Não foi possível salvar as etapas do workflow')
    }

    const stageIdByKey = new Map<string, string>()
    for (const stage of insertedStages as any[]) {
      stageIdByKey.set(stage.stage_key, stage.id)
    }

    const edgesInsertPayload = canvasEdges
      .map((edge: any) => {
        const fromKey = nodeIdToStageKey.get(edge.source)
        const toKey = nodeIdToStageKey.get(edge.target)
        if (!fromKey || !toKey) {
          return null
        }
        const fromStageId = stageIdByKey.get(fromKey)
        const toStageId = stageIdByKey.get(toKey)
        if (!fromStageId || !toStageId) {
          return null
        }
        return {
          workflow_version_id: newVersion.id,
          from_stage_id: fromStageId,
          to_stage_id: toStageId,
          condition: edge?.data?.condition || edge?.data?.conditions || {},
        }
      })
      .filter(Boolean) as any[]

    if (edgesInsertPayload.length > 0) {
      const { error: edgesError } = await supabase.from('lab_workflow_edges').insert(edgesInsertPayload)
      if (edgesError) {
        throw edgesError
      }
    }

    const collaborationSettings = (supabaseSettings as any)?.global?.collaboration
    const teamsFromBlueprint = Array.isArray(collaborationSettings?.teams) ? collaborationSettings.teams : []

    if (teamsFromBlueprint.length > 0) {
      const teamInsertPayload = teamsFromBlueprint.map((team: any) => ({
        workflow_version_id: newVersion.id,
        team_key: team.teamKey,
        name: team.name,
        strategy: team.strategy || 'round_robin',
        description: team.description || null,
        metadata: team.metadata || {},
      }))

      const { data: insertedTeams, error: teamInsertError } = await supabase
        .from('lab_workflow_teams')
        .insert(teamInsertPayload)
        .select('id, team_key')

      if (teamInsertError) {
        throw teamInsertError
      }

      const membersInsertPayload: any[] = []
      const idByTeamKey = new Map<string, string>()

      ;(insertedTeams || []).forEach((teamRow: any) => {
        if (teamRow?.team_key && teamRow?.id) {
          idByTeamKey.set(teamRow.team_key, teamRow.id)
        }
      })

      teamsFromBlueprint.forEach((team: any) => {
        const teamId = idByTeamKey.get(team.teamKey)
        if (!teamId || !Array.isArray(team.members)) {
          return
        }

        team.members.forEach((member: any) => {
          const rawAgentId = typeof member?.agentId === 'string' ? member.agentId.trim() : ''
          const agentId = rawAgentId && isUuid(rawAgentId) ? rawAgentId : null
          membersInsertPayload.push({
            team_id: teamId,
            agent_id: agentId,
            role:
              member?.role && ['coordinator', 'executor', 'validator', 'observer'].includes(member.role)
                ? member.role
                : 'executor',
            weight: typeof member?.weight === 'number' ? member.weight : 1,
            responsibilities:
              typeof member?.responsibilities === 'string' && member.responsibilities.trim().length > 0
                ? member.responsibilities.trim()
                : null,
            metadata: member?.metadata && typeof member.metadata === 'object' ? member.metadata : {},
          })
        })
      })

      if (membersInsertPayload.length > 0) {
        const { error: memberInsertError } = await supabase.from('lab_workflow_team_members').insert(membersInsertPayload)
        if (memberInsertError) {
          throw memberInsertError
        }
      }
    }

    const updatedSettings = {
      ...(supabaseSettings || {}),
      workflowId,
      lastPublishedVersionLabel: newVersion.version_label,
      lastPublishedAt: new Date().toISOString(),
      stageCount: stagesInsertPayload.length,
      edgeCount: edgesInsertPayload.length,
    }

    const { error: updateBlueprintError } = await supabase
      .from('lab_workflow_blueprints')
      .update({
        published_workflow_version_id: newVersion.id,
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', blueprintRecord.id)

    if (updateBlueprintError) {
      throw updateBlueprintError
    }

    return NextResponse.json({
      success: true,
      workflow: workflowRecord,
      version: newVersion,
      stageCount: stagesInsertPayload.length,
      edgeCount: edgesInsertPayload.length,
    })
  } catch (error: any) {
    console.error('[Workflows][Blueprints][Publish] Erro ao publicar blueprint:', error)
    const message = error?.message || 'Erro ao publicar blueprint'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


