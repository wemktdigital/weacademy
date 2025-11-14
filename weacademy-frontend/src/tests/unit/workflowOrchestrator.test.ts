import { describe, it, expect, vi, beforeEach } from 'vitest'

let currentClient: any

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => currentClient),
}))

vi.mock('@/modules/laboratorio-ia/services/workflowStageRunner', () => ({
  executeWorkflowStage: vi.fn(),
}))

vi.mock('@/modules/laboratorio-ia/services/humanTaskService', () => ({
  createHumanTask: vi.fn(),
  getHumanTaskByStageRun: vi.fn(),
  updateHumanTask: vi.fn(),
  logHumanTaskAction: vi.fn(),
}))

import { processWorkflowInstance } from '@/modules/laboratorio-ia/services/workflowOrchestrator'
import { executeWorkflowStage } from '@/modules/laboratorio-ia/services/workflowStageRunner'
import {
  createHumanTask,
  getHumanTaskByStageRun,
  updateHumanTask,
  logHumanTaskAction,
} from '@/modules/laboratorio-ia/services/humanTaskService'

interface SupabaseState {
  instances: Array<Record<string, any>>
  stages: Array<Record<string, any>>
  stageRuns: Array<Record<string, any>>
  events: Array<Record<string, any>>
  logs: {
    instanceUpdates: Array<{ updates: Record<string, any>; field: string; value: any }>
    stageRunUpdates: Array<{ updates: Record<string, any>; id: string }>
  }
}

function createSupabaseStub(initial: {
  instances: Array<Record<string, any>>
  stages: Array<Record<string, any>>
  stageRuns?: Array<Record<string, any>>
}): { client: any; state: SupabaseState } {
  const state: SupabaseState = {
    instances: initial.instances.map((inst) => ({ ...inst })),
    stages: initial.stages.map((stage) => ({ ...stage })),
    stageRuns: (initial.stageRuns || []).map((run) => ({ ...run })),
    events: [],
    logs: {
      instanceUpdates: [],
      stageRunUpdates: [],
    },
  }

  let stageRunCounter = state.stageRuns.length + 1

  const client = {
    from(table: string) {
      switch (table) {
        case 'lab_workflow_instances':
          return {
            select() {
              return {
                eq(field: string, value: any) {
                  return {
                    async single() {
                      const record = state.instances.find((item) => item[field] === value) || null
                      return { data: record, error: record ? null : { message: 'not found' } }
                    },
                  }
                },
              }
            },
            update(updates: Record<string, any>) {
              return {
                async eq(field: string, value: any) {
                  const record = state.instances.find((item) => item[field] === value)
                  if (!record) {
                    return { data: null, error: { message: 'not found' } }
                  }
                  Object.assign(record, updates)
                  state.logs.instanceUpdates.push({ updates, field, value })
                  return { data: [record], error: null }
                },
              }
            },
          }
        case 'lab_workflow_stages':
          return {
            select() {
              return {
                async eq(field: string, value: any) {
                  const data = state.stages.filter((item) => item[field] === value)
                  return { data, error: null }
                },
              }
            },
          }
        case 'lab_workflow_stage_runs':
          return {
            select() {
              return {
                async eq(field: string, value: any) {
                  const data = state.stageRuns.filter((item) => item[field] === value)
                  return { data, error: null }
                },
              }
            },
            insert(payload: Record<string, any>) {
              const newRun = {
                id: payload.id || `stage-run-${stageRunCounter++}`,
                ...payload,
              }
              state.stageRuns.push(newRun)
              return {
                select() {
                  return {
                    async single() {
                      return { data: newRun, error: null }
                    },
                  }
                },
              }
            },
            update(updates: Record<string, any>) {
              return {
                async eq(field: string, value: any) {
                  const run = state.stageRuns.find((item) => item[field] === value)
                  if (!run) {
                    return { data: null, error: { message: 'not found' } }
                  }
                  Object.assign(run, updates)
                  state.logs.stageRunUpdates.push({ id: run.id, updates })
                  return { data: [run], error: null }
                },
              }
            },
          }
        case 'lab_workflow_events':
          return {
            async insert(payload: Record<string, any>) {
              state.events.push(payload)
              return { data: payload, error: null }
            },
          }
        default:
          return {
            select() {
              return {
                async eq() {
                  return { data: [], error: null }
                },
              }
            },
            async insert(payload: any) {
              return { data: payload, error: null }
            },
            update() {
              return {
                async eq() {
                  return { data: [], error: null }
                },
              }
            },
          }
      }
    },
  }

  return { client, state }
}

