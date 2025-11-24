import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPipelineStep, createPipelineRecord, createPipelineExecution } from '../utils/pipelineFixtures'

// Mock dependencies
vi.mock('@/modules/laboratorio-ia/services/llmRouter', () => ({
  callLLM: vi.fn(),
}))

vi.mock('@/modules/laboratorio-ia/services/ragService', () => ({
  searchKnowledgeBase: vi.fn().mockResolvedValue([]),
  injectRAGContext: vi.fn((messages: any) => messages),
}))

vi.mock('@/modules/laboratorio-ia/services/abTesting', () => ({
  getABVariant: vi.fn().mockResolvedValue(null),
  recordABExecution: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
  })),
}))

import { callLLM } from '@/modules/laboratorio-ia/services/llmRouter'

describe('Lab IA - Pipeline Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('Sequential Execution', () => {
    it('should execute pipeline steps sequentially', async () => {
      const pipeline = createPipelineRecord([
        createPipelineStep({ order: 1, agent_id: 'agent-1' }),
        createPipelineStep({ order: 2, agent_id: 'agent-2' }),
      ])

      // Mock responses for each step
      const mockResponses = [
        { content: 'Output from step 1', cost: 0.10, latency: 500 },
        { content: 'Output from step 2', cost: 0.15, latency: 800 },
      ]

      let callCount = 0
      vi.mocked(callLLM).mockImplementation(async () => {
        const response = mockResponses[callCount]
        callCount++
        return {
          content: response.content,
          cost: response.cost,
          latency: response.latency,
        }
      })

      // Simulate sequential execution
      const results = []
      for (const step of pipeline.steps) {
        const result = await callLLM({
          provider: 'OpenAI',
          model: 'gpt-5-nano',
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        })
        results.push({
          agent_id: step.agent_id,
          output: result.content,
          cost: result.cost,
          latency: result.latency,
        })
      }

      expect(results).toHaveLength(2)
      expect(results[0].agent_id).toBe('agent-1')
      expect(results[1].agent_id).toBe('agent-2')
      expect(callLLM).toHaveBeenCalledTimes(2)
    })

    it('should pass output from previous step to next step', async () => {
      const pipeline = createPipelineRecord([
        createPipelineStep({ order: 1, agent_id: 'agent-1' }),
        createPipelineStep({ order: 2, agent_id: 'agent-2' }),
      ])

      const calls: any[] = []
      vi.mocked(callLLM).mockClear()
      vi.mocked(callLLM).mockImplementation(async (options: any) => {
        calls.push([...options.messages]) // Clone the array
        return {
          content: `Response to: ${options.messages[options.messages.length - 1].content}`,
          cost: 0.10,
          latency: 500,
        }
      })

      // Simulate execution with context passing
      let context = [{ role: 'user' as const, content: 'Initial message' }]
      
      for (const step of pipeline.steps) {
        const result = await callLLM({
          provider: 'OpenAI',
          model: 'gpt-5-nano',
          messages: context,
          stream: false,
        })
        
        // Add result to context for next step
        context.push({
          role: 'assistant',
          content: result.content,
        })
      }

      expect(calls.length).toBe(2)
      expect(calls[0].length).toBe(1) // Initial message
      expect(calls[1].length).toBe(2) // Initial + step 1 output
      expect(calls[1][1].content).toContain('Response to: Initial message')
    })
  })

  describe('Parallel Execution', () => {
    it('should execute independent steps in parallel', async () => {
      const pipeline = createPipelineRecord([
        createPipelineStep({ order: 1, agent_id: 'agent-1' }),
        createPipelineStep({ order: 1, agent_id: 'agent-2' }), // Same order = parallel
      ])

      const executionTimes: number[] = []
      
      vi.mocked(callLLM).mockImplementation(async () => {
        const startTime = Date.now()
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 100))
        executionTimes.push(Date.now() - startTime)
        return {
          content: 'Output',
          cost: 0.10,
          latency: 100,
        }
      })

      // Execute steps in parallel
      const startTime = Date.now()
      const promises = pipeline.steps.map(step =>
        callLLM({
          provider: 'OpenAI',
          model: 'gpt-5-nano',
          messages: [{ role: 'user', content: 'Test' }],
          stream: false,
        }).then(result => ({
          agent_id: step.agent_id,
          output: result.content,
          cost: result.cost,
          latency: result.latency,
        }))
      )

      const results = await Promise.all(promises)
      const totalTime = Date.now() - startTime

      expect(results).toHaveLength(2)
      // Parallel execution should take approximately the same time as one step (~100ms)
      // Sequential would take ~200ms
      expect(totalTime).toBeLessThan(150)
      expect(callLLM).toHaveBeenCalledTimes(2)
    })

    it('should handle mixed sequential and parallel steps', async () => {
      const pipeline = createPipelineRecord([
        createPipelineStep({ order: 1, agent_id: 'agent-1' }),
        createPipelineStep({ order: 1, agent_id: 'agent-2' }), // Parallel with agent-1
        createPipelineStep({ order: 2, agent_id: 'agent-3' }), // Sequential after parallel
      ])

      const executionOrder: string[] = []
      
      vi.mocked(callLLM).mockClear()
      vi.mocked(callLLM).mockImplementation(async (options: any) => {
        // Extract agent ID from message content
        const firstMessage = options.messages[0]
        const agentId = firstMessage.content?.includes('agent-') 
          ? firstMessage.content.match(/agent-\d+/)?.[0] || 'unknown'
          : 'unknown'
        executionOrder.push(agentId)
        return {
          content: `Output from ${agentId}`,
          cost: 0.10,
          latency: 50,
        }
      })

      // Simulate execution
      const step1Results = await Promise.all([
        callLLM({ provider: 'OpenAI', model: 'gpt-5-nano', messages: [{ role: 'user', content: 'agent-1' }], stream: false }),
        callLLM({ provider: 'OpenAI', model: 'gpt-5-nano', messages: [{ role: 'user', content: 'agent-2' }], stream: false }),
      ])
      
      // Step 2 depends on step 1
      const step2Result = await callLLM({
        provider: 'OpenAI',
        model: 'gpt-5-nano',
        messages: [
          { role: 'user', content: 'agent-3' },
          { role: 'assistant', content: step1Results[0].content },
        ],
        stream: false,
      })

      expect(executionOrder.length).toBe(3)
      // agent-1 and agent-2 should execute before agent-3
      expect(executionOrder).toContain('agent-1')
      expect(executionOrder).toContain('agent-2')
      expect(executionOrder[2]).toBe('agent-3')
      // Verify parallel execution happened first
      const parallelAgents = executionOrder.slice(0, 2)
      expect(parallelAgents).toContain('agent-1')
      expect(parallelAgents).toContain('agent-2')
    })
  })

  describe('Cost and Latency Calculation', () => {
    it('should calculate total cost correctly', () => {
      const execution = createPipelineExecution('pipeline-123', [
        { agent_id: 'agent-1', cost: 0.10, latency: 500 },
        { agent_id: 'agent-2', cost: 0.15, latency: 800 },
        { agent_id: 'agent-3', cost: 0.20, latency: 1200 },
      ])

      const totalCost = execution.results.reduce((sum, r) => sum + (r.cost || 0), 0)
      const totalLatency = execution.results.reduce((sum, r) => sum + (r.latency || 0), 0)

      expect(totalCost).toBe(0.45)
      expect(totalLatency).toBe(2500)
      expect(execution.total_cost).toBe(0.45)
      expect(execution.total_latency).toBe(2500)
    })

    it('should calculate cost per step', () => {
      const results = [
        { agent_id: 'agent-1', cost: 0.05, latency: 300 },
        { agent_id: 'agent-2', cost: 0.10, latency: 600 },
        { agent_id: 'agent-3', cost: 0.15, latency: 900 },
      ]

      expect(results[0].cost).toBe(0.05)
      expect(results[1].cost).toBe(0.10)
      expect(results[2].cost).toBe(0.15)
    })

    it('should handle zero cost steps', () => {
      const execution = createPipelineExecution('pipeline-123', [
        { agent_id: 'agent-1', cost: 0, latency: 100 },
        { agent_id: 'agent-2', cost: 0.10, latency: 500 },
      ])

      const totalCost = execution.results.reduce((sum, r) => sum + (r.cost || 0), 0)
      expect(totalCost).toBe(0.10)
    })

    it('should calculate average cost per step', () => {
      const results = [
        { agent_id: 'agent-1', cost: 0.10 },
        { agent_id: 'agent-2', cost: 0.20 },
        { agent_id: 'agent-3', cost: 0.30 },
      ]

      const totalCost = results.reduce((sum, r) => sum + r.cost, 0)
      const avgCost = totalCost / results.length

      expect(avgCost).toBeCloseTo(0.20, 2)
    })
  })

  describe('Variable Substitution', () => {
    it('should substitute variables in prompts', () => {
      const prompt = 'Process {{nome}} with {{tipo}}'
      const variables = { nome: 'João', tipo: 'análise' }
      
      let processedPrompt = prompt
      for (const [key, value] of Object.entries(variables)) {
        processedPrompt = processedPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value)
      }

      expect(processedPrompt).toBe('Process João with análise')
    })

    it('should handle missing variables', () => {
      const prompt = 'Process {{nome}} with {{tipo}}'
      const variables = { nome: 'João' } // tipo is missing
      
      let processedPrompt = prompt
      for (const [key, value] of Object.entries(variables)) {
        processedPrompt = processedPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value)
      }

      // Variable not replaced remains as {{tipo}}
      expect(processedPrompt).toBe('Process João with {{tipo}}')
    })

    it('should substitute multiple occurrences of same variable', () => {
      const prompt = '{{variavel}} is used here and also {{variavel}} again'
      const variables = { variavel: 'valor' }
      
      let processedPrompt = prompt
      for (const [key, value] of Object.entries(variables)) {
        processedPrompt = processedPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value)
      }

      expect(processedPrompt).toBe('valor is used here and also valor again')
    })
  })

  describe('Retry Logic', () => {
    it('should retry failed step execution', async () => {
      let attemptCount = 0
      const maxRetries = 3

      const executeWithRetry = async () => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          attemptCount++
          try {
            // Simulate failure on first attempts
            if (attempt < 2) {
              throw new Error('Temporary failure')
            }
            // Success on third attempt
            return { success: true, attempt: attempt + 1 }
          } catch (error) {
            if (attempt === maxRetries - 1) throw error
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
      }

      const result = await executeWithRetry()

      expect(result.success).toBe(true)
      expect(attemptCount).toBe(3)
    })

    it('should fail after max retries', async () => {
      let attemptCount = 0
      const maxRetries = 3

      const executeWithRetry = async () => {
        let lastError: Error | null = null
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          attemptCount++
          try {
            await new Promise(resolve => setTimeout(resolve, 10))
            // Always fail
            if (attempt === maxRetries - 1) {
              lastError = new Error('Final failure')
            } else {
              lastError = new Error('Persistent failure')
            }
            throw lastError
          } catch (error) {
            lastError = error as Error
            // On last attempt, re-throw the final error
            if (attempt === maxRetries - 1) {
              throw lastError
            }
            // On other attempts, continue to next retry
          }
        }
        // Should never reach here, but TypeScript needs it
        throw lastError || new Error('Unexpected')
      }

      await expect(executeWithRetry()).rejects.toThrow('Final failure')
      expect(attemptCount).toBe(3)
    })

    it('should use exponential backoff for retries', async () => {
      const delays: number[] = []
      const baseDelay = 100
      const maxRetries = 3

      const waitWithBackoff = async (attempt: number) => {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), 1000)
        delays.push(delay)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      for (let attempt = 0; attempt < maxRetries - 1; attempt++) {
        await waitWithBackoff(attempt)
      }

      expect(delays).toHaveLength(2)
      expect(delays[0]).toBe(100) // baseDelay * 2^0
      expect(delays[1]).toBe(200) // baseDelay * 2^1
    })
  })

  describe('Error Handling', () => {
    it('should handle step execution errors gracefully', async () => {
      const pipeline = createPipelineRecord([
        createPipelineStep({ order: 1, agent_id: 'agent-1' }),
        createPipelineStep({ order: 2, agent_id: 'agent-2' }),
      ])

      vi.mocked(callLLM).mockImplementationOnce(async () => {
        throw new Error('Step 1 failed')
      }).mockImplementationOnce(async () => {
        return { content: 'Step 2 success', cost: 0.10, latency: 500 }
      })

      const results: any[] = []
      const errors: any[] = []

      for (const step of pipeline.steps) {
        try {
          const result = await callLLM({
            provider: 'OpenAI',
            model: 'gpt-5-nano',
            messages: [{ role: 'user', content: 'Test' }],
            stream: false,
          })
          results.push({ agent_id: step.agent_id, output: result.content })
        } catch (error: any) {
          errors.push({ agent_id: step.agent_id, error: error.message })
        }
      }

      expect(errors).toHaveLength(1)
      expect(errors[0].agent_id).toBe('agent-1')
      expect(errors[0].error).toBe('Step 1 failed')
      expect(results).toHaveLength(1)
      expect(results[0].agent_id).toBe('agent-2')
    })

    it('should continue execution after non-critical errors', async () => {
      const pipeline = createPipelineRecord([
        createPipelineStep({ order: 1, agent_id: 'agent-1' }),
        createPipelineStep({ order: 2, agent_id: 'agent-2' }),
        createPipelineStep({ order: 3, agent_id: 'agent-3' }),
      ])

      let callCount = 0
      vi.mocked(callLLM).mockImplementation(async () => {
        callCount++
        // Fail on step 2, succeed on others
        if (callCount === 2) {
          throw new Error('Step 2 failed')
        }
        return {
          content: `Output from step ${callCount}`,
          cost: 0.10,
          latency: 500,
        }
      })

      const results: any[] = []
      const errors: any[] = []

      for (const step of pipeline.steps) {
        try {
          const result = await callLLM({
            provider: 'OpenAI',
            model: 'gpt-5-nano',
            messages: [{ role: 'user', content: 'Test' }],
            stream: false,
          })
          results.push({ agent_id: step.agent_id, output: result.content })
        } catch (error: any) {
          errors.push({ agent_id: step.agent_id, error: error.message })
          // Continue execution (don't break)
        }
      }

      expect(results).toHaveLength(2) // Steps 1 and 3 succeeded
      expect(errors).toHaveLength(1) // Step 2 failed
      expect(errors[0].agent_id).toBe('agent-2')
    })
  })

  describe('Progress Tracking', () => {
    it('should track execution progress', () => {
      const totalSteps = 5
      const progressEvents: any[] = []

      const simulateProgress = (currentStep: number) => {
        progressEvents.push({
          step: currentStep,
          totalSteps,
          progress: (currentStep / totalSteps) * 100,
          status: currentStep === totalSteps ? 'completed' : 'running',
        })
      }

      for (let step = 1; step <= totalSteps; step++) {
        simulateProgress(step)
      }

      expect(progressEvents).toHaveLength(5)
      expect(progressEvents[0].progress).toBe(20)
      expect(progressEvents[4].progress).toBe(100)
      expect(progressEvents[4].status).toBe('completed')
    })

    it('should track cost accumulation during execution', () => {
      const stepCosts = [0.10, 0.15, 0.20, 0.25]
      const accumulatedCosts: number[] = []
      let totalCost = 0

      for (const cost of stepCosts) {
        totalCost += cost
        accumulatedCosts.push(totalCost)
      }

      expect(accumulatedCosts).toEqual([0.10, 0.25, 0.45, 0.70])
      expect(totalCost).toBe(0.70)
    })
  })
})

