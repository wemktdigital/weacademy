import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServer: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

import { GET, POST } from '@/app/api/lab-ia/admin/workflows/triggers/route'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

const defaultUser = { id: 'user-1', email: 'user@example.com' }

function buildSelectBuilder(result: { data: any; error: any }, eqSpy?: (field: string, value: any) => void) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation((field: string, value: any) => {
      eqSpy?.(field, value)
      return builder
    }),
    then: (onFulfilled: any, onRejected?: any) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: any) => Promise.resolve(result).catch(onRejected),
  }
  return builder
}

function mockSupabaseAuth(user: any | null) {
  const getUserMock = vi.fn().mockImplementation(async () => ({
    data: { user },
    error: user ? null : null,
  }))

  vi.mocked(supabaseServer).mockResolvedValue({
    auth: {
      getUser: getUserMock,
    },
  } as any)

  return getUserMock
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
  vi.clearAllMocks()
})

afterEach(() => {
  vi.resetModules()
})

describe('GET /api/lab-ia/admin/workflows/triggers', () => {
  it('retorna 401 quando usuário não está autenticado', async () => {
    mockSupabaseAuth(null)

    const response = await GET(new NextRequest('http://localhost/api/triggers'))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toMatchObject({ error: 'Não autenticado' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('retorna lista de triggers filtrando por workflow_version_id', async () => {
    mockSupabaseAuth(defaultUser)

    const eqSpy = vi.fn()
    const triggers = [{ id: 'trigger-1', workflow_version_id: 'wv-1', type: 'calendar' }]

    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'lab_workflow_triggers') {
          return buildSelectBuilder({ data: triggers, error: null }, eqSpy)
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    } as any)

    const response = await GET(
      new NextRequest('http://localhost/api/triggers?workflow_version_id=wv-1', {
        headers: new Headers({ authorization: 'Bearer token-123' }),
      })
    )

    expect(response.status).toBe(200)
    expect(eqSpy).toHaveBeenCalledWith('workflow_version_id', 'wv-1')
    const body = await response.json()
    expect(body).toEqual({ triggers })
  })
})

describe('POST /api/lab-ia/admin/workflows/triggers', () => {
  const validPayload = {
    workflow_version_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    type: 'calendar',
    config: { cron: '0 9 * * *', timezone: 'UTC' },
    is_active: true,
  }

  it('retorna erro 500 quando payload é inválido', async () => {
    mockSupabaseAuth(defaultUser)

    const request = {
      url: 'http://localhost/api/triggers',
      headers: new Headers({
        'content-type': 'application/json',
        authorization: 'Bearer token-123',
      }),
      json: async () => ({}),
    } as unknown as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBeTruthy()
  })
})
