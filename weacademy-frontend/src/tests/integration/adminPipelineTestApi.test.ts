import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const supabaseServerMock = vi.fn()
const supabaseCreateClientMock = vi.fn()

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServer: supabaseServerMock,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseCreateClientMock,
}))

vi.mock('@/modules/laboratorio-ia/services/pipelineRunner', () => ({
  runPipeline: vi.fn(),
}))

let POST: typeof import('@/app/api/lab-ia/admin/pipelines/[id]/test/route').POST

async function loadRoute() {
  const mod = await import('@/app/api/lab-ia/admin/pipelines/[id]/test/route')
  POST = mod.POST
}

import { runPipeline } from '@/modules/laboratorio-ia/services/pipelineRunner'
import { createJsonRequest } from '@/tests/utils/http'
import { collectSSE } from '@/tests/utils/sse'
import { mockSupabaseAuth } from '@/tests/utils/mockSupabaseAuth'

function createSupabaseWithAuth(user: any | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'Unauthorized' } }),
    },
    from: vi.fn(),
  }
}

beforeEach(async () => {
  vi.resetModules()
  await loadRoute()
  supabaseServerMock.mockReset()
  supabaseCreateClientMock.mockReset()
  vi.mocked(runPipeline).mockReset()
})

afterEach(() => {
  vi.resetModules()
})

describe('POST /api/lab-ia/admin/pipelines/[id]/test', () => {
  it('retorna 400 quando pipelineId ausente', async () => {
    const request = createJsonRequest('http://localhost/api/admin/pipelines/test', {
      body: { message: 'Oi' },
    })

    const response = await POST(request, { params: { id: '' } })

    expect(response.status).toBe(400)
  })

  it('retorna 401 quando não autenticado', async () => {
    supabaseCreateClientMock.mockReturnValueOnce(createSupabaseWithAuth(null))
    mockSupabaseAuth(supabaseServerMock, null)

    const request = createJsonRequest('http://localhost/api/admin/pipelines/test', {
      body: { message: 'Oi' },
    })

    const response = await POST(request, { params: { id: 'pipe-1' } })

    expect(response.status).toBe(401)
    expect(runPipeline).not.toHaveBeenCalled()
  })

  it('retorna 403 quando usuário não é admin', async () => {
    const user = { id: 'user-1' }
    // Token auth
    supabaseCreateClientMock
      .mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
        },
      } as any)
      // profiles lookup
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { role: 'student' }, error: null }),
        }),
      } as any)

    const request = createJsonRequest('http://localhost/api/admin/pipelines/test', {
      headers: { authorization: 'Bearer token' },
      body: { message: 'Oi' },
    })

    const response = await POST(request, { params: { id: 'pipe-1' } })

    expect(response.status).toBe(403)
    expect(runPipeline).not.toHaveBeenCalled()
  })

  it('executa pipeline e retorna SSE com resultado', async () => {
    const user = { id: 'admin-1' }

    // Auth with token
    supabaseCreateClientMock
      .mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
        },
      } as any)
      // profiles service role
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
        }),
      } as any)
      // pipeline fetch + updates/agents
      .mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'lab_agent_pipelines') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: 'pipe-1', draft: true, steps: [] }, error: null }),
              update: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
            }
          }
          if (table === 'lab_agents') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { name: 'Agente', icon: '🤖' }, error: null }),
            }
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }),
      } as any)

    mockSupabaseAuth(supabaseServerMock, user)

    vi.mocked(runPipeline).mockImplementation(async (_id, _messages, _userId, onProgress) => {
      onProgress?.({ step: 1, totalSteps: 1, agentId: 'agent-1', status: 'completed' } as any)
      return {
        results: [
          {
            agent_id: 'agent-1',
            output: 'OK',
            latency: 50,
            cost: 0.02,
            metadata: null,
          },
        ],
        totalLatency: 50,
        totalCost: 0.02,
      }
    })

    const request = createJsonRequest('http://localhost/api/admin/pipelines/test', {
      headers: { authorization: 'Bearer token' },
      body: { message: 'Teste rápido' },
    })

    const response = await POST(request, { params: { id: 'pipe-1' } })

    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    const { raw } = await collectSSE(response)
    expect(raw).toContain('"type":"done"')
    expect(raw).toContain('"success":true')
    expect(runPipeline).toHaveBeenCalledWith('pipe-1', expect.any(Array), user.id, expect.any(Function), true)
  })
})
