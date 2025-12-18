// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import {
  executeWorkflowStage,
  type WorkflowStageRecord,
  type WorkflowInstanceRecord,
  type WorkflowStageRunRecord,
  type StageExecutionResult,
} from './workflowStageRunner'

export type {
  WorkflowStageRecord,
  WorkflowInstanceRecord,
  WorkflowStageRunRecord,
  StageExecutionResult
}
import {
  createHumanTask,
  getHumanTaskByStageRun,
  updateHumanTask,
  logHumanTaskAction,
} from './humanTaskService'

interface CreateWorkflowInstanceOptions {
  workflowVersionId: string
  ownerUserId: string
  context?: Record<string, any>
  metadata?: Record<string, any>
}

interface ResumeStageOptions {
  stageRunId: string
  submission: any
  userId: string
}

interface ProcessOptions {
  resumeData?: Record<string, any>
  maxIterations?: number
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, serviceRoleKey)
}

function cloneContext<T>(value: T): T {
  if (typeof (global as any).structuredClone === 'function') {
    return (global as any).structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value ?? {}))
}

function applyContextPatches(base: Record<string, any>, patches?: { path: string; value: any; mode?: 'set' | 'append' }[]) {
  if (!patches || patches.length === 0) return base
  const result = cloneContext(base || {})

  for (const patch of patches) {
    const segments = patch.path.split('.').filter(Boolean)
    if (segments.length === 0) continue

    let current: any = result
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const isLast = i === segments.length - 1

      if (isLast) {
        if (patch.mode === 'append' && Array.isArray(current[segment])) {
          current[segment] = [...current[segment], patch.value]
        } else {
          current[segment] = patch.value
        }
      } else {
        if (!current[segment] || typeof current[segment] !== 'object') {
          current[segment] = {}
        }
        current = current[segment]
      }
    }
  }

  return result
}

function sortStages(stages: WorkflowStageRecord[]) {
  return [...stages].sort((a, b) => {
    const orderA = a.order_hint ?? 0
    const orderB = b.order_hint ?? 0
    if (orderA === orderB) {
      return a.stage_key.localeCompare(b.stage_key)
    }
    return orderA - orderB
  })
}

function calculateStageMetrics({
  stage,
  result,
  startedAt,
  finishedAt,
}: {
  stage: WorkflowStageRecord
  result: StageExecutionResult
  startedAt?: string
  finishedAt?: string
}) {
  let latencyMs: number | null = null
  if (startedAt && finishedAt) {
    const start = Date.parse(startedAt)
    const end = Date.parse(finishedAt)
    if (Number.isFinite(start) && Number.isFinite(end)) {
      latencyMs = Math.max(end - start, 0)
    }
  }

  const snapshot = result.outputSnapshot as Record<string, any> | undefined
  const costCandidate =
    snapshot?.totalCost ??
    snapshot?.total_cost ??
    snapshot?.total_cost_usd ??
    snapshot?.cost ??
    snapshot?.costUsd ??
    snapshot?.cost_usd ??
    0

  const costUsd = Number.isFinite(Number(costCandidate)) ? Number(costCandidate) : 0

  return {
    latencyMs,
    costUsd,
  }
}

interface HumanStageTransitionResult {
  stageRunPatch?: Record<string, any>
  instancePatch?: Record<string, any>
}

