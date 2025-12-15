import type { PipelineStep } from '@/modules/laboratorio-ia/services/pipelineRunner'
import { vi } from 'vitest'

export function createPipelineStep(partial: Partial<PipelineStep>): PipelineStep {
  return {
    order: 1,
    agent_id: 'agent-1',
    ...partial,
  }
}

export function createPipelineRecord(steps: PipelineStep[], overrides?: Partial<any>) {
  return {
    id: 'pipeline-test',
    name: 'Pipeline Test',
    description: 'Pipeline de teste',
    active: true,
    draft: false,
    steps,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

export function createPipelineExecution(pipelineId: string, results: any[]) {
  return {
    id: 'execution-123',
    pipeline_id: pipelineId,
    user_id: 'user-123',
    input: 'Test input',
    results,
    total_cost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
    total_latency: results.reduce((sum, r) => sum + (r.latency || 0), 0),
    status: 'completed',
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }
}

export function createPipelineLog(pipelineId: string, executionId: string, step: number) {
  return {
    id: `log-${step}`,
    pipeline_id: pipelineId,
    execution_id: executionId,
    step_order: step,
    agent_id: `agent-${step}`,
    input: `Input for step ${step}`,
    output: `Output from step ${step}`,
    cost: 0.10 * step,
    latency: 500 * step,
    status: 'completed',
    created_at: new Date().toISOString(),
  }
}

export function mockPipelineExecution(pipelineId: string) {
  return {
    pipelineId,
    messages: [{ role: 'user' as const, content: 'Test message' }],
    userId: 'user-123',
    onProgress: vi.fn(),
  }
}
