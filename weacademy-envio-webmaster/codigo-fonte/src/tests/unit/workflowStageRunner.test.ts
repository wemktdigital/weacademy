import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/modules/laboratorio-ia/services/pipelineRunner', () => ({
  runPipeline: vi.fn(),
}))

import { runPipeline } from '@/modules/laboratorio-ia/services/pipelineRunner'
import {
  executeWorkflowStage,
  type WorkflowStageRecord,
  type WorkflowInstanceRecord,
  type WorkflowStageRunRecord,
} from '@/modules/laboratorio-ia/services/workflowStageRunner'

const baseStage: WorkflowStageRecord = {
  id: 'stage-1',
  workflow_version_id: 'wv-1',
  stage_key: 'pipeline_stage',
  type: 'pipeline',
  name: 'Pipeline Stage',
  config: {
    pipelineId: 'pipeline-test',
    inputPath: 'messages',
    supervisor: {
      supervisorAgentId: 'supervisor-1',
      decisionStyle: 'approve_reject',
    },
  },
  loop_config: null,
  entry_conditions: null,
  exit_actions: null,
  order_hint: 1,
}

const baseInstance: WorkflowInstanceRecord = {
  id: 'instance-1',
  workflow_version_id: 'wv-1',
  owner_user_id: 'owner-1',
  status: 'running',
  context: {},
  metadata: {},
  total_latency_ms: 0,
  total_cost_usd: 0,
}

const baseStageRun: WorkflowStageRunRecord = {
  id: 'stage-run-1',
  workflow_instance_id: 'instance-1',
  stage_id: 'stage-1',
  status: 'pending',
  attempt: 1,
  input_snapshot: {},
  output_snapshot: {},
  error_info: null,
  resume_at: null,
  started_at: null,
  finished_at: null,
  latency_ms: null,
  cost_usd: null,
  input_tokens: null,
  output_tokens: null,
  human_status: null,
  assigned_user_id: null,
  assigned_role: null,
  assigned_at: null,
  due_at: null,
  sla_seconds: null,
  completed_by: null,
  completed_at: null,
  decision: null,
  decision_reason: null,
  escalation_level: null,
  escalated_at: null,
}

const baseContext = {
  messages: [{ role: 'user', content: 'Paciente apresenta sintomas X.' }],
}

describe('workflowStageRunner.executeWorkflowStage - supervisão', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mantém status completed quando pipeline aprova', async () => {
    ;(runPipeline as unknown as vi.Mock).mockResolvedValue({
      results: [
        {
          agent_id: 'agent-1',
          output: 'Diagnóstico final',
          latency: 12,
          cost: 0.25,
          metadata: {
            supervisor: {
              supervisorAgentId: 'supervisor-1',
              decision: 'approved',
            },
          },
        },
      ],
      totalLatency: 12,
      totalCost: 0.25,
    })

    const result = await executeWorkflowStage({
      stage: baseStage,
      instance: { ...baseInstance },
      context: { ...baseContext },
      stageRun: { ...baseStageRun },
    })

    expect(result.status).toBe('completed')
    expect(result.outputSnapshot?.supervisor).toBeTruthy()
    expect(result.outputSnapshot?.stepResults?.[0]?.metadata?.supervisor?.decision).toBe('approved')
  })

  it('retorna waiting_human quando supervisor solicita escalonamento', async () => {
    ;(runPipeline as unknown as vi.Mock).mockRejectedValue(
      new Error('SUPERVISOR_ESCALATION::Revisar sinais vitais')
    )

    const result = await executeWorkflowStage({
      stage: baseStage,
      instance: { ...baseInstance },
      context: { ...baseContext },
      stageRun: { ...baseStageRun },
    })

    expect(result.status).toBe('waiting_human')
    expect(result.outputSnapshot?.supervisorEscalation).toBe(true)
    expect(result.outputSnapshot?.reason).toContain('Revisar sinais vitais')
    expect(result.humanTask?.instructions).toContain('escalou a etapa')
  })
})