async function handleHumanStageTransition({
  transition,
  stage,
  instance,
  stageRun,
  executionResult,
  resumePayload,
}: {
  transition: StageExecutionResult['status']
  stage: WorkflowStageRecord
  instance: WorkflowInstanceRecord
  stageRun: WorkflowStageRunRecord
  executionResult: StageExecutionResult
  resumePayload?: any
}): Promise<HumanStageTransitionResult | null> {
  const humanConfig = executionResult.humanTask
  const result: HumanStageTransitionResult = {}
  const nowIso = new Date().toISOString()

  if (transition === 'waiting_human') {
    const assignment = humanConfig?.assignment || {}
    const { assigneeUserId, assigneeRole } = extractPrimaryHumanAssignee(assignment)
    const slaSeconds = humanConfig?.sla?.durationMinutes
      ? Math.ceil(Number(humanConfig.sla.durationMinutes) * 60)
      : null
    const dueAtIso = computeDueAtFromSla(humanConfig?.sla)
    const assignedAtIso = assigneeUserId || assigneeRole ? nowIso : null

    const stageRunPatch: Record<string, any> = {
      human_status: 'pending',
      assigned_user_id: assigneeUserId ?? null,
      assigned_role: assigneeRole ?? null,
      assigned_at: assignedAtIso,
      due_at: dueAtIso,
      sla_seconds: slaSeconds,
      completed_by: null,
      completed_at: null,
      decision: null,
      decision_reason: null,
      escalation_level: 0,
      escalated_at: null,
    }

    const metadata = {
      workflow_version_id: instance.workflow_version_id,
      workflow_instance_id: instance.id,
      stage_key: stage.stage_key,
    }

    const reminderStrategy =
      humanConfig?.sla && (humanConfig.sla.reminderEveryMinutes || humanConfig.sla.maxReminders)
        ? {
          reminderEveryMinutes: humanConfig.sla.reminderEveryMinutes ?? null,
          maxReminders: humanConfig.sla.maxReminders ?? null,
        }
        : undefined

    const escalationConfig =
      Array.isArray(humanConfig?.sla?.escalationChain) && humanConfig!.sla!.escalationChain!.length > 0
        ? { escalationChain: humanConfig!.sla!.escalationChain }
        : undefined

    try {
      const existingTask = await getHumanTaskByStageRun(stageRun.id)
      const baseUpdate: Record<string, any> = {
        status: 'pending',
        assignment,
        assignee_user_id: assigneeUserId ?? null,
        assignee_role: assigneeRole ?? null,
        assigned_at: assignedAtIso ?? null,
        due_at: dueAtIso ?? null,
        sla_seconds: slaSeconds ?? null,
        metadata,
      }
      if (reminderStrategy) {
        baseUpdate.reminder_strategy = reminderStrategy
      }
      if (escalationConfig) {
        baseUpdate.escalation_config = escalationConfig
      }

      if (existingTask) {
        await updateHumanTask(existingTask.id, baseUpdate)
        await logHumanTaskAction(existingTask.id, 'reopened', instance.owner_user_id ?? undefined, {
          assignment,
          sla_seconds: slaSeconds ?? null,
        })
      } else {
        const createPayload: Record<string, any> = {
          workflow_instance_id: instance.id,
          stage_id: stage.id,
          stage_run_id: stageRun.id,
          assignment,
          sla_seconds: slaSeconds ?? null,
          metadata,
          created_by: instance.owner_user_id ?? null,
        }
        if (reminderStrategy) {
          createPayload.reminder_strategy = reminderStrategy
        }
        if (escalationConfig) {
          createPayload.escalation_config = escalationConfig
        }

        const newTask = await createHumanTask(createPayload)

        await updateHumanTask(newTask.id, {
          assignee_user_id: assigneeUserId ?? null,
          assignee_role: assigneeRole ?? null,
          assigned_at: assignedAtIso ?? null,
          due_at: dueAtIso ?? null,
        })

        await logHumanTaskAction(newTask.id, 'created', instance.owner_user_id ?? undefined, {
          assignment,
          sla_seconds: slaSeconds ?? null,
        })
      }
    } catch (error) {
      console.error('[Workflow] Erro ao preparar tarefa humana:', {
        stageRunId: stageRun.id,
        error,
      })
    }

    result.stageRunPatch = stageRunPatch
    return result
  }

  if (transition === 'completed' || transition === 'failed') {
    const completion = deriveHumanDecision(resumePayload, stageRun, transition)
    const stageRunPatch: Record<string, any> = {
      human_status: completion.humanStatus,
      completed_by: completion.actorUserId ?? null,
      completed_at: nowIso,
      decision: completion.decision,
      decision_reason: completion.reason ?? null,
    }

    try {
      const existingTask = await getHumanTaskByStageRun(stageRun.id)
      if (existingTask) {
        const taskStatus =
          completion.humanStatus === 'approved'
            ? 'approved'
            : completion.humanStatus === 'rejected'
              ? 'rejected'
              : completion.humanStatus === 'cancelled'
                ? 'cancelled'
                : 'completed'

        await updateHumanTask(existingTask.id, {
          status: taskStatus,
          completed_at: nowIso,
          completed_by: completion.actorUserId ?? null,
          decision: completion.decision,
          decision_reason: completion.reason ?? null,
        })

        await logHumanTaskAction(existingTask.id, taskStatus, completion.actorUserId ?? undefined, {
          decision: completion.decision,
          reason: completion.reason,
        })
      }
    } catch (error) {
      console.error('[Workflow] Erro ao finalizar tarefa humana:', {
        stageRunId: stageRun.id,
        error,
      })
    }

    result.stageRunPatch = stageRunPatch
    return result
  }

  return result
}

