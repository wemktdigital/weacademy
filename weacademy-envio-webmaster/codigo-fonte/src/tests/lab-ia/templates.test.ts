import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase'

describe('Lab IA - Templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('should create a template via POST', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        template: { id: 'template-123', name: 'Test Template' },
      }),
    })

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
      { id: 'template-1', name: 'Template 1', description: 'Description 1', category: 'educational' },
      { id: 'template-2', name: 'Template 2', description: 'Description 2', category: 'marketing' },
    ]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ templates: mockTemplates, total: 2 }),
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/templates')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.templates).toHaveLength(2)
    expect(data.templates[0].name).toBe('Template 1')
  })

  it('should import templates via POST /import', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ inserted: 2 }),
    })

    const templatesData = [
      { name: 'Imported Template 1', description: 'Description 1', prompt: 'Prompt 1' },
      { name: 'Imported Template 2', description: 'Description 2', prompt: 'Prompt 2' },
    ]

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/templates/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates: templatesData }),
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.inserted).toBe(2)
  })

  it('should export templates via GET', async () => {
    const mockTemplates = [
      { id: 'template-1', name: 'Template 1', description: 'Description 1', prompt: 'Prompt 1', category: 'educational' },
    ]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ templates: mockTemplates }),
    })

    const response = await fetch('http://localhost:3000/api/lab-ia/admin/templates?action=export')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data.templates)).toBe(true)
    expect(data.templates[0].name).toBe('Template 1')
  })
})
