import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createJsonRequest } from '@/tests/utils/http'

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServer: vi.fn(),
}))

vi.mock('@/modules/laboratorio-ia/services/workflowOrchestrator', () => ({
  resumeWorkflowStage: vi.fn(),
}))

import { POST } from '@/app/api/lab-ia/workflows/stage/[stageRunId]/resume/route'
import { supabaseServer } from '@/lib/supabaseServer'
import { resumeWorkflowStage } from '@/modules/laboratorio-ia/services/workflowOrchestrator'

const defaultUser = { id: 'user-xyz' }

function mockAuth(user: any | null) {
  vi.mocked(supabaseServer).mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'noauth' } }),
    },
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.resetModules()
})

describe('POST /api/lab-ia/workflows/stage/[stageRunId]/resume', () => {
  it('retorna 401 quando não autenticado', async () => {
    mockAuth(null)

    const request = createJsonRequest('http://localhost/api/stage-resume', {
      body: { submission: { decision: 'approved' } },
    })

    const response = await POST(request, { params: { stageRunId: 'sr-1' } })

    expect(response.status).toBe(401)
    expect(resumeWorkflowStage).not.toHaveBeenCalled()
  })

  it('retorna 400 quando stageRunId ausente', async () => {
    mockAuth(defaultUser)

    const request = createJsonRequest('http://localhost/api/stage-resume', {
      body: { submission: { comment: 'ok' } },
    })

    const response = await POST(request, { params: { stageRunId: '' } })

    expect(response.status).toBe(400)
    expect(resumeWorkflowStage).not.toHaveBeenCalled()
  })

  it('retoma etapa quando autenticação válida e submission fornecida', async () => {
    mockAuth(defaultUser)
    vi.mocked(resumeWorkflowStage).mockResolvedValue(undefined)

    const submission = { status: 'approved', completedBy: 'user-xyz' }
    const request = createJsonRequest('http://localhost/api/stage-resume', {
      body: { submission },
    })

    const response = await POST(request, { params: { stageRunId: 'sr-42' } })

    expect(response.status).toBe(200)
    expect(resumeWorkflowStage).toHaveBeenCalledWith({
      stageRunId: 'sr-42',
      submission,
      userId: defaultUser.id,
    })
    const body = await response.json()
    expect(body).toEqual({ success: true })
  })
})
