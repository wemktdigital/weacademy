// @ts-nocheck
import { runPipeline } from './pipelineRunner'
import type { CollaborativeTeamConfig, HumanStageConfig } from '../types/workflows'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceSupabase() {
  return createClient(supabaseUrl, serviceRoleKey)
}

async function fetchCollaborationTeam(
  workflowVersionId: string,
  teamKey: string
): Promise<CollaborativeTeamConfig | null> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('lab_workflow_teams')
    .select(
      `
        team_key,
        name,
        strategy,
        description,
        metadata,
        members:lab_workflow_team_members (
          agent_id,
          role,
          weight,
          responsibilities,
          metadata
        )
      `
    )
    .eq('workflow_version_id', workflowVersionId)
    .eq('team_key', teamKey)
    .maybeSingle()

  if (error) {
    console.error('[WorkflowStageRunner] Erro ao carregar time colaborativo:', error)
    return null
  }

  if (!data) return null

  const members = Array.isArray(data.members)
    ? data.members.map((member: any) => ({
      agentId: member.agent_id,
      role: member.role,
      weight: member.weight ?? 1,
      responsibilities: member.responsibilities || undefined,
      metadata: member.metadata || undefined,
    }))
    : []

  const team: CollaborativeTeamConfig = {
    teamKey: data.team_key,
    name: data.name || data.team_key,
    strategy: (data.strategy as CollaborativeTeamConfig['strategy']) || 'round_robin',
    description: data.description || null,
    metadata: data.metadata || undefined,
    members,
  }

  return team
}

export type WorkflowStageType = 'agent' | 'pipeline' | 'human' | 'delay' | 'webhook' | 'loop'

export interface WorkflowStageRecord {
  id: string
  workflow_version_id: string
  stage_key: string
  type: WorkflowStageType
  name?: string | null
  config?: Record<string, any> | null
  loop_config?: Record<string, any> | null
  entry_conditions?: any
  exit_actions?: any
  order_hint?: number | null
}

export interface WorkflowInstanceRecord {
  id: string
  workflow_version_id: string
  owner_user_id?: string | null
  status: string
  context?: Record<string, any> | null
  metadata?: Record<string, any> | null
  total_latency_ms?: number | null
  total_cost_usd?: number | null
  created_at: string
  started_at?: string | null
  finished_at?: string | null
}

export interface WorkflowStageRunRecord {
  id: string
  workflow_instance_id: string
  stage_id: string
  status: string
  attempt: number
  input_snapshot?: Record<string, any> | null
  output_snapshot?: Record<string, any> | null
  error_info?: Record<string, any> | null
  resume_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  latency_ms?: number | null
  cost_usd?: number | null
  input_tokens?: number | null
  output_tokens?: number | null
  human_status?: string | null
  assigned_user_id?: string | null
  assigned_role?: string | null
  assigned_at?: string | null
  due_at?: string | null
  sla_seconds?: number | null
  completed_by?: string | null
  completed_at?: string | null
  decision?: string | null
  decision_reason?: string | null
  escalation_level?: number | null
  escalated_at?: string | null
}

export interface ContextPatch {
  path: string
  value: any
  mode?: 'set' | 'append'
}

export interface StageExecutionResult {
  status: 'completed' | 'waiting_human' | 'scheduled' | 'failed'
  outputSnapshot?: Record<string, any>
  contextPatches?: ContextPatch[]
  resumeAt?: string
  errorMessage?: string
  humanTask?: {
    instructions?: string
    formSchema?: Record<string, any>
    assignment?: Record<string, any>
  }
}

export interface StageExecutionArgs {
  stage: WorkflowStageRecord
  instance: WorkflowInstanceRecord
  context: Record<string, any>
  stageRun: WorkflowStageRunRecord
  resumePayload?: any
}

function resolveContextValue(context: Record<string, any>, path?: string) {
  if (!path) return undefined
  if (path === '$root') return context
  const segments = path.split('.').filter(Boolean)
  let current: any = context
  for (const segment of segments) {
    if (current == null) return undefined
    current = current[segment]
  }
  return current
}

