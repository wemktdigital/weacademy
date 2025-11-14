import { createClient } from '@supabase/supabase-js'
import type { HumanTaskFilters } from '../types/workflows'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function getServiceClient() {
  return createClient(supabaseUrl, serviceRoleKey)
}

export interface HumanTaskRecord {
  id: string
  workflow_instance_id: string
  stage_id: string
  stage_run_id: string
  status: string
  assignment: Record<string, any> | null
  assignee_user_id?: string | null
  assignee_role?: string | null
  assigned_at?: string | null
  started_at?: string | null
  due_at?: string | null
  completed_at?: string | null
  completed_by?: string | null
  decision?: string | null
  decision_reason?: string | null
  sla_seconds?: number | null
  reminder_strategy?: Record<string, any> | null
  escalation_config?: Record<string, any> | null
  metadata?: Record<string, any> | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface HumanTaskLogRecord {
  id: string
  human_task_id: string
  action: string
  actor_user_id?: string | null
  payload?: Record<string, any> | null
  created_at: string
}

export async function createHumanTask(payload: {
  workflow_instance_id: string
  stage_id: string
  stage_run_id: string
  assignment?: Record<string, any> | null
  sla_seconds?: number | null
  reminder_strategy?: Record<string, any> | null
  escalation_config?: Record<string, any> | null
  created_by?: string | null
  metadata?: Record<string, any> | null
}) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('lab_workflow_human_tasks')
    .insert({
      ...payload,
      status: 'pending',
      assignment: payload.assignment ?? {},
      metadata: payload.metadata ?? {},
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Erro ao criar tarefa humana: ${error.message}`)
  }

  return data as HumanTaskRecord
}

export async function updateHumanTask(
  taskId: string,
  updates: Partial<HumanTaskRecord>
) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('lab_workflow_human_tasks')
    .update(updates)
    .eq('id', taskId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar tarefa humana: ${error.message}`)
  }

  return data as HumanTaskRecord
}

export async function logHumanTaskAction(
  taskId: string,
  action: string,
  actorUserId?: string,
  payload?: Record<string, any>
) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('lab_workflow_human_task_logs')
    .insert({
      human_task_id: taskId,
      action,
      actor_user_id: actorUserId ?? null,
      payload: payload ?? {},
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Erro ao registrar log da tarefa: ${error.message}`)
  }

  return data as HumanTaskLogRecord
}

export async function listHumanTasks(filters: HumanTaskFilters) {
  const supabase = getServiceClient()

  let query = supabase
    .from('lab_workflow_human_tasks')
    .select('*')
    .order('due_at', { ascending: true, nullsFirst: false })

  if (filters.status && !filters.includeCompleted) {
    query = query.eq('status', filters.status)
  } else if (!filters.includeCompleted) {
    query = query.in('status', ['pending', 'in_progress', 'escalated'])
  }

  if (filters.workflowInstanceId) {
    query = query.eq('workflow_instance_id', filters.workflowInstanceId)
  }

  if (filters.workflowVersionId) {
    // Need to join via view; fallback to parallel query
    query = query.contains('metadata', { workflow_version_id: filters.workflowVersionId })
  }

  if (filters.stageId) {
    query = query.eq('stage_id', filters.stageId)
  }

  if (filters.assigneeUserId) {
    query = query.eq('assignee_user_id', filters.assigneeUserId)
  }

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Erro ao listar tarefas humanas: ${error.message}`)
  }

  return (data || []) as HumanTaskRecord[]
}

export async function getHumanTaskByStageRun(stageRunId: string) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('lab_workflow_human_tasks')
    .select('*')
    .eq('stage_run_id', stageRunId)
    .single()

  if (error) {
    if (
      error.code === 'PGRST116' ||
      error.details?.includes('Results contain 0 rows') ||
      error.message?.toLowerCase().includes('no rows') ||
      error.message?.toLowerCase().includes('not found')
    ) {
      return null
    }
    throw new Error(`Erro ao carregar tarefa humana: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return data as HumanTaskRecord
}

export async function getHumanTask(taskId: string) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('lab_workflow_human_tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (error) {
    throw new Error(`Erro ao buscar tarefa humana: ${error.message}`)
  }

  return data as HumanTaskRecord
}


