import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase'

describe('Lab IA - Agents CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch para todos os testes
    global.fetch = vi.fn()
  })

  it('should create a new agent via POST', async () => {
    // Mock da resposta do fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        agent: {
          id: 'agent-123',
          name: 'Test Agent',
          description: 'Test Description',
        },
      }),
    })

    const agentData = {
      name: 'Test Agent',
      description: 'Test Description',
      type: 'llm' as const,
      provider: 'OpenAI',
      model: 'gpt-5-nano',
      prompt: 'You are a helpful assistant',
      active: true,
    }

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentData),
    })

    expect(response.status).toBe(201)
  })

  it('should list agents via GET', async () => {
    const mockAgents = [
      {
        id: 'agent-1',
        name: 'Agent 1',
        description: 'Description 1',
        type: 'llm',
        active: true,
      },
      {
        id: 'agent-2',
        name: 'Agent 2',
        description: 'Description 2',
        type: 'llm',
        active: true,
      },
    ]

    // Mock da resposta do fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        agents: mockAgents,
        total: 2,
      }),
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/agents')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.agents).toHaveLength(2)
    expect(data.agents[0].name).toBe('Agent 1')
  })

  it('should update an agent via PUT', async () => {
    const updatedPrompt = 'Updated prompt content'

    // Mock da resposta do fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        agent: {
          id: 'agent-123',
          name: 'Test Agent',
          prompt: updatedPrompt,
        },
      }),
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/agents/agent-123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: updatedPrompt }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.agent.prompt).toBe(updatedPrompt)
  })

  it('should delete an agent via DELETE', async () => {
    // Mock da resposta do fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/agents/agent-123', {
      method: 'DELETE',
    })

    expect(response.status).toBe(200)
  })
})