function extractPrimaryHumanAssignee(assignment?: Record<string, any> | null) {
  if (!assignment || typeof assignment !== 'object') {
    return { assigneeUserId: null, assigneeRole: null }
  }

  const mode = typeof assignment.mode === 'string' ? assignment.mode.toLowerCase() : ''

  if (mode === 'user' && Array.isArray(assignment.users) && assignment.users.length > 0) {
    return { assigneeUserId: assignment.users[0], assigneeRole: null }
  }

  if (mode === 'role' && Array.isArray(assignment.roles) && assignment.roles.length > 0) {
    return { assigneeUserId: null, assigneeRole: assignment.roles[0] }
  }

  return { assigneeUserId: null, assigneeRole: null }
}

function computeDueAtFromSla(sla?: { durationMinutes?: number | null }) {
  if (!sla || typeof sla.durationMinutes !== 'number' || sla.durationMinutes <= 0) {
    return null
  }
  const dueDate = new Date(Date.now() + sla.durationMinutes * 60 * 1000)
  return dueDate.toISOString()
}

function deriveHumanDecision(
  resumePayload: any,
  stageRun: WorkflowStageRunRecord,
  transition: StageExecutionResult['status']
) {
  const source = resumePayload || stageRun.input_snapshot?.submission || {}
  const rawDecision = typeof source.decision === 'string'
    ? source.decision
    : typeof source.status === 'string'
      ? source.status
      : typeof source.result === 'string'
        ? source.result
        : undefined

  const normalizedDecision = (rawDecision || '').toLowerCase()
  let humanStatus: 'approved' | 'rejected' | 'cancelled' | 'failed' = 'approved'

  if (normalizedDecision.includes('reject')) {
    humanStatus = 'rejected'
  } else if (normalizedDecision.includes('cancel')) {
    humanStatus = 'cancelled'
  } else if (transition === 'failed') {
    humanStatus = 'rejected'
  } else {
    humanStatus = 'approved'
  }

  const decision =
    humanStatus === 'approved'
      ? 'approved'
      : humanStatus === 'rejected'
        ? 'rejected'
        : humanStatus === 'cancelled'
          ? 'cancelled'
          : 'failed'

  const reason =
    source.decisionReason ??
    source.reason ??
    source.comment ??
    source.feedback ??
    stageRun.input_snapshot?.submission?.decisionReason ??
    null

  const actorUserId =
    source.userId ??
    source.submitted_by ??
    source.submittedBy ??
    stageRun.input_snapshot?.submitted_by ??
    null

  return { humanStatus, decision, reason, actorUserId }
}

