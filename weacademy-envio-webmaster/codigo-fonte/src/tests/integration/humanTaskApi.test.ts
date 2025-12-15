import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServer: vi.fn(),
}))

vi.mock('@/modules/laboratorio-ia/services/humanTaskService', () => ({
  getHumanTask: vi.fn(),
  updateHumanTask: vi.fn(),
  logHumanTaskAction: vi.fn(),
  getServiceClient: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

import { GET, PATCH } from '@/app/api/lab-ia/workflows/human-tasks/[id]/route'
import { supabaseServer } from '@/lib/supabaseServer'
import {
  getHumanTask,
  updateHumanTask,
  logHumanTaskAction,
  getServiceClient,
} from '@/modules/laboratorio-ia/services/humanTaskService'
import { mockSupabaseAuth } from '@/tests/utils/mockSupabaseAuth'

const defaultUser = { id: 'user-123', email: 'user@example.com' }

function mockAuth(user: any | null) {
  return mockSupabaseAuth(vi.mocked(supabaseServer), user)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.resetModules()
})

describe('GET /api/lab-ia/workflows/human-tasks/[id]', () => {
  it('retorna 401 quando usuário não está autenticado', async () => {
    mockAuth(null)

    const response = await GET(new NextRequest('http://localhost/api/task'), { params: { id: 'ht-1' } })

    expect(response.status).toBe(401)
  })

  it('retorna tarefa e logs quando usuário autenticado', async () => {
    mockAuth(defaultUser)

    vi.mocked(getHumanTask).mockResolvedValue({ id: 'ht-1', status: 'pending' })

    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        expect(table).toBe('lab_workflow_human_task_logs')
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (onFulfilled: any) => Promise.resolve({ data: [{ id: 'log-1' }], error: null }).then(onFulfilled),
          catch: (onRejected: any) => Promise.resolve({ data: [{ id: 'log-1' }], error: null }).catch(onRejected),
        }
      }),
    } as any)

    const response = await GET(new NextRequest('http://localhost/api/task?id=ht-1'), {
      params: { id: 'ht-1' },
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.task).toMatchObject({ id: 'ht-1' })
    expect(body.logs).toHaveLength(1)
  })
})

describe('PATCH /api/lab-ia/workflows/human-tasks/[id]', () => {
  it('retorna 401 quando usuário não está autenticado', async () => {
    mockAuth(null)

    const response = await PATCH(new NextRequest('http://localhost/api/task', { method: 'PATCH' }), {
      params: { id: 'ht-1' },
    })

    expect(response.status).toBe(401)
  })

  it('retorna 400 quando payload inválido', async () => {
    mockAuth(defaultUser)

    const request = {
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: 123 }),
    } as unknown as NextRequest

    const response = await PATCH(request, { params: { id: 'ht-1' } })

    expect(response.status).toBe(400)
  })

  it('atualiza tarefa e registra log quando payload válido', async () => {
    mockAuth(defaultUser)

    const updatedTask = { id: 'ht-1', status: 'completed' }
    vi.mocked(updateHumanTask).mockResolvedValue(updatedTask)
    vi.mocked(logHumanTaskAction).mockResolvedValue({} as any)

    const request = {
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: 'completed', decision: 'approved' }),
    } as unknown as NextRequest

    const response = await PATCH(request, { params: { id: 'ht-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.task).toEqual(updatedTask)
    expect(updateHumanTask).toHaveBeenCalledWith('ht-1', expect.objectContaining({ status: 'completed' }))
    expect(logHumanTaskAction).toHaveBeenCalledWith('ht-1', 'manual_update', defaultUser.id, expect.any(Object))
  })
})
