import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockUser } from '../utils/mockSupabase'

// Mock Supabase
vi.mock('@supabase/supabase-js')
vi.mock('@/lib/supabaseServer')

// Mock supabaseServer
vi.mock('@/lib/supabaseServer', () => {
  return {
    supabaseServer: vi.fn().mockImplementation(async () => {
      return mockSupabase.getClient()
    }),
  }
})

// Mock global fetch
global.fetch = vi.fn()

// Mock NextRequest
const createMockRequest = (url: string, options?: { method?: string; body?: any; headers?: Record<string, string> }) => {
  const headers = new Headers(options?.headers || {})
  if (options?.body) {
    headers.set('content-type', 'application/json')
  }

  return {
    url,
    method: options?.method || 'GET',
    headers,
    json: vi.fn().mockResolvedValue(options?.body || {}),
  } as unknown as NextRequest
}

describe('Video Generation APIs - Lab IA', () => {
  beforeEach(() => {
    mockSupabase.reset()
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-api-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })

  describe('POST /api/lab-ia/videos/poll', () => {
    it('should return 500 if GEMINI_API_KEY is not configured', async () => {
      delete process.env.GEMINI_API_KEY

      const { POST } = await import('@/app/api/lab-ia/videos/poll/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/poll', {
        method: 'POST',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('GEMINI_API_KEY não configurado')
    })

    it('should return 500 if Supabase env vars are not configured', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      const { POST } = await import('@/app/api/lab-ia/videos/poll/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/poll', {
        method: 'POST',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Variáveis de ambiente do Supabase não configuradas')
    })

    it('should return success message if no pending operations', async () => {
      const mockQueryBuilder = mockSupabase.getQueryBuilder()
      // Add limit method if it doesn't exist
      if (!mockQueryBuilder.limit) {
        mockQueryBuilder.limit = vi.fn()
      }
      
      // Mock Supabase client creation
      vi.mocked(createClient).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any)

      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.in.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.order.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.limit.mockResolvedValue({
        data: [],
        error: null,
      })

      const { POST } = await import('@/app/api/lab-ia/videos/poll/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/poll', {
        method: 'POST',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Nenhuma operação pendente')
      expect(data.processed).toBe(0)
    })

    it('should process pending operations and update status', async () => {
      const mockOperation = {
        id: 'op-123',
        user_id: 'user-123',
        conversation_id: 'conv-123',
        message_id: 'msg-123',
        model: 'veo-3.1-generate-preview',
        prompt: 'A beautiful sunset over the ocean',
        operation_name: 'operations/123456789',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const mockStatusResponse = {
        done: true,
        response: {
          generateVideoResponse: {
            generatedSamples: [
              {
                video: {
                  uri: 'https://generativelanguage.googleapis.com/v1beta/videos/123456789',
                },
              },
            ],
          },
        },
      }

      const mockQueryBuilder = mockSupabase.getQueryBuilder()
      // Add limit method if it doesn't exist
      if (!mockQueryBuilder.limit) {
        mockQueryBuilder.limit = vi.fn()
      }
      
      const serviceRoleClient = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      }

      vi.mocked(createClient).mockReturnValue(serviceRoleClient as any)

      // Mock fetch operations
      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.in.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.order.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.limit.mockResolvedValue({
        data: [mockOperation],
        error: null,
      })

      // Mock update to processing
      mockQueryBuilder.update.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      // Mock Google API status check
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockStatusResponse),
      } as any)

      // Mock video download
      const mockVideoBuffer = Buffer.from('fake-video-data')
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockVideoBuffer),
      } as any)

      // Mock final update
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      // Mock message update
      serviceRoleClient.from.mockReturnValueOnce(mockQueryBuilder)
      mockQueryBuilder.update.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      const { POST } = await import('@/app/api/lab-ia/videos/poll/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/poll', {
        method: 'POST',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.processed).toBe(1)
      expect(data.completed).toBe(1)
      expect(data.failed).toBe(0)
    })

    it('should handle operations that are still pending', async () => {
      const mockOperation = {
        id: 'op-123',
        user_id: 'user-123',
        model: 'veo-3.1-generate-preview',
        prompt: 'A beautiful sunset',
        operation_name: 'operations/123456789',
        status: 'pending',
        created_at: new Date().toISOString(),
      }

      const mockStatusResponse = {
        done: false, // Still processing
      }

      const mockQueryBuilder = mockSupabase.getQueryBuilder()
      const serviceRoleClient = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      }
      
      vi.mocked(createClient).mockReturnValue(serviceRoleClient as any)

      // Configure query builder chain
      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.in.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.order.mockReturnValue(mockQueryBuilder)
      // limit() needs to return a promise with data - add it if it doesn't exist
      if (!mockQueryBuilder.limit) {
        mockQueryBuilder.limit = vi.fn()
      }
      mockQueryBuilder.limit.mockResolvedValue({
        data: [mockOperation],
        error: null,
      })

      mockQueryBuilder.update.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder)
      // First eq() for update to processing
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockStatusResponse),
      } as any)

      // Second eq() for update back to pending
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      const { POST } = await import('@/app/api/lab-ia/videos/poll/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/poll', {
        method: 'POST',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.processed).toBe(1)
      expect(data.stillPending).toBe(1)
      expect(data.completed).toBe(0)
    })

    it('should handle failed operations', async () => {
      const mockOperation = {
        id: 'op-123',
        user_id: 'user-123',
        model: 'veo-3.1-generate-preview',
        prompt: 'A beautiful sunset',
        operation_name: 'operations/123456789',
        status: 'pending',
        created_at: new Date().toISOString(),
      }

      const mockQueryBuilder = mockSupabase.getQueryBuilder()
      const serviceRoleClient = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      }
      
      vi.mocked(createClient).mockReturnValue(serviceRoleClient as any)

      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.in.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.order.mockReturnValue(mockQueryBuilder)
      if (!mockQueryBuilder.limit) {
        mockQueryBuilder.limit = vi.fn()
      }
      mockQueryBuilder.limit.mockResolvedValue({
        data: [mockOperation],
        error: null,
      })

      mockQueryBuilder.update.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder)
      // First eq() for update to processing
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      // Mock failed API response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      } as any)

      // Second eq() for update to failed
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      const { POST } = await import('@/app/api/lab-ia/videos/poll/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/poll', {
        method: 'POST',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.processed).toBe(1)
      expect(data.failed).toBe(1)
    })
  })

  describe('GET /api/lab-ia/videos/status/[operationId]', () => {
    it('should return 401 if not authenticated', async () => {
      const { GET } = await import('@/app/api/lab-ia/videos/status/[operationId]/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/status/op-123', {
        method: 'GET',
      })

      const response = await GET(request, { params: { operationId: 'op-123' } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return 404 if operation not found', async () => {
      const mockUser = createMockUser('user-123', 'user@test.com')

      const mockQueryBuilder = mockSupabase.getQueryBuilder()
      const authClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      }

      vi.mocked(createClient).mockReturnValue(authClient as any)

      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found', status: 404 },
      })

      const { GET } = await import('@/app/api/lab-ia/videos/status/[operationId]/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/status/non-existent', {
        method: 'GET',
        headers: { authorization: 'Bearer token-123' },
      })

      const response = await GET(request, { params: { operationId: 'non-existent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Operação não encontrada')
    })

    it('should return 404 if operation belongs to different user', async () => {
      const mockUser = createMockUser('user-123', 'user@test.com')
      const differentUserOperation = {
        id: 'op-123',
        user_id: 'different-user-id', // Different user
        status: 'completed',
      }

      const mockQueryBuilder = mockSupabase.getQueryBuilder()
      const authClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      }

      vi.mocked(createClient).mockReturnValue(authClient as any)

      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.single.mockResolvedValue({
        data: null, // Not found because user_id doesn't match
        error: { message: 'Not found', status: 404 },
      })

      const { GET } = await import('@/app/api/lab-ia/videos/status/[operationId]/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/status/op-123', {
        method: 'GET',
        headers: { authorization: 'Bearer token-123' },
      })

      const response = await GET(request, { params: { operationId: 'op-123' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Operação não encontrada')
    })

    it('should return operation status successfully', async () => {
      const mockUser = createMockUser('user-123', 'user@test.com')
      const mockOperation = {
        id: 'op-123',
        user_id: 'user-123',
        conversation_id: 'conv-123',
        message_id: 'msg-123',
        model: 'veo-3.1-generate-preview',
        prompt: 'A beautiful sunset',
        operation_name: 'operations/123456789',
        status: 'completed',
        video_url: 'https://example.com/video.mp4',
        video_data_url: 'data:video/mp4;base64,abc123',
        error_message: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:05:00Z',
        completed_at: '2025-01-01T00:05:00Z',
      }

      const mockQueryBuilder = mockSupabase.getQueryBuilder()
      const authClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      }

      vi.mocked(createClient).mockReturnValue(authClient as any)

      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.single.mockResolvedValue({
        data: mockOperation,
        error: null,
      })

      const { GET } = await import('@/app/api/lab-ia/videos/status/[operationId]/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/status/op-123', {
        method: 'GET',
        headers: { authorization: 'Bearer token-123' },
      })

      const response = await GET(request, { params: { operationId: 'op-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('op-123')
      expect(data.status).toBe('completed')
      expect(data.model).toBe('veo-3.1-generate-preview')
      expect(data.video_url).toBe('https://example.com/video.mp4')
      expect(data.video_data_url).toBe('data:video/mp4;base64,abc123')
    })

    it('should return operation with pending status', async () => {
      const mockUser = createMockUser('user-123', 'user@test.com')
      const mockOperation = {
        id: 'op-123',
        user_id: 'user-123',
        model: 'veo-3.1-generate-preview',
        prompt: 'A beautiful sunset',
        operation_name: 'operations/123456789',
        status: 'pending',
        video_url: null,
        video_data_url: null,
        error_message: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        completed_at: null,
      }

      const mockQueryBuilder = mockSupabase.getQueryBuilder()
      const authClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      }

      vi.mocked(createClient).mockReturnValue(authClient as any)

      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.single.mockResolvedValue({
        data: mockOperation,
        error: null,
      })

      const { GET } = await import('@/app/api/lab-ia/videos/status/[operationId]/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/status/op-123', {
        method: 'GET',
        headers: { authorization: 'Bearer token-123' },
      })

      const response = await GET(request, { params: { operationId: 'op-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('pending')
      expect(data.video_url).toBeNull()
      expect(data.video_data_url).toBeNull()
    })

    it('should return operation with failed status', async () => {
      const mockUser = createMockUser('user-123', 'user@test.com')
      const mockOperation = {
        id: 'op-123',
        user_id: 'user-123',
        model: 'veo-3.1-generate-preview',
        prompt: 'A beautiful sunset',
        operation_name: 'operations/123456789',
        status: 'failed',
        video_url: null,
        video_data_url: null,
        error_message: 'API returned error 500',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:01:00Z',
        completed_at: '2025-01-01T00:01:00Z',
      }

      const mockQueryBuilder = mockSupabase.getQueryBuilder()
      const authClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      }

      vi.mocked(createClient).mockReturnValue(authClient as any)

      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.single.mockResolvedValue({
        data: mockOperation,
        error: null,
      })

      const { GET } = await import('@/app/api/lab-ia/videos/status/[operationId]/route')
      const request = createMockRequest('http://localhost/api/lab-ia/videos/status/op-123', {
        method: 'GET',
        headers: { authorization: 'Bearer token-123' },
      })

      const response = await GET(request, { params: { operationId: 'op-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('failed')
      expect(data.error_message).toBe('API returned error 500')
    })
  })
})