export async function createWorkflowInstance({
  workflowVersionId,
  ownerUserId,
  context = {},
  metadata = {},
}: CreateWorkflowInstanceOptions) {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('lab_workflow_instances')
    .insert({
      workflow_version_id: workflowVersionId,
      owner_user_id: ownerUserId,
      context,
      metadata,
      status: 'running',
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Erro ao criar WorkflowInstance: ${error.message}`)
  }

  await supabase.from('lab_workflow_events').insert({
    workflow_instance_id: data.id,
    event_type: 'workflow.started',
    payload: { workflow_version_id: workflowVersionId },
    created_by: ownerUserId,
  })

  return data
}

export async function processWorkflowInstance(instanceId: string, options: ProcessOptions = {}) {
  const supabase = getServiceClient()
  const maxIterations = options.maxIterations ?? 20

  // Carregar instância
  const { data: instanceRecord, error: instanceError } = await supabase
    .from('lab_workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .single()

  if (instanceError || !instanceRecord) {
    throw new Error(instanceError?.message || 'WorkflowInstance não encontrado')
  }

  let instance: WorkflowInstanceRecord = instanceRecord as WorkflowInstanceRecord
  let context = cloneContext(instance.context || {})

  const { data: stagesData } = await supabase
    .from('lab_workflow_stages')
    .select('*')
    .eq('workflow_version_id', instance.workflow_version_id)

  const stages = sortStages((stagesData || []) as WorkflowStageRecord[])

  const { data: stageRunsData } = await supabase
    .from('lab_workflow_stage_runs')
    .select('*')
    .eq('workflow_instance_id', instance.id)

  const stageRuns = (stageRunsData || []) as WorkflowStageRunRecord[]

  let iterations = 0
  let shouldContinue = true

  while (shouldContinue && iterations < maxIterations) {
    iterations++

    const nextStageInfo = await findNextStageToExecute({ stages, stageRuns, instance })

    if (!nextStageInfo) {
      // Determinar status final
      await finalizeInstanceStatus({ supabase, instance, stageRuns })
      return
    }

    const { stage, stageRun, dependenciesCompleted, ready } = nextStageInfo

    if (!dependenciesCompleted) {
      // Ainda aguardando etapas anteriores
      await finalizeInstanceStatus({ supabase, instance, stageRuns })
      return
    }

    if (!ready) {
      // Etapa aguardando (human/delay)
      await updateInstanceStatusForWaiting({ supabase, instance, stageRuns, stageRun })
      return
    }

    // Garantir stageRun existente
    let currentStageRun = stageRun
    if (!currentStageRun) {
      const { data: newRun, error: newRunError } = await supabase
        .from('lab_workflow_stage_runs')
        .insert({
          workflow_instance_id: instance.id,
          stage_id: stage.id,
          status: 'pending',
          attempt: 1,
          input_snapshot: {},
        })
        .select('*')
        .single()

      if (newRunError || !newRun) {
        throw new Error(newRunError?.message || 'Erro ao criar stage run')
      }
      currentStageRun = newRun as WorkflowStageRunRecord
      stageRuns.push(currentStageRun)
    }

    // Preparar execução
    const attempt = currentStageRun.attempt + (currentStageRun.status === 'pending' ? 0 : 1)
    const startTime = new Date().toISOString()

    const inputSnapshot = {
      context,
      resumePayload: options.resumeData?.[currentStageRun.id] ?? null,
    }

    await supabase
      .from('lab_workflow_stage_runs')
      .update({
        status: 'running',
        started_at: startTime,
        attempt,
        error_info: null,
        resume_at: null,
        input_snapshot: inputSnapshot,
      })
      .eq('id', currentStageRun.id)

    currentStageRun.status = 'running'
    currentStageRun.started_at = startTime
    currentStageRun.attempt = attempt
    currentStageRun.error_info = null
    currentStageRun.resume_at = null
    currentStageRun.input_snapshot = inputSnapshot

    // Executar etapa
    const resumePayload = options.resumeData?.[currentStageRun.id]
    const executionResult = await executeWorkflowStage({
      stage,
      instance,
      context,
      stageRun: currentStageRun,
      resumePayload,
    })

    const updates: Record<string, any> = {
      status: executionResult.status,
      output_snapshot: executionResult.outputSnapshot || {},
    }

    let humanTransition: HumanStageTransitionResult | null = null
    if (stage.type === 'human') {
      try {
        humanTransition = await handleHumanStageTransition({
          transition: executionResult.status,
          stage,
          instance,
          stageRun: currentStageRun,
          executionResult,
          resumePayload,
        })
        if (humanTransition?.stageRunPatch) {
          Object.assign(updates, humanTransition.stageRunPatch)
        }
      } catch (error) {
        console.error('[Workflow] Erro no processamento da etapa humana', {
          stageRunId: currentStageRun.id,
          error,
        })
      }
    }

    const isTerminalStatus = executionResult.status === 'completed' || executionResult.status === 'failed'
    let finishedAtIso: string | undefined

    if (isTerminalStatus) {
      finishedAtIso = new Date().toISOString()
      updates.finished_at = finishedAtIso
    } else if (executionResult.status === 'scheduled') {
      updates.resume_at = executionResult.resumeAt || new Date(Date.now() + 60000).toISOString()
    }

    if (executionResult.status === 'failed') {
      updates.error_info = {
        message: executionResult.errorMessage || 'Erro desconhecido',
      }
    }

    const previousLatency = currentStageRun.latency_ms || 0
    const previousCost = currentStageRun.cost_usd || 0
    let deltaLatency = 0
    let deltaCost = 0

    if (isTerminalStatus) {
      const metrics = calculateStageMetrics({
        stage,
        result: executionResult,
        startedAt: startTime,
        finishedAt: finishedAtIso,
      })

      if (metrics.latencyMs != null) {
        updates.latency_ms = metrics.latencyMs
        deltaLatency = metrics.latencyMs - previousLatency
      }

      updates.cost_usd = metrics.costUsd
      deltaCost = metrics.costUsd - previousCost
    }

    await supabase
      .from('lab_workflow_stage_runs')
      .update(updates)
      .eq('id', currentStageRun.id)

    currentStageRun.status = updates.status
    currentStageRun.output_snapshot = updates.output_snapshot
    currentStageRun.finished_at = updates.finished_at
    currentStageRun.resume_at = updates.resume_at
    currentStageRun.error_info = updates.error_info
    if (typeof updates.latency_ms === 'number') {
      currentStageRun.latency_ms = updates.latency_ms
    }
    if (typeof updates.cost_usd === 'number') {
      currentStageRun.cost_usd = updates.cost_usd
    }

    if (humanTransition?.stageRunPatch) {
      Object.assign(currentStageRun, humanTransition.stageRunPatch)
    }

    const instanceUpdates: Record<string, any> = {}

    if (humanTransition?.instancePatch) {
      Object.assign(instanceUpdates, humanTransition.instancePatch)
    }

    if (deltaLatency !== 0) {
      const newTotalLatency = Number(instance.total_latency_ms || 0) + deltaLatency
      instanceUpdates.total_latency_ms = newTotalLatency
      instance.total_latency_ms = newTotalLatency
    } else if (
      isTerminalStatus &&
      instance.total_latency_ms == null &&
      typeof updates.latency_ms === 'number'
    ) {
      instanceUpdates.total_latency_ms = updates.latency_ms
      instance.total_latency_ms = updates.latency_ms
    }

    if (deltaCost !== 0) {
      const newTotalCost = Number(instance.total_cost_usd || 0) + deltaCost
      instanceUpdates.total_cost_usd = newTotalCost
      instance.total_cost_usd = newTotalCost
    } else if (isTerminalStatus && instance.total_cost_usd == null && typeof updates.cost_usd === 'number') {
      instanceUpdates.total_cost_usd = updates.cost_usd
      instance.total_cost_usd = updates.cost_usd
    }

    // Atualizar contexto
    if (executionResult.contextPatches && executionResult.contextPatches.length > 0) {
      context = applyContextPatches(context, executionResult.contextPatches)
      instanceUpdates.context = context
      instanceUpdates.last_stage_id = stage.id
      instance.context = context
      instance.last_stage_id = stage.id
    } else if (isTerminalStatus) {
      instanceUpdates.last_stage_id = stage.id
      instance.last_stage_id = stage.id
    }

    // Registrar evento
    await supabase.from('lab_workflow_events').insert({
      workflow_instance_id: instance.id,
      event_type: `stage.${executionResult.status}`,
      payload: {
        stage_id: stage.id,
        stage_key: stage.stage_key,
        output: executionResult.outputSnapshot,
        error: executionResult.errorMessage,
        supervisor: executionResult.outputSnapshot?.supervisor ?? null,
      },
    })

    if (executionResult.status === 'failed') {
      instanceUpdates.status = 'failed'
      instance.status = 'failed'
      shouldContinue = false
    } else if (executionResult.status === 'waiting_human') {
      instanceUpdates.status = 'waiting_human'
      if (!instanceUpdates.last_stage_id) {
        instanceUpdates.last_stage_id = stage.id
        instance.last_stage_id = stage.id
      }
      instance.status = 'waiting_human'
      shouldContinue = false
    } else if (executionResult.status === 'scheduled') {
      instanceUpdates.status = 'scheduled'
      if (!instanceUpdates.last_stage_id) {
        instanceUpdates.last_stage_id = stage.id
        instance.last_stage_id = stage.id
      }
      instance.status = 'scheduled'
      shouldContinue = false
    }

    if (Object.keys(instanceUpdates).length > 0) {
      await supabase
        .from('lab_workflow_instances')
        .update(instanceUpdates)
        .eq('id', instance.id)
    }
  }

  if (iterations >= maxIterations) {
    console.warn('[Workflow] Limite de iterações atingido, interrompendo processamento.', {
      instanceId,
      iterations,
    })
  }
}

export async function resumeWorkflowStage({ stageRunId, submission, userId }: ResumeStageOptions) {
  const supabase = getServiceClient()

  const { data: stageRun, error } = await supabase
    .from('lab_workflow_stage_runs')
    .select('*')
    .eq('id', stageRunId)
    .single()

  if (error || !stageRun) {
    throw new Error(error?.message || 'Stage run não encontrado')
  }

  await supabase
    .from('lab_workflow_stage_runs')
    .update({
      status: 'pending',
      resume_at: null,
      input_snapshot: {
        ...(stageRun.input_snapshot || {}),
        submission,
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
      },
    })
    .eq('id', stageRunId)

  await supabase.from('lab_workflow_events').insert({
    workflow_instance_id: stageRun.workflow_instance_id,
    event_type: 'stage.resumed',
    payload: {
      stage_run_id: stageRunId,
      submitted_by: userId,
    },
    created_by: userId,
  })

  await supabase
    .from('lab_workflow_instances')
    .update({ status: 'running' })
    .eq('id', stageRun.workflow_instance_id)

  await processWorkflowInstance(stageRun.workflow_instance_id, {
    resumeData: {
      [stageRunId]: submission,
    },
  })
}

async function findNextStageToExecute({
  stages,
  stageRuns,
  instance,
}: {
  stages: WorkflowStageRecord[]
  stageRuns: WorkflowStageRunRecord[]
  instance: WorkflowInstanceRecord
}) {
  const orderedStages = sortStages(stages)

  for (const stage of orderedStages) {
    const run = stageRuns.find((sr) => sr.stage_id === stage.id)

    if (run?.status === 'completed') {
      continue
    }

    if (run?.status === 'waiting_human' || run?.status === 'scheduled') {
      const resumeDue = !run.resume_at || new Date(run.resume_at).getTime() <= Date.now()
      return {
        stage,
        stageRun: run,
        dependenciesCompleted: dependenciesSatisfied(stage, stageRuns, orderedStages),
        ready: resumeDue,
      }
    }

    const dependenciesCompleted = dependenciesSatisfied(stage, stageRuns, orderedStages)
    if (!dependenciesCompleted) {
      continue
    }

    return {
      stage,
      stageRun: run,
      dependenciesCompleted,
      ready: true,
    }
  }

  return null
}

function dependenciesSatisfied(
  stage: WorkflowStageRecord,
  stageRuns: WorkflowStageRunRecord[],
  orderedStages: WorkflowStageRecord[]
) {
  const currentIndex = orderedStages.findIndex((s) => s.id === stage.id)
  if (currentIndex <= 0) return true

  const previousStages = orderedStages.slice(0, currentIndex)
  return previousStages.every((prevStage) => {
    const run = stageRuns.find((sr) => sr.stage_id === prevStage.id)
    return run && run.status === 'completed'
  })
}

async function finalizeInstanceStatus({
  supabase,
  instance,
  stageRuns,
}: {
  supabase: ReturnType<typeof getServiceClient>
  instance: WorkflowInstanceRecord
  stageRuns: WorkflowStageRunRecord[]
}) {
  const pendingOrRunning = stageRuns.some((sr) => ['pending', 'running', 'scheduled'].includes(sr.status))
  const waitingHuman = stageRuns.some((sr) => sr.status === 'waiting_human')
  const failed = stageRuns.some((sr) => sr.status === 'failed')

  let nextStatus = instance.status

  if (failed) {
    nextStatus = 'failed'
  } else if (waitingHuman) {
    nextStatus = 'waiting_human'
  } else if (pendingOrRunning) {
    nextStatus = 'running'
  } else {
    nextStatus = 'completed'
  }

  const updates: Record<string, any> = { status: nextStatus }
  if (nextStatus === 'completed') {
    updates.completed_at = new Date().toISOString()
    await supabase.from('lab_workflow_events').insert({
      workflow_instance_id: instance.id,
      event_type: 'workflow.completed',
      payload: {},
    })
  }

  await supabase
    .from('lab_workflow_instances')
    .update(updates)
    .eq('id', instance.id)
}

async function updateInstanceStatusForWaiting({
  supabase,
  instance,
  stageRuns,
  stageRun,
}: {
  supabase: ReturnType<typeof getServiceClient>
  instance: WorkflowInstanceRecord
  stageRuns: WorkflowStageRunRecord[]
  stageRun?: WorkflowStageRunRecord
}) {
  if (!stageRun) return

  if (stageRun.status === 'waiting_human') {
    await supabase
      .from('lab_workflow_instances')
      .update({ status: 'waiting_human' })
      .eq('id', instance.id)
  } else if (stageRun.status === 'scheduled') {
    await supabase
      .from('lab_workflow_instances')
      .update({ status: 'scheduled' })
      .eq('id', instance.id)
  }
}

