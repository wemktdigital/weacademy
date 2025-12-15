import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockUser } from '../utils/mockSupabase'

// Mock Supabase e dependências
vi.mock('@supabase/supabase-js')
vi.mock('@/lib/supabase')

// Mock NextRequest
const createMockRequest = (url: string, options?: { method?: string; headers?: Record<string, string> }) => {
  return {
    url,
    method: options?.method || 'GET',
    headers: new Headers(options?.headers || {}),
  } as unknown as Request
}

describe('Lab IA Certificates API', () => {
  beforeEach(() => {
    mockSupabase.reset()
    vi.clearAllMocks()
  })

  describe('GET /api/lab-ia/certificates/generate', () => {
    it('should return 401 if not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase')
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated', status: 401 },
          }),
        },
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)

      const request = createMockRequest('http://localhost/api/lab-ia/certificates/generate', {
        method: 'GET',
      })

      const { GET } = await import('@/app/api/lab-ia/certificates/generate/route')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return certificate eligibility if user already has certificate', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockCertificate = {
        id: 'cert-1',
        issued_at: '2024-01-15T00:00:00Z',
      }

      const { createClient } = await import('@/lib/supabase')
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockSupabase.getQueryBuilder() as any),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)

      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValue({
        data: mockCertificate,
        error: null,
      })

      const request = createMockRequest('http://localhost/api/lab-ia/certificates/generate', {
        method: 'GET',
      })

      const { GET } = await import('@/app/api/lab-ia/certificates/generate/route')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.hasCertificate).toBe(true)
      expect(data.certificateId).toBe(mockCertificate.id)
      expect(data.issuedAt).toBe(mockCertificate.issued_at)
    })

    it('should return progress if user does not have certificate', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')

      const { createClient } = await import('@/lib/supabase')
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockSupabase.getQueryBuilder() as any),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)

      // Mock certificate check (not found)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found', status: 404 },
      })
      // Mock agent count - select with count returns count directly
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce({
        count: 5,
        data: null,
        error: null,
      })
      // Mock message count - select with count (GET não usa eq)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce({
        count: 30,
        data: null,
        error: null,
      })

      const request = createMockRequest('http://localhost/api/lab-ia/certificates/generate', {
        method: 'GET',
      })

      const { GET } = await import('@/app/api/lab-ia/certificates/generate/route')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.hasCertificate).toBe(false)
      expect(data.progress).toBeDefined()
      expect(data.progress.agentExecutions).toBe(5)
      expect(data.progress.messages).toBe(30)
      expect(data.progress.eligible).toBe(false) // 5 < 10 (MIN_AGENT_EXECUTIONS) or 30 < 50 (MIN_MESSAGES)
    })

    it('should return eligible true if user meets criteria', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')

      const { createClient } = await import('@/lib/supabase')
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockSupabase.getQueryBuilder() as any),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)

      // Mock certificate check (not found)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found', status: 404 },
      })
      // Mock agent count (>= 10) - select with count then eq
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce({
        count: 15,
        data: null,
        error: null,
      })
      // Mock message count (>= 50) - GET não usa eq
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce({
        count: 60,
        data: null,
        error: null,
      })

      const request = createMockRequest('http://localhost/api/lab-ia/certificates/generate', {
        method: 'GET',
      })

      const { GET } = await import('@/app/api/lab-ia/certificates/generate/route')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.hasCertificate).toBe(false)
      expect(data.progress.eligible).toBe(true) // 15 >= 10 and 60 >= 50
    })
  })

  describe('POST /api/lab-ia/certificates/generate', () => {
    it('should return 401 if not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase')
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated', status: 401 },
          }),
        },
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)

      const request = createMockRequest('http://localhost/api/lab-ia/certificates/generate', {
        method: 'POST',
      })

      const { POST } = await import('@/app/api/lab-ia/certificates/generate/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 400 if user already has certificate', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockCertificate = {
        id: 'cert-1',
      }

      const { createClient } = await import('@/lib/supabase')
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockSupabase.getQueryBuilder() as any),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)

      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockCertificate,
        error: null,
      })

      const request = createMockRequest('http://localhost/api/lab-ia/certificates/generate', {
        method: 'POST',
      })

      const { POST } = await import('@/app/api/lab-ia/certificates/generate/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('User already has a certificate')
      expect(data.certificateId).toBe(mockCertificate.id)
    })

    it('should return 400 if criteria not met', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')

      const { createClient } = await import('@/lib/supabase')
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockSupabase.getQueryBuilder() as any),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)

      // Mock certificate check (not found)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found', status: 404 },
      })
      // Mock agent count (< 10) - select with count returns count directly
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce({
        count: 5,
        data: null,
        error: null,
      })
      // Mock message count (< 50) - select with count then eq
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce({
        count: 30,
        data: null,
        error: null,
      })

      const request = createMockRequest('http://localhost/api/lab-ia/certificates/generate', {
        method: 'POST',
      })

      const { POST } = await import('@/app/api/lab-ia/certificates/generate/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Criteria not met')
      expect(data.required.agentExecutions).toBe(10)
      expect(data.required.messages).toBe(50)
      expect(data.current.agentExecutions).toBe(5)
      expect(data.current.messages).toBe(30)
    })

    it('should generate certificate successfully', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = {
        email: 'user@test.com',
        full_name: 'Test User',
      }
      const mockCertificate = {
        id: 'cert-1',
        user_id: mockUser.id,
        title: 'Certificado de Conclusão - Laboratório de IA',
        issued_at: '2024-01-15T00:00:00Z',
      }

      const { createClient } = await import('@/lib/supabase')
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockSupabase.getQueryBuilder() as any),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)

      // Mock certificate check (not found)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found', status: 404 },
      })
      // Mock agent count (>= 10) - select with count then eq
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce({
        count: 15,
        data: null,
        error: null,
      })
      // Mock message count (>= 50) - POST usa eq
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce({
        count: 60,
        data: null,
        error: null,
      })
      // Mock profile query
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })
      // Mock certificate insert
      mockSupabase.getQueryBuilder().insert.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockCertificate,
        error: null,
      })

      const request = createMockRequest('http://localhost/api/lab-ia/certificates/generate', {
        method: 'POST',
      })

      const { POST } = await import('@/app/api/lab-ia/certificates/generate/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.certificate.id).toBe(mockCertificate.id)
      expect(data.certificate.title).toBe(mockCertificate.title)
      expect(data.message).toBe('Certificate generated successfully')
    })

    it('should handle errors from certificate creation', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = {
        email: 'user@test.com',
        full_name: 'Test User',
      }

      const { createClient } = await import('@/lib/supabase')
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockSupabase.getQueryBuilder() as any),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)

      // Mock certificate check (not found)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found', status: 404 },
      })
      // Mock agent count (>= 10) - select with count returns count directly
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce({
        count: 15,
        data: null,
        error: null,
      })
      // Mock message count (>= 50) - select with count (sem eq)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce({
        count: 60,
        data: null,
        error: null,
      })
      // Mock profile query
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })
      // Mock certificate insert (error)
      mockSupabase.getQueryBuilder().insert.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', status: 500 },
      })

      const request = createMockRequest('http://localhost/api/lab-ia/certificates/generate', {
        method: 'POST',
      })

      const { POST } = await import('@/app/api/lab-ia/certificates/generate/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})

