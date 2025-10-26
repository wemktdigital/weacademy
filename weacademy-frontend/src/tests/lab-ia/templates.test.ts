import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase'

describe('Lab IA - Templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a template via POST', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'template-123',
                name: 'Test Template',
                description: 'Test Description',
              },
              error: null,
            }),
          }),
        }),
      })),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', role: 'admin' } },
          error: null,
        }),
      },
    }

    vi.mocked(createClient).mockReturnValue(mockSupabase as any)

    const templateData = {
      name: 'Test Template',
      description: 'Test Description',
      category: 'educational',
      prompt: 'You are a helpful assistant',
    }

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData),
    })

    expect(response.status).toBe(201)
  })

  it('should list templates via GET', async () => {
    const mockTemplates = [
      {
        id: 'template-1',
        name: 'Template 1',
        description: 'Description 1',
        category: 'educational',
      },
      {
        id: 'template-2',
        name: 'Template 2',
        description: 'Description 2',
        category: 'marketing',
      },
    ]

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: mockTemplates,
            error: null,
          }),
        }),
      })),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', role: 'admin' } },
          error: null,
        }),
      },
    }

    vi.mocked(createClient).mockReturnValue(mockSupabase as any)

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/templates')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.templates).toHaveLength(2)
    expect(data.templates[0].name).toBe('Template 1')
  })

  it('should import templates via POST /import', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({
          data: [{ id: 'template-1' }, { id: 'template-2' }],
          error: null,
        }),
      })),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', role: 'admin' } },
          error: null,
        }),
      },
    }

    vi.mocked(createClient).mockReturnValue(mockSupabase as any)

    const templatesData = [
      {
        name: 'Imported Template 1',
        description: 'Description 1',
        prompt: 'Prompt 1',
      },
      {
        name: 'Imported Template 2',
        description: 'Description 2',
        prompt: 'Prompt 2',
      },
    ]

    const response = await fetch(
      'http://localhost:3000/api/lab-ia/admin/templates/import',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: templatesData }),
      }
    )

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.inserted).toBe(2)
  })

  it('should export templates via GET', async () => {
    const mockTemplates = [
      {
        id: 'template-1',
        name: 'Template 1',
        description: 'Description 1',
        prompt: 'Prompt 1',
        category: 'educational',
      },
    ]

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({
          data: mockTemplates,
          error: null,
        }),
      })),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', role: 'admin' } },
          error: null,
        }),
      },
    }

    vi.mocked(createClient).mockReturnValue(mockSupabase as any)

    const response = await fetch(
      'http://localhost:3000/api/lab-ia/admin/templates?action=export'
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data.templates)).toBe(true)
    expect(data.templates[0].name).toBe('Template 1')
  })
})
