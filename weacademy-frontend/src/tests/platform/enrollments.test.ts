import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockUser, createMockProfile } from '../utils/mockSupabase'

// Mock Supabase e dependências
vi.mock('@supabase/supabase-js')
vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual('@/lib/supabase')
  // Retornar uma referência ao cliente do mockSupabase que será atualizado dinamicamente
  return {
    ...actual,
    get supabase() {
      return mockSupabase.getClient()
    },
  }
})

// Mock NextRequest
const createMockRequest = (url: string, options?: { method?: string; body?: any; headers?: Record<string, string> }) => {
  const headers = new Headers(options?.headers || {})
  if (options?.body) {
    headers.set('content-type', 'application/json')
  }

  return {
    url,
    method: options?.method || 'POST',
    headers,
    json: vi.fn().mockResolvedValue(options?.body || {}),
  } as unknown as NextRequest
}

describe('Enrollments API', () => {
  beforeEach(() => {
    mockSupabase.reset()
    vi.clearAllMocks()
  })

  describe('POST /api/enrollments', () => {
    it('should return 401 if not authenticated', async () => {
      mockSupabase.mockAuthUser(null)

      const { POST } = await import('@/app/api/enrollments/route')
      const request = createMockRequest('http://localhost/api/enrollments', {
        method: 'POST',
        body: {
          course_id: '123e4567-e89b-12d3-a456-426614174001',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should validate required fields', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      mockSupabase.mockAuthUser(mockUser)

      const { POST } = await import('@/app/api/enrollments/route')
      const request = createMockRequest('http://localhost/api/enrollments', {
        method: 'POST',
        body: {},
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('course_id')
    })

    it('should return 400 if user already enrolled', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      mockSupabase.mockAuthUser(mockUser)

      // Mock existing enrollment check
      mockSupabase.mockSimpleQuery('enrollments', 'single', {
        data: { id: '123e4567-e89b-12d3-a456-426614174002' },
        error: null,
      }, 'all')

      const { POST } = await import('@/app/api/enrollments/route')
      const request = createMockRequest('http://localhost/api/enrollments', {
        method: 'POST',
        body: {
          course_id: '123e4567-e89b-12d3-a456-426614174001',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Você já está inscrito neste curso')
    })

    it('should create enrollment successfully', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockEnrollment = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        user_id: mockUser.id,
        course_id: '123e4567-e89b-12d3-a456-426614174001',
        cohort_id: null,
        status: 'active',
        enrolled_at: new Date().toISOString(),
      }

      mockSupabase.mockAuthUser(mockUser)

      // Mock existing enrollment check (not found)
      mockSupabase.mockSimpleQuery('enrollments', 'single', {
        data: null,
        error: { message: 'Not found', status: 404 },
      })
      // Mock enrollment insert
      mockSupabase.mockInsert('enrollments', {
        data: mockEnrollment,
        error: null,
      })

      const { POST } = await import('@/app/api/enrollments/route')
      const request = createMockRequest('http://localhost/api/enrollments', {
        method: 'POST',
        body: {
          course_id: '123e4567-e89b-12d3-a456-426614174001',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.enrollment).toEqual(mockEnrollment)
    })

    it('should create enrollment with cohort_id', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockEnrollment = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        user_id: mockUser.id,
        course_id: '123e4567-e89b-12d3-a456-426614174001',
        cohort_id: '123e4567-e89b-12d3-a456-426614174003',
        status: 'active',
        enrolled_at: new Date().toISOString(),
      }

      mockSupabase.mockAuthUser(mockUser)

      // Mock existing enrollment check (not found)
      mockSupabase.mockSimpleQuery('enrollments', 'single', {
        data: null,
        error: { message: 'Not found', status: 404 },
      })
      // Mock enrollment insert
      mockSupabase.mockInsert('enrollments', {
        data: mockEnrollment,
        error: null,
      })

      const { POST } = await import('@/app/api/enrollments/route')
      const request = createMockRequest('http://localhost/api/enrollments', {
        method: 'POST',
        body: {
          course_id: '123e4567-e89b-12d3-a456-426614174001',
          cohort_id: '123e4567-e89b-12d3-a456-426614174003',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.enrollment.cohort_id).toBe('123e4567-e89b-12d3-a456-426614174003')
    })

    it('should handle database errors', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      mockSupabase.mockAuthUser(mockUser)

      // Mock existing enrollment check (not found)
      mockSupabase.mockSimpleQuery('enrollments', 'single', {
        data: null,
        error: { message: 'Not found', status: 404 },
      }, 'all')
      // Mock enrollment insert (error)
      mockSupabase.mockInsert('enrollments', {
        data: null,
        error: { message: 'Database error', status: 500 },
      })

      const { POST } = await import('@/app/api/enrollments/route')
      const request = createMockRequest('http://localhost/api/enrollments', {
        method: 'POST',
        body: {
          course_id: '123e4567-e89b-12d3-a456-426614174001',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Database error')
    })
  })

  describe('GET /api/enrollments', () => {
    it('should return 401 if not authenticated', async () => {
      mockSupabase.mockAuthUser(null)

      const { GET } = await import('@/app/api/enrollments/route')
      const request = createMockRequest('http://localhost/api/enrollments', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should list enrollments successfully', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockEnrollments = [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          user_id: mockUser.id,
          course_id: '123e4567-e89b-12d3-a456-426614174001',
          status: 'active',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174003',
          user_id: mockUser.id,
          course_id: '123e4567-e89b-12d3-a456-426614174004',
          status: 'completed',
        },
      ]

      mockSupabase.mockAuthUser(mockUser)

      // Mock enrollments query
      mockSupabase.mockList('enrollments', {
        data: mockEnrollments,
        error: null,
      })

      const { GET } = await import('@/app/api/enrollments/route')
      const request = createMockRequest('http://localhost/api/enrollments', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.enrollments).toEqual(mockEnrollments)
    })

    it('should filter enrollments by status', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockEnrollments = [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          user_id: mockUser.id,
          course_id: '123e4567-e89b-12d3-a456-426614174001',
          status: 'active',
        },
      ]

      mockSupabase.mockAuthUser(mockUser)

      // Mock enrollments query with status filter
      mockSupabase.mockList('enrollments', {
        data: mockEnrollments,
        error: null,
      })

      const { GET } = await import('@/app/api/enrollments/route')
      const request = createMockRequest('http://localhost/api/enrollments?status=active', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.enrollments).toEqual(mockEnrollments)
    })

    it('should handle pagination', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockEnrollments = [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          user_id: mockUser.id,
          course_id: '123e4567-e89b-12d3-a456-426614174001',
          status: 'active',
        },
      ]

      mockSupabase.mockAuthUser(mockUser)

      // Mock enrollments query with pagination
      mockSupabase.mockList('enrollments', {
        data: mockEnrollments,
        error: null,
      })

      const { GET } = await import('@/app/api/enrollments/route')
      const request = createMockRequest('http://localhost/api/enrollments?page=2&limit=10', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.enrollments).toEqual(mockEnrollments)
    })

    it('should handle database errors', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      mockSupabase.mockAuthUser(mockUser)

      // Mock enrollments query (error)
      mockSupabase.mockList('enrollments', {
        data: null,
        error: { message: 'Database error', status: 500 },
      })

      const { GET } = await import('@/app/api/enrollments/route')
      const request = createMockRequest('http://localhost/api/enrollments', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Database error')
    })
  })
})

