import { describe, it, expect, vi, afterEach } from 'vitest'

let mockClient: any

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

import * as humanTaskService from '@/modules/laboratorio-ia/services/humanTaskService'

function createChain({
  onInsert,
  onUpdate,
  onSelect,
}: {
  onInsert?: (payload: any) => Promise<{ data: any; error: any }> | { data: any; error: any }
  onUpdate?: (payload: any) => Promise<{ data: any; error: any }> | { data: any; error: any }
  onSelect?: () => Promise<{ data: any; error: any }> | { data: any; error: any }
}) {
  const toAsync = <T>(value: Promise<T> | T): Promise<T> =>
    value instanceof Promise ? value : Promise.resolve(value)

  const singleFactory = (resolver?: () => Promise<{ data: any; error: any }> | { data: any; error: any }) =>
    vi.fn(async () => (resolver ? await toAsync(resolver()) : { data: null, error: null }))

  const selectAfterInsert = (resolver: () => Promise<{ data: any; error: any }> | { data: any; error: any }) => {
    const single = singleFactory(resolver)
    return {
      select: vi.fn(() => ({ single })),
    }
  }

  const table: any = {
    insert: vi.fn((payload) => selectAfterInsert(() => (onInsert ? onInsert(payload) : { data: null, error: null }))),
    update: vi.fn((payload) => ({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: singleFactory(() => (onUpdate ? onUpdate(payload) : { data: null, error: null })) }),
      }),
    })),
    select: vi.fn(() => {
      const single = singleFactory(onSelect)
      const builder: any = { single }
      builder.eq = vi.fn().mockReturnValue(builder)
      builder.order = vi.fn().mockReturnValue(builder)
      builder.contains = vi.fn().mockReturnValue(builder)
      builder.in = vi.fn().mockReturnValue(builder)
      builder.limit = vi.fn().mockReturnValue(builder)
      return builder
    }),
    eq: vi.fn().mockReturnThis(),
  }

  return table
}

describe('humanTaskService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createHumanTask injeta defaults e retorna registro', async () => {
    let capturedPayload: any
    const expectedRecord = {
      id: 'task-1',
      workflow_instance_id: 'instance-1',
      stage_id: 'stage-1',
      stage_run_id: 'stage-run-1',
      status: 'pending',
      assignment: { mode: 'user', users: ['owner'] },
      metadata: { critical: true },
    }

    const table = createChain({
      onInsert: (payload) => {
        capturedPayload = payload
        return { data: expectedRecord, error: null }
      },
    })

    mockClient = { from: vi.fn(() => table) }

    const result = await humanTaskService.createHumanTask({
      workflow_instance_id: 'instance-1',
      stage_id: 'stage-1',
      stage_run_id: 'stage-run-1',
      assignment: { mode: 'user', users: ['owner'] },
      metadata: { critical: true },
    })

    expect(mockClient.from).toHaveBeenCalledWith('lab_workflow_human_tasks')
    expect(table.insert).toHaveBeenCalledTimes(1)
    expect(capturedPayload).toMatchObject({
      status: 'pending',
      assignment: { mode: 'user', users: ['owner'] },
      metadata: { critical: true },
    })
    expect(result).toEqual(expectedRecord)
  })

  it('getHumanTaskByStageRun retorna null quando supabase indica ausência de linhas', async () => {
    const table = createChain({
      onSelect: () => ({
        data: null,
        error: {
          code: 'PGRST116',
          message: 'Results contain 0 rows',
        },
      }),
    })

    mockClient = { from: vi.fn(() => table) }

    const result = await humanTaskService.getHumanTaskByStageRun('stage-run-404')

    expect(mockClient.from).toHaveBeenCalledWith('lab_workflow_human_tasks')
    expect(table.select).toHaveBeenCalledWith('*')
    expect(result).toBeNull()
  })
})
