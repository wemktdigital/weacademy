import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServer: vi.fn(),
}))

let listRoute: typeof import('@/app/api/lab-ia/workflows/instances/route')
let detailRoute: typeof import('@/app/api/lab-ia/workflows/instances/<instanceId>/route')

async function loadRoutes() {
  listRoute = await import('@/app/api/lab-ia/workflows/instances/route')
  detailRoute = await import('@/app/api/lab-ia/workflows/instances/<instanceId>/route')
}

import { supabaseServer } from '@/lib/supabaseServer'
import { mockSupabaseAuth } from '@/tests/utils/mockSupabaseAuth'

const defaultUser = { id: 'user-42' }

function createSupabaseMock(overrides: Record<string, any> = {}) {
  return {
    ...overrides,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: defaultUser }, error: null }),
      ...(overrides.auth || {}),
    },
  }
}

beforeEach(async () => {
  vi.resetModules()
  await loadRoutes()
  vi.mocked(supabaseServer).mockReset()
})

afterEach(() => {
  vi.resetModules()
})

describe('GET /api/lab-ia/workflows/instances', () => {
  it('retorna 401 quando usuário não autenticado', async () => {
    mockSupabaseAuth(vi.mocked(supabaseServer), null)
    const response = await listRoute.GET(new NextRequest('http://localhost/api/instances'))
    expect(response.status).toBe(401)
  })

  it('retorna instâncias do usuário', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === 'lab_workflow_blueprints') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          then: (onFulfilled: any) => Promise.resolve({ data: [{ published_workflow_version_id: 'wv-1' }], error: null }).then(onFulfilled),
          catch: (onRejected: any) => Promise.resolve({ data: [], error: null }).catch(onRejected),
        }
      }
      if (table === 'lab_workflow_instances') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (onFulfilled: any) => Promise.resolve({ data: [{ id: 'instance-1' }], error: null }).then(onFulfilled),
          catch: (onRejected: any) => Promise.resolve({ data: [], error: null }).catch(onRejected),
        }
      }
      return {}
    })

    vi.mocked(supabaseServer).mockReturnValue(createSupabaseMock({ from: fromMock }))

    const response = await listRoute.GET(new NextRequest('http://localhost/api/instances'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.instances).toHaveLength(1)
  })
})

describe('GET /api/lab-ia/workflows/instances/<instanceId>', () => {
  it('retorna 400 se instanceId ausente', async () => {
    mockSupabaseAuth(vi.mocked(supabaseServer), defaultUser)
    const response = await detailRoute.GET(new NextRequest('http://localhost/api/instances'), { params: { instanceId: '' } })
    expect(response.status).toBe(400)
  })

  it('retorna 403 se instância de outro usuário', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === 'lab_workflow_instances') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'inst-1', owner_user_id: 'other-user', workflow_version_id: 'wv-1' },
            error: null,
          }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    vi.mocked(supabaseServer).mockReturnValue(createSupabaseMock({ from: fromMock }))

    const response = await detailRoute.GET(new NextRequest('http://localhost/api/instances/inst-1'), {
      params: { instanceId: 'inst-1' },
    })

    expect(response.status).toBe(403)
  })

  it('retorna instância e dados relacionados', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === 'lab_workflow_instances') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'inst-1', owner_user_id: defaultUser.id, workflow_version_id: 'wv-1' },
            error: null,
          }),
        }
      }
      if (table === 'lab_workflow_stages') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (onFulfilled: any) => Promise.resolve({ data: [{ id: 'stage-1' }], error: null }).then(onFulfilled),
          catch: (onRejected: any) => Promise.resolve({ data: [], error: null }).catch(onRejected),
        }
      }
      if (table === 'lab_workflow_stage_runs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (onFulfilled: any) => Promise.resolve({ data: [{ id: 'stage-run-1' }], error: null }).then(onFulfilled),
          catch: (onRejected: any) => Promise.resolve({ data: [], error: null }).catch(onRejected),
        }
      }
      if (table === 'lab_workflow_events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: (onFulfilled: any) => Promise.resolve({ data: [{ id: 'event-1' }], error: null }).then(onFulfilled),
          catch: (onRejected: any) => Promise.resolve({ data: [], error: null }).catch(onRejected),
        }
      }
      return {}
    })

    vi.mocked(supabaseServer).mockReturnValue(createSupabaseMock({ from: fromMock }))

    const response = await detailRoute.GET(new NextRequest('http://localhost/api/instances/inst-1'), {
      params: { instanceId: 'inst-1' },
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.instance.id).toBe('inst-1')
    expect(body.stages).toHaveLength(1)
    expect(body.stageRuns).toHaveLength(1)
    expect(body.events).toHaveLength(1)
  })
})
