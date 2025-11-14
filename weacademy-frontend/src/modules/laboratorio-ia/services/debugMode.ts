/**
 * Serviço de Debug Mode para Pipelines
 */

import { createClient } from '@supabase/supabase-js'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface DebugSession {
  id: string
  pipeline_id: string
  user_id: string
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error'
  current_step_order: number
  input_messages: any[]
  context_state: Record<string, any>
  variable_context: Record<string, any>
  executed_steps: Array<{
    order: number
    agent_id: string
    input?: any
    output?: string
    context_before?: Record<string, any>
    context_after?: Record<string, any>
    latency?: number
    cost?: number
  }>
  breakpoints: Array<{
    step_order: number
    enabled: boolean
    condition?: string
  }>
  created_at: string
  updated_at: string
  completed_at?: string
  final_output?: string
  total_latency_ms?: number
  total_cost_usd?: number
}

export interface DebugSnapshot {
  id: string
  debug_session_id: string
  step_order: number
  context_state: Record<string, any>
  variable_context: Record<string, any>
  executed_steps: any[]
  created_at: string
  notes?: string
}

/**
 * Cria uma nova sessão de debug
 */
export async function createDebugSession(
  pipelineId: string,
  userId: string,
  inputMessages: any[],
  breakpoints: Array<{ step_order: number; enabled: boolean; condition?: string }> = []
): Promise<DebugSession> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_debug_sessions')
    .insert({
      pipeline_id: pipelineId,
      user_id: userId,
      status: 'running',
      current_step_order: 0,
      input_messages: inputMessages,
      context_state: {},
      variable_context: {},
      executed_steps: [],
      breakpoints,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar sessão de debug: ${error.message}`)
  }

  return data as DebugSession
}

/**
 * Busca uma sessão de debug
 */
export async function getDebugSession(sessionId: string): Promise<DebugSession | null> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_debug_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Sessão não encontrada
    }
    throw new Error(`Erro ao buscar sessão de debug: ${error.message}`)
  }

  return data as DebugSession
}

/**
 * Atualiza o estado de uma sessão de debug
 */
export async function updateDebugSession(
  sessionId: string,
  updates: Partial<{
    status: 'running' | 'paused' | 'stopped' | 'completed' | 'error'
    current_step_order: number
    context_state: Record<string, any>
    variable_context: Record<string, any>
    executed_steps: any[]
    final_output: string
    total_latency_ms: number
    total_cost_usd: number
  }>
): Promise<DebugSession> {
  const updateData: any = { ...updates }
  
  if (updates.status === 'completed' || updates.status === 'stopped') {
    updateData.completed_at = new Date().toISOString()
  }

  const { data, error } = await serviceSupabase
    .from('lab_pipeline_debug_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar sessão de debug: ${error.message}`)
  }

  return data as DebugSession
}

/**
 * Adiciona um step executado à sessão
 */
export async function addExecutedStep(
  sessionId: string,
  step: {
    order: number
    agent_id: string
    input?: any
    output?: string
    context_before?: Record<string, any>
    context_after?: Record<string, any>
    latency?: number
    cost?: number
  }
): Promise<void> {
  const session = await getDebugSession(sessionId)
  if (!session) {
    throw new Error('Sessão de debug não encontrada')
  }

  const executedSteps = [...(session.executed_steps || []), step]

  await updateDebugSession(sessionId, {
    executed_steps: executedSteps,
    current_step_order: step.order,
  })
}

/**
 * Pausa a execução em um step específico
 */
export async function pauseAtStep(
  sessionId: string,
  stepOrder: number,
  contextBefore: Record<string, any>,
  contextAfter: Record<string, any>
): Promise<DebugSession> {
  return updateDebugSession(sessionId, {
    status: 'paused',
    current_step_order: stepOrder,
    context_state: contextAfter,
  })
}

/**
 * Continua a execução após pausa
 */
export async function continueExecution(sessionId: string): Promise<DebugSession> {
  return updateDebugSession(sessionId, {
    status: 'running',
  })
}

/**
 * Para a execução
 */
export async function stopExecution(sessionId: string): Promise<DebugSession> {
  return updateDebugSession(sessionId, {
    status: 'stopped',
  })
}

/**
 * Verifica se há um breakpoint no step atual
 */
export function shouldPauseAtStep(
  session: DebugSession,
  stepOrder: number,
  context?: Record<string, any>
): boolean {
  if (session.status !== 'running') {
    return false
  }

  const breakpoint = session.breakpoints?.find(
    bp => bp.step_order === stepOrder && bp.enabled
  )

  if (!breakpoint) {
    return false
  }

  // Se há condição, avaliar
  if (breakpoint.condition && context) {
    try {
      // Avaliar condição simples (ex: "variable_name === 'value'")
      // Por enquanto, apenas verificar se a condição é uma string simples
      // Em produção, usar um parser mais robusto
      return true // Sempre pausar se há breakpoint habilitado
    } catch (e) {
      console.warn('Erro ao avaliar condição do breakpoint:', e)
      return true // Pausar por segurança
    }
  }

  return true
}

/**
 * Cria um snapshot do estado atual
 */
export async function createSnapshot(
  sessionId: string,
  stepOrder: number,
  notes?: string
): Promise<DebugSnapshot> {
  const session = await getDebugSession(sessionId)
  if (!session) {
    throw new Error('Sessão de debug não encontrada')
  }

  const { data, error } = await serviceSupabase
    .from('lab_pipeline_debug_snapshots')
    .insert({
      debug_session_id: sessionId,
      step_order: stepOrder,
      context_state: session.context_state,
      variable_context: session.variable_context,
      executed_steps: session.executed_steps,
      notes,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar snapshot: ${error.message}`)
  }

  return data as DebugSnapshot
}

/**
 * Busca snapshots de uma sessão
 */
export async function getSnapshots(sessionId: string): Promise<DebugSnapshot[]> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_debug_snapshots')
    .select('*')
    .eq('debug_session_id', sessionId)
    .order('step_order', { ascending: true })

  if (error) {
    throw new Error(`Erro ao buscar snapshots: ${error.message}`)
  }

  return (data || []) as DebugSnapshot[]
}

/**
 * Restaura um snapshot (não implementa rollback, apenas retorna dados)
 */
export async function getSnapshot(snapshotId: string): Promise<DebugSnapshot | null> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_debug_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar snapshot: ${error.message}`)
  }

  return data as DebugSnapshot
}

/**
 * Exporta o estado atual como JSON
 */
export async function exportSessionState(sessionId: string): Promise<string> {
  const session = await getDebugSession(sessionId)
  if (!session) {
    throw new Error('Sessão de debug não encontrada')
  }

  const snapshots = await getSnapshots(sessionId)

  const exportData = {
    session: {
      id: session.id,
      pipeline_id: session.pipeline_id,
      status: session.status,
      current_step_order: session.current_step_order,
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
    context: session.context_state,
    variables: session.variable_context,
    executed_steps: session.executed_steps,
    snapshots: snapshots.map(s => ({
      step_order: s.step_order,
      context_state: s.context_state,
      variable_context: s.variable_context,
      created_at: s.created_at,
      notes: s.notes,
    })),
  }

  return JSON.stringify(exportData, null, 2)
}

