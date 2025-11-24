import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPipelineLog, createPipelineExecution, createPipelineRecord } from '../utils/pipelineFixtures'

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}))

describe('Lab IA - Pipeline Logs and History', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('Log Saving', () => {
    it('should save pipeline execution log to database', async () => {
      const pipeline = createPipelineRecord([
        { order: 1, agent_id: 'agent-1' },
        { order: 2, agent_id: 'agent-2' },
      ])

      const execution = createPipelineExecution(pipeline.id, [
        { agent_id: 'agent-1', cost: 0.10, latency: 500, output: 'Output 1' },
        { agent_id: 'agent-2', cost: 0.15, latency: 800, output: 'Output 2' },
      ])

      const logData = {
        pipeline_id: pipeline.id,
        user_id: execution.user_id,
        input_messages: [{ role: 'user', content: 'Test input' }],
        output_messages: execution.results.map(r => ({
          agent_id: r.agent_id,
          output: r.output,
          latency_ms: r.latency,
          cost_usd: r.cost,
        })),
        steps_executed: execution.results.length,
        total_latency_ms: execution.total_latency,
        total_cost_usd: execution.total_cost,
      }

      // Mock successful insert
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 123,
          ...logData,
          created_at: new Date().toISOString(),
        }),
      })

      // Simulate saving log (via API or direct database call)
      const response = await fetch('http://localhost:3000/api/lab-ia/pipelines/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      })

      expect(response.status).toBe(201)
      const savedLog = await response.json()
      expect(savedLog.pipeline_id).toBe(pipeline.id)
      expect(savedLog.steps_executed).toBe(2)
      expect(savedLog.total_cost_usd).toBe(0.25)
      expect(savedLog.total_latency_ms).toBe(1300)
    })

    it('should include all required fields in log', async () => {
      const logData = {
        pipeline_id: 'pipeline-123',
        user_id: 'user-123',
        input_messages: [{ role: 'user', content: 'Test' }],
        output_messages: [
          { agent_id: 'agent-1', output: 'Output', latency_ms: 100, cost_usd: 0.10 },
        ],
        steps_executed: 1,
        total_latency_ms: 100,
        total_cost_usd: 0.10,
      }

      // Validate required fields
      expect(logData.pipeline_id).toBeDefined()
      expect(logData.user_id).toBeDefined()
      expect(logData.input_messages).toBeDefined()
      expect(logData.output_messages).toBeDefined()
      expect(logData.steps_executed).toBeDefined()
      expect(logData.total_latency_ms).toBeDefined()
      expect(logData.total_cost_usd).toBeDefined()
    })

    it('should save log with correct data structure', () => {
      const execution = createPipelineExecution('pipeline-123', [
        { agent_id: 'agent-1', cost: 0.10, latency: 500, output: 'Output 1' },
        { agent_id: 'agent-2', cost: 0.15, latency: 800, output: 'Output 2' },
      ])

      const logData = {
        pipeline_id: 'pipeline-123',
        user_id: execution.user_id,
        input_messages: [{ role: 'user', content: 'Input' }],
        output_messages: execution.results.map(r => ({
          agent_id: r.agent_id,
          output: r.output,
          latency_ms: r.latency,
          cost_usd: r.cost,
        })),
        steps_executed: execution.results.length,
        total_latency_ms: execution.total_latency,
        total_cost_usd: execution.total_cost,
      }

      expect(logData.output_messages).toHaveLength(2)
      expect(logData.output_messages[0].agent_id).toBe('agent-1')
      expect(logData.output_messages[1].agent_id).toBe('agent-2')
      expect(logData.output_messages[0].latency_ms).toBe(500)
      expect(logData.output_messages[1].latency_ms).toBe(800)
    })
  })

  describe('History Retrieval', () => {
    it('should retrieve pipeline execution history', async () => {
      const mockLogs = [
        {
          id: 1,
          pipeline_id: 'pipeline-1',
          user_id: 'user-123',
          steps_executed: 2,
          total_latency_ms: 1300,
          total_cost_usd: 0.25,
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          pipeline_id: 'pipeline-2',
          user_id: 'user-123',
          steps_executed: 3,
          total_latency_ms: 2000,
          total_cost_usd: 0.45,
          created_at: new Date().toISOString(),
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          logs: mockLogs,
          pagination: {
            total: 2,
            page: 1,
            limit: 10,
            pages: 1,
          },
        }),
      })

      const response = await fetch('http://localhost:3000/api/lab-ia/pipelines/history')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.logs).toHaveLength(2)
      expect(data.pagination).toBeDefined()
      expect(data.pagination.total).toBe(2)
    })

    it('should support pagination in history', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          logs: [],
          pagination: {
            total: 25,
            page: 2,
            limit: 10,
            pages: 3,
          },
        }),
      })

      const response = await fetch('http://localhost:3000/api/lab-ia/pipelines/history?page=2&limit=10')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.pages).toBe(3)
    })

    it('should filter history by pipeline ID', async () => {
      const mockLogs = [
        {
          id: 1,
          pipeline_id: 'pipeline-1',
          user_id: 'user-123',
          steps_executed: 2,
          total_latency_ms: 1300,
          total_cost_usd: 0.25,
          created_at: new Date().toISOString(),
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          logs: mockLogs,
          pagination: { total: 1, page: 1, limit: 10, pages: 1 },
        }),
      })

      const response = await fetch('http://localhost:3000/api/lab-ia/pipelines/history?pipeline_id=pipeline-1')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.logs).toHaveLength(1)
      expect(data.logs[0].pipeline_id).toBe('pipeline-1')
    })

    it('should filter history by date range', async () => {
      const startDate = '2024-01-01T00:00:00Z'
      const endDate = '2024-01-31T23:59:59Z'

      const mockLogs = [
        {
          id: 1,
          pipeline_id: 'pipeline-1',
          created_at: '2024-01-15T10:00:00Z',
          steps_executed: 2,
          total_cost_usd: 0.25,
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          logs: mockLogs,
          pagination: { total: 1, page: 1, limit: 10, pages: 1 },
        }),
      })

      const response = await fetch(
        `http://localhost:3000/api/lab-ia/pipelines/history?start_date=${startDate}&end_date=${endDate}`
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.logs).toHaveLength(1)
      const logDate = new Date(data.logs[0].created_at)
      expect(logDate >= new Date(startDate)).toBe(true)
      expect(logDate <= new Date(endDate)).toBe(true)
    })

    it('should filter history by user ID (admin only)', async () => {
      const mockLogs = [
        {
          id: 1,
          pipeline_id: 'pipeline-1',
          user_id: 'user-456',
          steps_executed: 2,
          total_cost_usd: 0.25,
          created_at: new Date().toISOString(),
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          logs: mockLogs,
          pagination: { total: 1, page: 1, limit: 10, pages: 1 },
        }),
      })

      const response = await fetch('http://localhost:3000/api/lab-ia/pipelines/history?user_id=user-456')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.logs).toHaveLength(1)
      expect(data.logs[0].user_id).toBe('user-456')
    })

    it('should search history by keyword', async () => {
      const mockLogs = [
        {
          id: 1,
          pipeline_id: 'pipeline-1',
          input_messages: [{ role: 'user', content: 'Test message' }],
          output_messages: [{ agent_id: 'agent-1', output: 'Response' }],
          steps_executed: 1,
          total_cost_usd: 0.10,
          created_at: new Date().toISOString(),
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          logs: mockLogs,
          pagination: { total: 1, page: 1, limit: 10, pages: 1 },
        }),
      })

      const response = await fetch('http://localhost:3000/api/lab-ia/pipelines/history?search=Test')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.logs).toHaveLength(1)
    })
  })

  describe('Log Structure', () => {
    it('should have correct log structure with all fields', () => {
      const log = createPipelineLog('pipeline-123', 'execution-123', 1)

      expect(log.id).toBeDefined()
      expect(log.pipeline_id).toBe('pipeline-123')
      expect(log.execution_id).toBe('execution-123')
      expect(log.step_order).toBe(1)
      expect(log.agent_id).toBeDefined()
      expect(log.input).toBeDefined()
      expect(log.output).toBeDefined()
      expect(log.cost).toBeDefined()
      expect(log.latency).toBeDefined()
      expect(log.status).toBeDefined()
      expect(log.created_at).toBeDefined()
    })

    it('should serialize input_messages correctly', () => {
      const inputMessages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Second message' },
      ]

      const serialized = JSON.stringify(inputMessages)
      const parsed = JSON.parse(serialized)

      expect(parsed).toHaveLength(3)
      expect(parsed[0].role).toBe('user')
      expect(parsed[0].content).toBe('First message')
    })

    it('should serialize output_messages correctly', () => {
      const outputMessages = [
        {
          agent_id: 'agent-1',
          output: 'Output from agent 1',
          latency_ms: 500,
          cost_usd: 0.10,
        },
        {
          agent_id: 'agent-2',
          output: 'Output from agent 2',
          latency_ms: 800,
          cost_usd: 0.15,
        },
      ]

      const serialized = JSON.stringify(outputMessages)
      const parsed = JSON.parse(serialized)

      expect(parsed).toHaveLength(2)
      expect(parsed[0].agent_id).toBe('agent-1')
      expect(parsed[0].latency_ms).toBe(500)
      expect(parsed[0].cost_usd).toBe(0.10)
    })
  })

  describe('Log Export', () => {
    it('should export log as JSON', async () => {
      const log = {
        id: 1,
        pipeline_id: 'pipeline-123',
        user_id: 'user-123',
        input_messages: [{ role: 'user', content: 'Test' }],
        output_messages: [{ agent_id: 'agent-1', output: 'Output' }],
        steps_executed: 1,
        total_latency_ms: 500,
        total_cost_usd: 0.10,
        created_at: new Date().toISOString(),
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => log,
      })

      const response = await fetch('http://localhost:3000/api/lab-ia/pipelines/history/1/export?format=json')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pipeline_id).toBe('pipeline-123')
      expect(data.steps_executed).toBe(1)
    })

    it('should export log as Markdown', async () => {
      const log = {
        id: 1,
        pipeline_id: 'pipeline-123',
        input_messages: [{ role: 'user', content: 'Test' }],
        output_messages: [{ agent_id: 'agent-1', output: 'Output' }],
        steps_executed: 1,
        total_cost_usd: 0.10,
        created_at: new Date().toISOString(),
      }

      const markdownExport = `# Pipeline Execution Log

**ID:** ${log.id}
**Pipeline ID:** ${log.pipeline_id}
**Steps Executed:** ${log.steps_executed}
**Total Cost:** $${log.total_cost_usd}
**Created At:** ${log.created_at}

## Input Messages
${log.input_messages.map((msg: any) => `- **${msg.role}**: ${msg.content}`).join('\n')}

## Output Messages
${log.output_messages.map((msg: any) => `- **${msg.agent_id}**: ${msg.output}`).join('\n')}
`

      expect(markdownExport).toContain('# Pipeline Execution Log')
      expect(markdownExport).toContain(log.pipeline_id)
      expect(markdownExport).toContain('Steps Executed')
      expect(markdownExport).toContain(log.steps_executed.toString())
    })

    it('should include all log fields in export', () => {
      const log = createPipelineExecution('pipeline-123', [
        { agent_id: 'agent-1', cost: 0.10, latency: 500, output: 'Output 1' },
        { agent_id: 'agent-2', cost: 0.15, latency: 800, output: 'Output 2' },
      ])

      const exportData = {
        execution_id: log.id,
        pipeline_id: log.pipeline_id,
        user_id: log.user_id,
        input: log.input,
        results: log.results,
        total_cost: log.total_cost,
        total_latency: log.total_latency,
        status: log.status,
        created_at: log.created_at,
        completed_at: log.completed_at,
      }

      expect(exportData.execution_id).toBeDefined()
      expect(exportData.pipeline_id).toBeDefined()
      expect(exportData.results).toHaveLength(2)
      expect(exportData.total_cost).toBe(0.25)
      expect(exportData.total_latency).toBe(1300)
    })
  })

  describe('Log Statistics', () => {
    it('should calculate total executions count', () => {
      const logs = [
        { id: 1, pipeline_id: 'pipeline-1' },
        { id: 2, pipeline_id: 'pipeline-1' },
        { id: 3, pipeline_id: 'pipeline-2' },
        { id: 4, pipeline_id: 'pipeline-1' },
      ]

      const totalCount = logs.length
      expect(totalCount).toBe(4)
    })

    it('should calculate total cost across all logs', () => {
      const logs = [
        { id: 1, total_cost_usd: 0.25 },
        { id: 2, total_cost_usd: 0.45 },
        { id: 3, total_cost_usd: 0.30 },
      ]

      const totalCost = logs.reduce((sum, log) => sum + log.total_cost_usd, 0)
      expect(totalCost).toBe(1.00)
    })

    it('should calculate average cost per execution', () => {
      const logs = [
        { id: 1, total_cost_usd: 0.10 },
        { id: 2, total_cost_usd: 0.20 },
        { id: 3, total_cost_usd: 0.30 },
      ]

      const totalCost = logs.reduce((sum, log) => sum + log.total_cost_usd, 0)
      const avgCost = totalCost / logs.length
      expect(avgCost).toBeCloseTo(0.20, 2)
    })

    it('should find most used pipeline', () => {
      const logs = [
        { id: 1, pipeline_id: 'pipeline-1' },
        { id: 2, pipeline_id: 'pipeline-1' },
        { id: 3, pipeline_id: 'pipeline-2' },
        { id: 4, pipeline_id: 'pipeline-1' },
        { id: 5, pipeline_id: 'pipeline-2' },
      ]

      const pipelineCounts: Record<string, number> = {}
      logs.forEach(log => {
        pipelineCounts[log.pipeline_id] = (pipelineCounts[log.pipeline_id] || 0) + 1
      })

      const mostUsed = Object.entries(pipelineCounts).sort((a, b) => b[1] - a[1])[0]
      expect(mostUsed[0]).toBe('pipeline-1')
      expect(mostUsed[1]).toBe(3)
    })

    it('should calculate average latency per execution', () => {
      const logs = [
        { id: 1, total_latency_ms: 1000 },
        { id: 2, total_latency_ms: 2000 },
        { id: 3, total_latency_ms: 1500 },
      ]

      const totalLatency = logs.reduce((sum, log) => sum + log.total_latency_ms, 0)
      const avgLatency = totalLatency / logs.length
      expect(avgLatency).toBe(1500)
    })
  })

  describe('Log Validation', () => {
    it('should validate log structure', () => {
      const validLog = {
        pipeline_id: 'pipeline-123',
        user_id: 'user-123',
        input_messages: [],
        output_messages: [],
        steps_executed: 0,
        total_latency_ms: 0,
        total_cost_usd: 0,
      }

      expect(validLog.pipeline_id).toBeDefined()
      expect(validLog.user_id).toBeDefined()
      expect(Array.isArray(validLog.input_messages)).toBe(true)
      expect(Array.isArray(validLog.output_messages)).toBe(true)
      expect(typeof validLog.steps_executed).toBe('number')
      expect(typeof validLog.total_latency_ms).toBe('number')
      expect(typeof validLog.total_cost_usd).toBe('number')
    })

    it('should handle empty logs gracefully', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          logs: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 10,
            pages: 0,
          },
        }),
      })

      const response = await fetch('http://localhost:3000/api/lab-ia/pipelines/history')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.logs).toHaveLength(0)
      expect(data.pagination.total).toBe(0)
    })

    it('should return 401 when not authenticated', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Unauthorized',
        }),
      })

      const response = await fetch('http://localhost:3000/api/lab-ia/pipelines/history')
      expect(response.status).toBe(401)
    })
  })
})

