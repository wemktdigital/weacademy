import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const supabaseAuthGetSession = vi.fn()
const supabaseFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: supabaseAuthGetSession,
    },
    from: supabaseFrom,
  },
  createClient: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/modules/laboratorio-ia/services/pipelineRunner', () => ({
  runPipeline: vi.fn(),
}))

import { createJsonRequest } from '@/tests/utils/http'
import { collectSSE } from '@/tests/utils/sse'
import { POST } from '@/app/api/lab-ia/pipelines/run/route'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import { runPipeline } from '@/modules/laboratorio-ia/services/pipelineRunner'

let requestCounter = 0

function nextUrl(path: string) {
  requestCounter += 1
  return `http://localhost/${path}?t=${requestCounter}`
}

let POST: typeof import('@/app/api/lab-ia/pipelines/run/route').POST

async function loadRoute() {
  const mod = await import('@/app/api/lab-ia/pipelines/run/route')
  POST = mod.POST
}

beforeEach(async () => {
  vi.resetModules()
  await loadRoute()
  supabaseAuthGetSession.mockReset()
  supabaseFrom.mockReset()
  vi.mocked(supabaseCreateClient).mockReset()
  vi.mocked(runPipeline).mockReset()
})

afterEach(() => {
  vi.resetModules()
})

describe('POST /api/lab-ia/pipelines/run', () => {
  it('retorna 401 quando usuário não autenticado', async () => {
    supabaseAuthGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const request = createJsonRequest(nextUrl('api/run'), {
      body: { pipelineId: 'pipe-1', messages: [{ role: 'user', content: 'Olá' }] },
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(runPipeline).not.toHaveBeenCalled()
  })

  it('executa pipeline e envia eventos SSE', async () => {
    const user = { id: 'user-1' }
    supabaseAuthGetSession.mockResolvedValue({ data: { session: { user } }, error: null })

    supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
    })

    vi.mocked(supabaseCreateClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    } as any)

    const progressEvent = { step: 1, totalSteps: 1, agentId: 'agent-1', status: 'completed' } as any
    vi.mocked(runPipeline).mockImplementation(async (_pipelineId, _messages, _userId, onProgress) => {
      onProgress?.(progressEvent)
      return {
        results: [
          {
            agent_id: 'agent-1',
            output: 'Concluído',
            latency: 100,
            cost: 0.12,
            metadata: null,
          },
        ],
        totalLatency: 100,
        totalCost: 0.12,
      }
    })

    const request = createJsonRequest(nextUrl('api/run'), {
      headers: { authorization: 'Bearer token-abc' },
      body: { pipelineId: 'pipe-1', messages: [{ role: 'user', content: 'Olá' }] },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(runPipeline).toHaveBeenCalledWith('pipe-1', expect.any(Array), user.id, expect.any(Function))

    const { raw, events } = await collectSSE(response)
    expect(raw).toContain('"type":"progress"')
    expect(raw).toContain('"type":"done"')
    expect(events.some((entry) => entry.includes('Concluído'))).toBe(true)
  })

  it('retorna 400 quando pipelineId ausente', async () => {
    const user = { id: 'user-1' }
    supabaseAuthGetSession.mockResolvedValue({ data: { session: { user } }, error: null })
    supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
    })

    const request = createJsonRequest(nextUrl('api/run'), {
      body: { messages: [{ role: 'user', content: 'Olá' }] },
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(runPipeline).not.toHaveBeenCalled()
  })
})
