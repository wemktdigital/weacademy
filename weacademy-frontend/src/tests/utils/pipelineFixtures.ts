import type { PipelineStep } from '@/modules/laboratorio-ia/services/pipelineRunner'

export function createPipelineStep(partial: Partial<PipelineStep>): PipelineStep {
  return {
    order: 1,
    agent_id: 'agent-1',
    ...partial,
  }
}

export function createPipelineRecord(steps: PipelineStep[]) {
  return {
    id: 'pipeline-test',
    name: 'Pipeline Test',
    active: true,
    draft: false,
    steps,
  }
}
