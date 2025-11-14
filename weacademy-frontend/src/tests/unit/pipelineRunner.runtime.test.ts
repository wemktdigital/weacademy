import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const pipelineStore: {
  pipeline: any
  agents: Map<string, any>
} = {
  pipeline: null,
  agents: new Map(),
}

function buildQuery(table: string) {
  let eqField: string | null = null
  let eqValue: any = null

  const resolveData = () => {
    switch (table) {
      case 'lab_pipeline_ab_experiments':
        return { data: [], error: null }
      case 'lab_agent_pipelines':
        return { data: pipelineStore.pipeline, error: null }
      case 'lab_agents': {
        if (eqField === 'id' && eqValue) {
          const agent = pipelineStore.agents.get(eqValue) || null
          return agent ? { data: agent, error: null } : { data: null, error: { message: 'not found' } }
        }
        return { data: null, error: { message: 'missing id' } }
      }
      case 'lab_pipeline_execution_logs':
      case 'lab_pipeline_execution_steps':
      case 'lab_pipeline_execution_events':
        return { data: {}, error: null }
      default:
        return { data: [], error: null }
    }
  }

  return {
    select() {
      return this
    },
    eq(field: string, value: any) {
      eqField = field
      eqValue = value
      return this
    },
    or() {
      return this
    },
    limit() {
      return this
    },
    order() {
      return this
    },
    update() {
      return this
    },
    insert(payload: any) {
      return {
        select: () => ({
          single: () => Promise.resolve({ data: payload, error: null }),
        }),
      }
    },
    maybeSingle() {
      return Promise.resolve(resolveData())
    },
    single() {
      return Promise.resolve(resolveData())
    },
    then(onFulfilled: any, onRejected?: any) {
      const promise = Promise.resolve(resolveData())
      return promise.then(onFulfilled, onRejected)
    },
    catch(onRejected: any) {
      const promise = Promise.resolve(resolveData())
      return promise.catch(onRejected)
    },
  }
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => buildQuery(table)),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  })),
}))

vi.mock('@/modules/laboratorio-ia/services/conditionEvaluator', () => ({
  evaluateCondition: vi.fn((condition: any, text: string) => {
    if (!condition || !condition.expression) return true
    return new RegExp(condition.expression, 'i').test(text)
  }),
}))

vi.mock('@/modules/laboratorio-ia/services/humanTaskService', () => ({
  createHumanTask: vi.fn(),
}))

vi.mock('@/modules/laboratorio-ia/services/variableProcessor', () => ({
  processPrompt: vi.fn((prompt: string) => prompt),
  processOutput: vi.fn((output: string) => output),
  buildVariableContext: vi.fn((steps: any[], messages: any[]) => ({ stepsExecuted: steps, messages })),
}))

vi.mock('@/modules/laboratorio-ia/services/outputValidator', () => ({
  validateOutput: vi.fn(() => ({ isValid: true })),
  createSchemaFromDefinition: vi.fn(),
}))

vi.mock('@/modules/laboratorio-ia/services/ragService', () => ({
  searchKnowledgeBase: vi.fn().mockResolvedValue([]),
  injectRAGContext: vi.fn((messages: any[]) => messages),
}))

vi.mock('@/modules/laboratorio-ia/services/abTesting', () => ({
  getABVariant: vi.fn().mockResolvedValue(null),
  recordABExecution: vi.fn(),
}))

vi.mock('@/modules/laboratorio-ia/services/llmRouter', () => ({
  callLLM: vi.fn(),
}))

import { runPipeline } from '@/modules/laboratorio-ia/services/pipelineRunner'
import { createPipelineRecord, createPipelineStep } from '../utils/pipelineFixtures'
import { callLLM } from '@/modules/laboratorio-ia/services/llmRouter'

function mockPipeline(steps: ReturnType<typeof createPipelineStep>[]) {
  pipelineStore.pipeline = createPipelineRecord(steps)
  pipelineStore.agents = new Map<string, any>()
  steps.forEach((step) => {
    pipelineStore.agents.set(step.agent_id, {
      id: step.agent_id,
      name: step.agent_id,
      provider: 'mock',
      model: 'mock-model',
      prompt: 'Atue como médico especialista.',
      output_schema: null,
      knowledge_base_files: [],
      icon: '🤖',
    })
  })
}

