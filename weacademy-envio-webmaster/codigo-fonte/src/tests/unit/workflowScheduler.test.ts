import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let supabaseClient: any

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => supabaseClient),
}))

vi.mock('@/modules/laboratorio-ia/services/workflowOrchestrator', () => ({
  createWorkflowInstance: vi.fn(),
  processWorkflowInstance: vi.fn(),
}))

import { runCalendarTriggers } from '@/modules/laboratorio-ia/services/workflowScheduler'
import { createWorkflowInstance, processWorkflowInstance } from '@/modules/laboratorio-ia/services/workflowOrchestrator'

interface CalendarMockState {
  triggers: Array<Record<string, any>>
  versions: Record<string, any>
  updates: Array<{ triggerId: string; last_trigger_at: string }>
}

function makeBuilder(resolver: () => Promise<{ data: any; error: any }>) {
  const promise = resolver()
  const builder: any = {
    eq: () => builder,
    single: () => builder,
    then(onFulfilled: any, onRejected?: any) {
      return promise.then(onFulfilled, onRejected)
    },
    catch(onRejected: any) {
      return promise.catch(onRejected)
    },
  }
  return builder
}

function createSupabaseCalendarMock(state: CalendarMockState) {
  return {
    from(table: string) {
      switch (table) {
        case 'lab_workflow_triggers':
          return {
            select: () =>
              makeBuilder(async () => ({ data: state.triggers, error: null })),
            update: (updates: Record<string, any>) => ({
              eq: (field: string, value: any) =>
                makeBuilder(async () => {
                  const trigger = state.triggers.find((item) => item[field] === value)
                  if (trigger) {
                    const lastTriggerAt = updates.last_trigger_at as string
                    trigger.last_trigger_at = lastTriggerAt
                    state.updates.push({ triggerId: trigger.id, last_trigger_at: lastTriggerAt })
                    return { data: [trigger], error: null }
                  }
                  return { data: [], error: { message: 'not found' } }
                }),
            }),
          }
        case 'lab_workflow_versions':
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    makeBuilder(async () => {
                      const version = state.versions.active
                      return { data: version || null, error: version ? null : { message: 'not found' } }
                    }),
                }),
              }),
            }),
          }
        default:
          return {
            select: () => makeBuilder(async () => ({ data: [], error: null })),
            update: () => ({ eq: () => makeBuilder(async () => ({ data: [], error: null })) }),
            insert: async (payload: any) => ({ data: payload, error: null }),
          }
      }
    },
  }
}

describe('runCalendarTriggers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    supabaseClient = undefined
  })

  it('agenda execução respeitando timezone e cron', async () => {
    const date = new Date('2025-11-09T12:00:00.000Z')
    const cronExpression = `${date.getMinutes()} ${date.getHours()} * * *`

    const state: CalendarMockState = {
      triggers: [
        {
          id: 'trigger-1',
          workflow_version_id: 'wv-1',
          type: 'calendar',
          config: {
            cron: cronExpression,
            payload: {
              owner_user_id: 'owner-123',
              context: { patientId: 'p-1' },
              metadata: { source: 'cron-test' },
            },
          },
          is_active: true,
          last_trigger_at: null,
        },
      ],
      versions: {
        active: {
          id: 'wv-1',
          workflow_id: 'workflow-1',
          settings: {
            owner_user_id: 'owner-override',
          },
        },
      },
      updates: [],
    }

    supabaseClient = createSupabaseCalendarMock(state)

    vi.mocked(createWorkflowInstance).mockResolvedValueOnce({ id: 'instance-1' } as any)
    vi.mocked(processWorkflowInstance).mockResolvedValueOnce(undefined)

    const results = await runCalendarTriggers(date)

    expect(createWorkflowInstance).toHaveBeenCalledWith({
      workflowVersionId: 'wv-1',
      ownerUserId: 'owner-override',
      context: { patientId: 'p-1' },
      metadata: {
        trigger_id: 'trigger-1',
        trigger_type: 'calendar',
        source: 'cron-test',
      },
    })
    expect(processWorkflowInstance).toHaveBeenCalledWith('instance-1')
    expect(results).toEqual([{ triggerId: 'trigger-1', instanceId: 'instance-1' }])
    expect(state.updates).toHaveLength(1)
    expect(state.updates[0].triggerId).toBe('trigger-1')
  })

  it('propaga erro de leitura do Supabase', async () => {
    const error = { message: 'db indisponível' }
    supabaseClient = {
      from() {
        return {
          select: () =>
            makeBuilder(async () => ({ data: null, error })),
          update: () => ({ eq: () => makeBuilder(async () => ({ data: [], error: null })) }),
        }
      },
    }

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(runCalendarTriggers(new Date())).rejects.toBe(error)

    expect(consoleSpy).toHaveBeenCalledWith('[WorkflowScheduler] Erro ao buscar triggers de calendário:', error)
    expect(createWorkflowInstance).not.toHaveBeenCalled()
    expect(processWorkflowInstance).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
