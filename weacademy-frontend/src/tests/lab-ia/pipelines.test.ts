import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPipelineStep, createPipelineRecord } from '../utils/pipelineFixtures'

describe('Lab IA - Pipelines CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch para todos os testes
    global.fetch = vi.fn()
  })

  it('should create a new pipeline via POST', async () => {
    const pipelineData = {
      name: 'Pipeline de Teste',
      description: 'Descrição do pipeline de teste',
      steps: [
        { order: 1, agent_id: 'agent-1' },
        { order: 2, agent_id: 'agent-2' }
      ],
      active: true,
      draft: false
    }

    // Mock da resposta do fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'pipeline-123',
        ...pipelineData,
        created_at: new Date().toISOString()
      })
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pipelineData)
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.name).toBe('Pipeline de Teste')
    expect(data.steps).toHaveLength(2)
    expect(data.id).toBe('pipeline-123')
  })

  it('should validate required fields when creating pipeline', async () => {
    // Teste sem name
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Validation error',
        details: [{ path: ['name'], message: 'Required' }]
      })
    })

    const responseWithoutName = await fetch('http://localhost:3000/api/lab-ia/admin/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        steps: [{ order: 1, agent_id: 'agent-1' }]
      })
    })

    expect(responseWithoutName.status).toBe(400)
  })

  it('should list pipelines via GET', async () => {
    const mockPipelines = [
      {
        id: 'pipeline-1',
        name: 'Pipeline 1',
        description: 'Descrição 1',
        steps: [{ order: 1, agent_id: 'agent-1' }],
        active: true,
        draft: false
      },
      {
        id: 'pipeline-2',
        name: 'Pipeline 2',
        description: 'Descrição 2',
        steps: [{ order: 1, agent_id: 'agent-2' }],
        active: true,
        draft: false
      }
    ]

    // Mock da resposta do fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        pipelines: mockPipelines,
        pagination: {
          total: 2,
          page: 1,
          limit: 10,
          pages: 1
        }
      })
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/pipelines')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.pipelines).toHaveLength(2)
    expect(data.pipelines[0].name).toBe('Pipeline 1')
    expect(data.pagination).toBeDefined()
    expect(data.pagination.total).toBe(2)
  })

  it('should support pagination when listing pipelines', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        pipelines: [],
        pagination: {
          total: 20,
          page: 2,
          limit: 10,
          pages: 2
        }
      })
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/pipelines?page=2&limit=10')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.pagination.page).toBe(2)
    expect(data.pagination.limit).toBe(10)
    expect(data.pagination.pages).toBe(2)
  })

  it('should get a pipeline by ID via GET', async () => {
    const mockPipeline = {
      id: 'pipeline-123',
      name: 'Pipeline de Teste',
      description: 'Descrição',
      steps: [
        { order: 1, agent_id: 'agent-1' },
        { order: 2, agent_id: 'agent-2' }
      ],
      active: true,
      draft: false,
      created_at: new Date().toISOString()
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockPipeline
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/pipelines/pipeline-123')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('pipeline-123')
    expect(data.name).toBe('Pipeline de Teste')
    expect(data.steps).toHaveLength(2)
  })

  it('should update a pipeline via PUT', async () => {
    const updatedName = 'Pipeline Atualizado'
    const updatedSteps = [
      { order: 1, agent_id: 'agent-1' },
      { order: 2, agent_id: 'agent-3' } // agent_id mudou
    ]

    // Mock da resposta do fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'pipeline-123',
        name: updatedName,
        steps: updatedSteps,
        updated_at: new Date().toISOString()
      })
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/pipelines/pipeline-123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: updatedName,
        steps: updatedSteps
      })
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.name).toBe(updatedName)
    expect(data.steps[1].agent_id).toBe('agent-3')
  })

  it('should validate data when updating pipeline', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Validation error',
        details: [{ path: ['steps'], message: 'Must have at least one step' }]
      })
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/pipelines/pipeline-123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pipeline Vazio',
        steps: [] // steps vazio deve falhar
      })
    })

    expect(response.status).toBe(400)
  })

  it('should delete a pipeline via DELETE', async () => {
    // Mock da resposta do fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/pipelines/pipeline-123', {
      method: 'DELETE'
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
  })

  it('should return 401 when not authenticated', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'Unauthorized',
        details: 'Token inválido ou ausente'
      })
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pipeline Test',
        steps: [{ order: 1, agent_id: 'agent-1' }]
      })
    })

    expect(response.status).toBe(401)
  })

  it('should return 403 when user is not admin', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'Forbidden',
        details: 'Apenas administradores podem criar pipelines'
      })
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pipeline Test',
        steps: [{ order: 1, agent_id: 'agent-1' }]
      })
    })

    expect(response.status).toBe(403)
  })

  it('should handle draft pipelines correctly', async () => {
    const draftPipeline = {
      id: 'pipeline-draft',
      name: 'Pipeline Rascunho',
      steps: [{ order: 1, agent_id: 'agent-1' }],
      draft: true,
      active: false
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => draftPipeline
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pipeline Rascunho',
        steps: [{ order: 1, agent_id: 'agent-1' }],
        draft: true
      })
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.draft).toBe(true)
  })
})

// Pipeline Execution tests moved to pipelines.execution.test.ts