describe('pipelineRunner runPipeline - runtime', () => {
  beforeEach(() => {
    pipelineStore.pipeline = null
    pipelineStore.agents = new Map()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('executa steps condicionais e ignora os que falham condição', async () => {
    mockPipeline([
      createPipelineStep({
        order: 1,
        agent_id: 'agent-1',
        condition: { expression: 'sintoma' },
      }),
      createPipelineStep({
        order: 1,
        agent_id: 'agent-2',
        condition: { expression: 'urgente' },
      }),
    ])
    pipelineStore.agents.set('agent-2', {
      id: 'agent-2',
      name: 'agent-2',
      provider: 'mock',
      model: 'mock-model',
      prompt: 'Atue como médico especialista.',
      output_schema: null,
      knowledge_base_files: [],
      icon: '🤖',
    })

    vi.mocked(callLLM).mockResolvedValueOnce({ content: 'Diagnóstico base', cost: 0.1 })

    const result = await runPipeline(
      'pipeline-conditional',
      [{ role: 'user', content: 'Paciente relata sintoma leve.' }],
      'owner-1'
    )

    expect(result.results).toHaveLength(1)
    expect(result.results[0].agent_id).toBe('agent-1')
    expect(callLLM).toHaveBeenCalledTimes(1)
  })

  it('utiliza agente fallback quando o principal falha', async () => {
    mockPipeline([
      createPipelineStep({
        order: 1,
        agent_id: 'agent-primary',
        fallback_agent_id: 'agent-fallback',
      }),
    ])

    pipelineStore.agents.set('agent-primary', {
      id: 'agent-primary',
      name: 'Primário',
      provider: 'mock',
      model: 'mock-model',
      prompt: 'Prompt primário',
      output_schema: null,
      knowledge_base_files: [],
      icon: '🤖',
    })
    pipelineStore.agents.set('agent-fallback', {
      id: 'agent-fallback',
      name: 'Fallback',
      provider: 'mock',
      model: 'mock-model',
      prompt: 'Prompt fallback',
      output_schema: null,
      knowledge_base_files: [],
      icon: '🛟',
    })

    vi.mocked(callLLM)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ content: 'Resultado do fallback', cost: 0.05 })

    const result = await runPipeline(
      'pipeline-fallback',
      [{ role: 'user', content: 'Paciente sem resposta inicial.' }],
      'owner-1'
    )

    expect(result.results).toHaveLength(1)
    expect(result.results[0].agent_id).toBe('agent-fallback')
    expect(callLLM).toHaveBeenCalledTimes(2)
  })

  it('propaga escalonamento quando supervisor solicita', async () => {
    mockPipeline([
      createPipelineStep({
        order: 1,
        agent_id: 'agent-supervised',
        supervisor: {
          supervisorAgentId: 'agent-supervisor',
          decisionStyle: 'approve_reject',
        },
      }),
    ])

    pipelineStore.agents.set('agent-supervised', {
      id: 'agent-supervised',
      name: 'Supervisionado',
      provider: 'mock',
      model: 'mock-model',
      prompt: 'Prompt',
      output_schema: null,
      knowledge_base_files: [],
      icon: '🤖',
    })
    pipelineStore.agents.set('agent-supervisor', {
      id: 'agent-supervisor',
      name: 'Supervisor',
      provider: 'mock',
      model: 'mock-model',
      prompt: 'Supervisor prompt',
      output_schema: null,
      knowledge_base_files: [],
      icon: '🛡️',
    })

    vi.mocked(callLLM)
      .mockResolvedValueOnce({ content: 'Diagnóstico provisório', cost: 0.1 })
      .mockResolvedValueOnce({ content: 'ESCALAR: revisão humana necessária.', cost: 0.02 })

    await expect(
      runPipeline(
        'pipeline-supervisor',
        [{ role: 'user', content: 'Paciente apresenta sinais críticos.' }],
        'owner-1'
      )
    ).rejects.toThrow(/SUPERVISOR_ESCALATION::/)

    expect(callLLM).toHaveBeenCalledTimes(2)
  })
})
