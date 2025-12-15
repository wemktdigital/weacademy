import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServer: vi.fn(),
}))

vi.mock('@/modules/laboratorio-ia/services/humanTaskService', () => ({
  listHumanTasks: vi.fn(),
}))

import { mockSupabaseAuth } from '@/tests/utils/mockSupabaseAuth'

let GET: typeof import('@/app/api/lab-ia/workflows/human-tasks/route').GET

async function loadRoute() {
  const mod = await import('@/app/api/lab-ia/workflows/human-tasks/route')
  GET = mod.GET
}

import { supabaseServer } from '@/lib/supabaseServer'
import { listHumanTasks } from '@/modules/laboratorio-ia/services/humanTaskService'

const defaultUser = { id: 'user-1' }

function mockAuth(user: any | null) {
  return mockSupabaseAuth(vi.mocked(supabaseServer), user)
}

beforeEach(async () => {
  vi.resetModules()
  await loadRoute()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.resetModules()
})

describe('GET /api/lab-ia/workflows/human-tasks', () => {
  it('retorna 401 quando usuário não está autenticado', async () => {
    mockAuth(null)

    const response = await GET(new NextRequest('http://localhost/api/human-tasks'))

    expect(response.status).toBe(401)
    expect(listHumanTasks).not.toHaveBeenCalled()
  })

  it('retorna lista com filtros aplicados', async () => {
    mockAuth(defaultUser)
    vi.mocked(listHumanTasks).mockResolvedValue([
      { id: 'ht-1', status: 'pending' },
      { id: 'ht-2', status: 'completed' },
    ])

    const response = await GET(
      new NextRequest('http://localhost/api/human-tasks?status=pending&workflowInstanceId=wi-1&limit=10')
    )

    expect(response.status).toBe(200)
    expect(listHumanTasks).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', workflowInstanceId: undefined, limit: 10 })
    )
    const body = await response.json()
    expect(body.tasks).toHaveLength(2)
  })
})