describe('processWorkflowInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('executa etapa pipeline com sucesso e finaliza instância', async () => {
    const supabase = createSupabaseStub({
      instances: [
        {
          id: 'instance-1',
          workflow_version_id: 'workflow-1',
          status: 'running',
          context: {},
          owner_user_id: 'owner-1',
          total_latency_ms: 0,
          total_cost_usd: 0,
        },
      ],
      stages: [
        {
          id: 'stage-1',
          workflow_version_id: 'workflow-1',
          stage_key: 'diagnostico',
          type: 'pipeline',
          order_hint: 1,
          config: {},
        },
      ],
    })

    currentClient = supabase.client

    vi.mocked(executeWorkflowStage).mockResolvedValueOnce({
      status: 'completed',
      outputSnapshot: {
        totalLatency: 850,
        totalCost: 0.45,
      },
      contextPatches: [
        { path: 'diagnosis.result', value: 'positivo' },
      ],
    })

    await processWorkflowInstance('instance-1')

    expect(executeWorkflowStage).toHaveBeenCalledTimes(1)
    expect(supabase.state.stageRuns).toHaveLength(1)
    expect(supabase.state.stageRuns[0].status).toBe('completed')
    expect(supabase.state.instances[0].status).toBe('completed')
    expect(supabase.state.instances[0].context).toEqual({ diagnosis: { result: 'positivo' } })
    expect(supabase.state.instances[0].total_cost_usd).toBeCloseTo(0.45)
    expect(supabase.state.events.map((event) => event.event_type)).toEqual([
      'stage.completed',
      'workflow.completed',
    ])
  })

  it('processa etapa humana em espera e cria tarefa', async () => {
    const supabase = createSupabaseStub({
      instances: [
        {
          id: 'instance-2',
          workflow_version_id: 'workflow-2',
          status: 'running',
          context: {},
          owner_user_id: 'owner-2',
          total_latency_ms: 0,
          total_cost_usd: 0,
        },
      ],
      stages: [
        {
          id: 'stage-human',
          workflow_version_id: 'workflow-2',
          stage_key: 'aprovacao_medica',
          type: 'human',
          order_hint: 1,
          config: {},
        },
      ],
    })

    currentClient = supabase.client

    vi.mocked(getHumanTaskByStageRun).mockResolvedValueOnce(null)
    vi.mocked(createHumanTask).mockResolvedValueOnce({
      id: 'task-1',
      workflow_instance_id: 'instance-2',
      stage_id: 'stage-human',
      stage_run_id: 'stage-run-human',
    } as any)
    vi.mocked(updateHumanTask).mockResolvedValue({} as any)
    vi.mocked(logHumanTaskAction).mockResolvedValue({} as any)

    vi.mocked(executeWorkflowStage).mockResolvedValueOnce({
      status: 'waiting_human',
      outputSnapshot: {
        supervisorEscalation: true,
      },
      humanTask: {
        instructions: 'Revisar sinais vitais do paciente',
        assignment: { mode: 'user', users: ['medico-plantonista'] },
        sla: { durationMinutes: 60 },
        metadata: { priority: 'alta' },
      },
    })

    await processWorkflowInstance('instance-2')

    expect(executeWorkflowStage).toHaveBeenCalledTimes(1)
    expect(getHumanTaskByStageRun).toHaveBeenCalledTimes(1)
    expect(createHumanTask).toHaveBeenCalledTimes(1)
    expect(updateHumanTask).toHaveBeenCalledTimes(1)
    expect(logHumanTaskAction).toHaveBeenCalledTimes(1)

    expect(supabase.state.stageRuns).toHaveLength(1)
    expect(supabase.state.stageRuns[0].status).toBe('waiting_human')
    expect(supabase.state.stageRuns[0].human_status).toBe('pending')
    expect(supabase.state.stageRuns[0].assigned_user_id).toBe('medico-plantonista')
    expect(supabase.state.instances[0].status).toBe('waiting_human')
    expect(supabase.state.events[0].event_type).toBe('stage.waiting_human')
  })
})
