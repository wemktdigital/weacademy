import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/modules/laboratorio-ia/services/ragService', () => ({
  searchKnowledgeBase: vi.fn().mockResolvedValue([]),
  injectRAGContext: vi.fn((messages: any) => messages),
}))

vi.mock('@/modules/laboratorio-ia/services/llmRouter', () => ({
  callLLM: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  })),
}))

vi.mock('@/modules/laboratorio-ia/services/abTesting', () => ({
  getABVariant: vi.fn().mockResolvedValue(null),
  recordABExecution: vi.fn(),
}))

import { __test, type PipelineStep, type PipelineExecutionResult } from '@/modules/laboratorio-ia/services/pipelineRunner'
import { createPipelineStep } from '../utils/pipelineFixtures'

describe('pipelineRunner.__test.runSupervisorReview', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const baseStep: PipelineStep = createPipelineStep({
    order: 1,
    agent_id: 'agent-1',
    supervisor: {
      supervisorAgentId: 'supervisor-1',
      decisionStyle: 'approve_reject',
    },
  })

  const baseResult: PipelineExecutionResult = {
    agent_id: 'agent-1',
    output: 'Diagnóstico gerado com sucesso.',
    latency: 10,
    cost: 0.2,
  }

  it('retorna decisão approved e metadados corretos', async () => {
    const agentRunner = vi.fn().mockResolvedValue({
      stepResult: {
        agent_id: 'supervisor-1',
        output: 'Aprovação registrada',
        latency: 4,
        cost: 0.01,
      },
      agentName: 'Supervisor',
      agentIcon: '🛡️',
      rawOutput: 'APROVADO: tudo certo. CONFIDENCE=0.92',
    })

    const review = await __test.runSupervisorReview({
      supervisorConfig: baseStep.supervisor,
      step: baseStep,
      stepResult: baseResult,
      branchContext: [],
      stepVariableContext: {},
      totalSteps: 1,
      agentRunner,
    })

    expect(agentRunner).toHaveBeenCalledOnce()
    expect(review.decision).toBe('approved')
    expect(review.metadata).toMatchObject({
      supervisorAgentId: 'supervisor-1',
      decision: 'approved',
      confidence: 0.92,
    })
  })

  it('sinaliza changes_requested quando supervisor pede alterações', async () => {
    const agentRunner = vi.fn().mockResolvedValue({
      stepResult: {
        agent_id: 'supervisor-1',
        output: 'Solicitar revisão',
        latency: 5,
        cost: 0.02,
      },
      agentName: 'Supervisor',
      rawOutput: 'ALTERAR: revisar exames complementares.'
    })

    const review = await __test.runSupervisorReview({
      supervisorConfig: baseStep.supervisor,
      step: baseStep,
      stepResult: baseResult,
      branchContext: [],
      stepVariableContext: {},
      totalSteps: 1,
      agentRunner,
    })

    expect(review.decision).toBe('changes_requested')
    expect(review.summary).toContain('ALTERAR')
  })

  it('sinaliza escalate_human quando supervisor solicita escalonamento', async () => {
    const agentRunner = vi.fn().mockResolvedValue({
      stepResult: {
        agent_id: 'supervisor-1',
        output: 'Escalar caso crítico',
        latency: 6,
        cost: 0.03,
      },
      agentName: 'Supervisor',
      rawOutput: 'ESCALAR: sinais vitais críticos detectados.'
    })

    const review = await __test.runSupervisorReview({
      supervisorConfig: baseStep.supervisor,
      step: baseStep,
      stepResult: baseResult,
      branchContext: [],
      stepVariableContext: {},
      totalSteps: 1,
      agentRunner,
    })

    expect(review.decision).toBe('escalate_human')
    expect(review.metadata.rawOutput).toContain('ESCALAR')
  })
})
