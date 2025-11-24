import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockUser } from '../utils/mockSupabase'

// Mock Supabase e dependências
vi.mock('@supabase/supabase-js')
vi.mock('@/lib/supabase')
vi.mock('@/lib/supabaseServer', () => {
  return {
    supabaseServer: vi.fn().mockImplementation(async () => {
      return mockSupabase.getClient()
    }),
  }
})
vi.mock('@/modules/laboratorio-ia/services/memory')

// Mock NextRequest
const createMockRequest = (url: string, options?: { method?: string; headers?: Record<string, string> }) => {
  return {
    url,
    method: options?.method || 'GET',
    headers: new Headers(options?.headers || {}),
  } as unknown as Request
}

describe('Memory API Routes', () => {
  beforeEach(() => {
    mockSupabase.reset()
    vi.clearAllMocks()
  })

  describe('GET /api/lab-ia/memory', () => {
    it('should return 401 if not authenticated', async () => {
      // Mock usuário não autenticado
      // A API tenta primeiro com token, depois com cookies
      // Precisamos mockar ambos como null
      mockSupabase.mockAuth({ user: null })
      
      // Mock supabaseServer para retornar cliente sem usuário
      const { supabaseServer } = await import('@/lib/supabaseServer')
      vi.mocked(supabaseServer).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated' },
          }),
        },
      } as any)

      const request = createMockRequest('http://localhost/api/lab-ia/memory', {
        method: 'GET',
        headers: {}, // Sem authorization header
      })

      const { GET } = await import('@/app/api/lab-ia/memory/route')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should list memories successfully', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockMemories = [
        { key: 'preference', value: 'value1', importance: 3, created_at: new Date().toISOString() },
        { key: 'setting', value: 'value2', importance: 2, created_at: new Date().toISOString() },
      ]

      // Mock autenticação
      mockSupabase.mockAuth({ user: mockUser })

      // Mock listMemories service
      const { listMemories } = await import('@/modules/laboratorio-ia/services/memory')
      vi.mocked(listMemories).mockResolvedValue(mockMemories as any)

      const request = createMockRequest('http://localhost/api/lab-ia/memory', {
        method: 'GET',
        headers: {
          authorization: 'Bearer token-123',
        },
      })

      const { GET } = await import('@/app/api/lab-ia/memory/route')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.memories).toEqual(mockMemories)
      expect(listMemories).toHaveBeenCalledWith({
        userId: mockUser.id,
        agentId: null,
      })
    })

    it('should filter memories by agentId', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockMemories = [
        { key: 'preference', value: 'value1', importance: 3, created_at: new Date().toISOString() },
      ]

      // Mock autenticação
      mockSupabase.mockAuth({ user: mockUser })

      // Mock listMemories service
      const { listMemories } = await import('@/modules/laboratorio-ia/services/memory')
      vi.mocked(listMemories).mockResolvedValue(mockMemories as any)

      const request = createMockRequest('http://localhost/api/lab-ia/memory?agentId=agent-123', {
        method: 'GET',
        headers: {
          authorization: 'Bearer token-123',
        },
      })

      const { GET } = await import('@/app/api/lab-ia/memory/route')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.memories).toEqual(mockMemories)
      expect(listMemories).toHaveBeenCalledWith({
        userId: mockUser.id,
        agentId: 'agent-123',
      })
    })

    it('should handle errors from listMemories', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')

      // Mock autenticação
      mockSupabase.mockAuth({ user: mockUser })

      // Mock listMemories service to throw error
      const { listMemories } = await import('@/modules/laboratorio-ia/services/memory')
      vi.mocked(listMemories).mockRejectedValue(new Error('Service error'))

      const request = createMockRequest('http://localhost/api/lab-ia/memory', {
        method: 'GET',
        headers: {
          authorization: 'Bearer token-123',
        },
      })

      const { GET } = await import('@/app/api/lab-ia/memory/route')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('DELETE /api/lab-ia/memory', () => {
    it('should return 401 if not authenticated', async () => {
      // Mock usuário não autenticado
      mockSupabase.mockAuth({ user: null })

      const request = createMockRequest('http://localhost/api/lab-ia/memory', {
        method: 'DELETE',
      })

      const { DELETE } = await import('@/app/api/lab-ia/memory/route')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should clear all memories successfully', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')

      // Mock autenticação
      mockSupabase.mockAuth({ user: mockUser })

      // Mock clearAllMemories service
      const { clearAllMemories } = await import('@/modules/laboratorio-ia/services/memory')
      vi.mocked(clearAllMemories).mockResolvedValue(undefined)

      const request = createMockRequest('http://localhost/api/lab-ia/memory', {
        method: 'DELETE',
        headers: {
          authorization: 'Bearer token-123',
        },
      })

      const { DELETE } = await import('@/app/api/lab-ia/memory/route')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(clearAllMemories).toHaveBeenCalledWith({
        userId: mockUser.id,
        agentId: null,
      })
    })

    it('should filter clear by agentId', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')

      // Mock autenticação
      mockSupabase.mockAuth({ user: mockUser })

      // Mock clearAllMemories service
      const { clearAllMemories } = await import('@/modules/laboratorio-ia/services/memory')
      vi.mocked(clearAllMemories).mockResolvedValue(undefined)

      const request = createMockRequest('http://localhost/api/lab-ia/memory?agentId=agent-123', {
        method: 'DELETE',
        headers: {
          authorization: 'Bearer token-123',
        },
      })

      const { DELETE } = await import('@/app/api/lab-ia/memory/route')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(clearAllMemories).toHaveBeenCalledWith({
        userId: mockUser.id,
        agentId: 'agent-123',
      })
    })

    it('should handle errors from clearAllMemories', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')

      // Mock autenticação
      mockSupabase.mockAuth({ user: mockUser })

      // Mock clearAllMemories service to throw error
      const { clearAllMemories } = await import('@/modules/laboratorio-ia/services/memory')
      vi.mocked(clearAllMemories).mockRejectedValue(new Error('Service error'))

      const request = createMockRequest('http://localhost/api/lab-ia/memory', {
        method: 'DELETE',
        headers: {
          authorization: 'Bearer token-123',
        },
      })

      const { DELETE } = await import('@/app/api/lab-ia/memory/route')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})

