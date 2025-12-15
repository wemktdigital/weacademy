import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServer: vi.fn(),
}))

vi.mock('@/modules/laboratorio-ia/services/workflowScheduler', () => ({
  runCalendarTriggers: vi.fn(),
}))

import { POST } from '@/app/api/lab-ia/admin/workflows/triggers/run/route'
import { supabaseServer } from '@/lib/supabaseServer'
import { runCalendarTriggers } from '@/modules/laboratorio-ia/services/workflowScheduler'
import { mockSupabaseAuth } from '@/tests/utils/mockSupabaseAuth'

const defaultUser = { id: 'user-1' }

function mockAuth(user: any | null) {
  return mockSupabaseAuth(vi.mocked(supabaseServer), user)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.resetModules()
})

describe('POST /api/lab-ia/admin/workflows/triggers/run', () => {
  it('retorna 401 quando não autenticado', async () => {
    mockAuth(null)

    const response = await POST(new NextRequest('http://localhost/api/run'))

    expect(response.status).toBe(401)
    expect(runCalendarTriggers).not.toHaveBeenCalled()
  })

  it('executa dryRun quando solicitado', async () => {
    mockAuth(defaultUser)
    vi.mocked(runCalendarTriggers).mockResolvedValue([{ triggerId: 't-1', skipped: true }])

    const response = await POST(
      new NextRequest('http://localhost/api/run?dryRun=true&at=2025-01-01T12:00:00Z', {
        headers: new Headers({ authorization: 'Bearer test' }),
      })
    )

    expect(runCalendarTriggers).toHaveBeenCalledWith(new Date('2025-01-01T12:00:00Z'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ dryRun: true, success: true, results: [{ triggerId: 't-1' }] })
  })

  it('retorna erro 400 para parâmetro at inválido', async () => {
    mockAuth(defaultUser)

    const response = await POST(new NextRequest('http://localhost/api/run?at=invalid-date'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Parâmetro "at" inválido')
    expect(runCalendarTriggers).not.toHaveBeenCalled()
  })
})