function createContextPatch(path: string | undefined, value: any): ContextPatch[] | undefined {
  if (!path) return undefined
  return [{ path, value, mode: 'set' }]
}

function ensureArray(input: any): any[] {
  if (Array.isArray(input)) return input
  if (input === undefined || input === null) return []
  return [input]
}

function mergeContexts(base: Record<string, any>, additional: Record<string, any>) {
  const clone = { ...(base || {}) }
  Object.entries(additional || {}).forEach(([key, value]) => {
    clone[key] = value
  })
  return clone
}

export async function executeWorkflowStage({
  stage,
  instance,
  context,
  stageRun,
  resumePayload,
}: StageExecutionArgs): Promise<StageExecutionResult> {
  const config = stage.config || {}

  switch (stage.type) {
    case 'loop': {
      const loopConfig = stage.loop_config || stage.config || {}
      const itemsPath = loopConfig.itemsPath as string | undefined
      const itemAlias = loopConfig.itemAlias || 'item'
      const maxParallel = Number(loopConfig.maxParallel) || 1
      const untilCondition = loopConfig.untilCondition
      const innerConfig = loopConfig.inner || {}
      const innerStageType = (innerConfig.stageType as WorkflowStageType) || 'pipeline'
      const innerStageRecord: WorkflowStageRecord = {
        id: `${stage.stage_key}_inner`,
        workflow_version_id: stage.workflow_version_id,
        stage_key: `${stage.stage_key}_inner`,
        type: innerStageType,
        name: innerConfig.name || `${stage.stage_key}_inner`,
        config: innerConfig.stageConfig || {},
        loop_config: innerConfig.loopConfig || null,
        entry_conditions: [],
        exit_actions: [],
        order_hint: 0,
      }
      const iterationContextPath = loopConfig.iterationContextPath as string | undefined
      const outputPath = loopConfig.outputPath as string | undefined
      const accumulateContextPath = loopConfig.accumulateContextPath as string | undefined

      if (!itemsPath) {
        return {
          status: 'failed',
          errorMessage: `Configuração inválida de loop para stage ${stage.stage_key}`,
        }
      }

      const items = resolveContextValue(context, itemsPath)
      if (!Array.isArray(items) || items.length === 0) {
        return {
          status: 'completed',
          outputSnapshot: {
            iterations: [],
            executed: 0,
            loopBreak: false,
          },
        }
      }

      if (innerStageRecord.type === 'pipeline') {
        const pipelineId = innerStageRecord.config?.pipelineId
        if (!pipelineId) {
          return {
            status: 'failed',
            errorMessage: `Loop ${stage.stage_key} requer pipelineId na etapa interna.`,
          }
        }
      }

      const iterationContextBase = iterationContextPath
        ? (resolveContextValue(context, iterationContextPath) ?? {})
        : {}

      const batches =
        maxParallel > 1
          ? Array.from({ length: Math.ceil(items.length / maxParallel) }, (_, idx) =>
            items.slice(idx * maxParallel, idx * maxParallel + maxParallel)
          )
          : items.map((item) => [item])

      const results: Array<{
        item: any
        index: number
        status: string
        output: any
        latency?: number
        cost?: number
      }> = []

      let breakLoop = false
      let iterationIndex = 0

      for (const batch of batches) {
        if (breakLoop) break
        await Promise.all(
          batch.map(async (item) => {
            const currentIndex = iterationIndex++
            const mergedIterationContext = mergeContexts(iterationContextBase, {
              [itemAlias]: item,
              index: currentIndex,
            })
            const patchedContext = applyContextPatches(context, [
              { path: `$loop.${stage.stage_key}.item`, value: item },
              { path: `$loop.${stage.stage_key}.index`, value: currentIndex },
              { path: `$loop.${stage.stage_key}.context`, value: mergedIterationContext },
            ])

            const stageRunClone = {
              ...stageRun,
              input_snapshot: {
                ...(stageRun.input_snapshot || {}),
                loopItem: item,
                loopIndex: currentIndex,
              },
            }

            const executionResult = await executeWorkflowStage({
              stage: innerStageRecord,
              instance,
              context: patchedContext,
              stageRun: stageRunClone,
            })

            results.push({
              item,
              index: currentIndex,
              status: executionResult.status,
              output: executionResult.outputSnapshot,
              latency: executionResult.outputSnapshot?.totalLatency,
              cost: executionResult.outputSnapshot?.totalCost,
            })

            if (untilCondition && executionResult.outputSnapshot) {
              const { path, equals } = untilCondition as { path?: string; equals?: any }
              if (path) {
                const value = resolveContextValue(executionResult.outputSnapshot, path)
                if (equals !== undefined ? value === equals : Boolean(value)) {
                  breakLoop = true
                }
              }
            }
          })
        )
      }

      const totalLatency = results.reduce((acc, iteration) => acc + (iteration.latency || 0), 0)
      const totalCost = results.reduce((acc, iteration) => acc + (iteration.cost || 0), 0)

      const outputSnapshot = {
        iterations: results,
        executed: results.length,
        loopBreak: breakLoop,
        totalLatency,
        totalCost,
      }

      const patches: ContextPatch[] = []
      if (outputPath) {
        patches.push({ path: outputPath, value: results })
      }
      if (accumulateContextPath) {
        patches.push({
          path: accumulateContextPath,
          value: results.map((iteration) => iteration.output),
        })
      }

      return {
        status: 'completed',
        outputSnapshot,
        contextPatches: patches.length > 0 ? patches : undefined,
      }
    }
    case 'pipeline': {
      const pipelineId = config.pipelineId as string | undefined
      if (!pipelineId) {
        return {
          status: 'failed',
          errorMessage: `Configuração inválida: pipelineId ausente para stage ${stage.stage_key}`,
        }
      }

      const inputPath = config.inputPath as string | undefined
      const outputPath = config.outputPath as string | undefined
      const allowDraft = Boolean(config.allowDraft)

      let inputMessages = resolveContextValue(context, inputPath)
      if (!inputMessages || !Array.isArray(inputMessages)) {
        // Se não houver mensagens, tentar criar a partir de um texto simples
        const fallback = resolveContextValue(context, config.fallbackTextPath || 'messages.0.content')
        if (typeof fallback === 'string' && fallback.trim().length > 0) {
          inputMessages = [{ role: 'user', content: fallback }]
        } else {
          inputMessages = []
        }
      }

      const ownerUserId = instance.owner_user_id || config.userId || 'system'
      const teamKey = typeof config.teamKey === 'string' && config.teamKey.trim() ? config.teamKey.trim() : undefined
      const collaborationTeam = teamKey
        ? await fetchCollaborationTeam(stage.workflow_version_id, teamKey)
        : null
      if (teamKey && !collaborationTeam) {
        console.warn(
          `[WorkflowStageRunner] Time colaborativo "${teamKey}" não encontrado para workflow_version ${stage.workflow_version_id}.`
        )
      }
      const collaborationOptions = collaborationTeam ? { collaboration: { team: collaborationTeam } } : undefined

      try {
        const result = await runPipeline(
          pipelineId,
          ensureArray(inputMessages),
          ownerUserId,
          undefined,
          allowDraft,
          collaborationOptions
        )

        const collaborationSummaries = result.results
          .filter((stepResult) => stepResult.metadata && stepResult.metadata.teamKey)
          .map((stepResult) => stepResult.metadata)

        const stepResults = result.results.map((stepResult) => ({
          agentId: stepResult.agent_id,
          latency: stepResult.latency,
          cost: stepResult.cost,
          metadata: stepResult.metadata ?? null,
        }))

        const contextPatch = outputPath
          ? createContextPatch(outputPath, {
            results: result.results,
            totalLatency: result.totalLatency,
            totalCost: result.totalCost,
          })
          : undefined

        return {
          status: 'completed',
          outputSnapshot: {
            pipelineId,
            totalLatency: result.totalLatency,
            totalCost: result.totalCost,
            stepCount: result.results.length,
            supervisor: config.supervisor || null,
            stepResults,
            collaborations: collaborationSummaries,
          },
          contextPatches: contextPatch,
        }
      } catch (error: any) {
        const errorMessage = error?.message || String(error || 'Erro desconhecido')

        if (typeof errorMessage === 'string' && errorMessage.startsWith('SUPERVISOR_ESCALATION::')) {
          const escalationReasonRaw = errorMessage.replace('SUPERVISOR_ESCALATION::', '').trim()
          const escalationReason = escalationReasonRaw || 'Supervisor solicitou escalonamento para análise humana.'
          const supervisorId = config.supervisor?.supervisorAgentId ?? 'supervisor'
          const assignmentUsers = instance.owner_user_id ? [instance.owner_user_id] : []

          return {
            status: 'waiting_human',
            outputSnapshot: {
              pipelineId,
              supervisorEscalation: true,
              supervisor: config.supervisor || null,
              reason: escalationReason,
            },
            humanTask: {
              instructions: `Supervisor ${supervisorId} escalou a etapa ${stage.stage_key} para revisão humana. Motivo: ${escalationReason}`,
              formSchema: null,
              assignment: {
                mode: assignmentUsers.length > 0 ? 'user' : 'role',
                users: assignmentUsers,
                roles: assignmentUsers.length === 0 ? ['supervisor'] : [],
                groups: [],
                dynamicPath: '',
                allowSelfAssign: true,
              },
              sla: null,
              externalActions: null,
              allowAttachments: true,
              metadata: {
                supervisorEscalation: true,
                supervisorAgentId: supervisorId,
                reason: escalationReason,
              },
            },
          }
        }

        return {
          status: 'failed',
          errorMessage,
        }
      }
    }

    case 'human': {
      const humanConfig: HumanStageConfig = {
        instructions: config.instructions,
        formSchema: config.formSchema,
        assignment: config.assignment,
        approval: config.approval,
        sla: config.sla,
        externalActions: config.externalActions,
        allowAttachments: config.allowAttachments,
        metadata: config.metadata,
      }

      if (!resumePayload) {
        return {
          status: 'waiting_human',
          outputSnapshot: {
            instructions: humanConfig.instructions || 'Ação humana necessária',
            formSchema: humanConfig.formSchema || null,
            assignment: humanConfig.assignment || null,
            approval: humanConfig.approval || null,
            sla: humanConfig.sla || null,
            externalActions: humanConfig.externalActions || null,
            allowAttachments: humanConfig.allowAttachments ?? false,
          },
          humanTask: {
            instructions: humanConfig.instructions,
            formSchema: humanConfig.formSchema,
            assignment: humanConfig.assignment,
            approval: humanConfig.approval,
            sla: humanConfig.sla,
            externalActions: humanConfig.externalActions,
            allowAttachments: humanConfig.allowAttachments,
            metadata: humanConfig.metadata,
          },
        }
      }

      const outputPath = config.outputPath || `workflows.${stage.stage_key}.submission`
      const patch = createContextPatch(outputPath, resumePayload)

      return {
        status: 'completed',
        outputSnapshot: {
          submission: resumePayload,
        },
        contextPatches: patch,
      }
    }

    case 'delay': {
      const delayMs = Number(config.delayMs) || 60000
      const resumeAt = new Date(Date.now() + delayMs).toISOString()

      return {
        status: 'scheduled',
        resumeAt,
        outputSnapshot: {
          delayMs,
          resumeAt,
        },
      }
    }

    case 'webhook': {
      // Para v1: apenas registrar intenção. Execução real pode ser implementada posteriormente.
      return {
        status: 'waiting_human',
        outputSnapshot: {
          instructions: 'Aguardando resposta do webhook externo',
          endpoint: config.endpoint,
        },
        humanTask: {
          instructions: 'Aguardando ação externa (webhook). Use o endpoint configurado para continuar.',
        },
      }
    }

    case 'agent':
    default:
      return {
        status: 'failed',
        errorMessage: `Tipo de stage não suportado ainda: ${stage.type}`,
      }
  }
}

