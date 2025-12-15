import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockUser } from '../utils/mockSupabase'

// Mock Supabase e dependências
vi.mock('@supabase/supabase-js')
vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual('@/lib/supabase')
  return {
    ...actual,
    supabase: {
      from: vi.fn(),
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

describe('Checkout API', () => {
  beforeEach(() => {
    mockSupabase.reset()
    vi.clearAllMocks()
  })

  describe('POST /api/checkout', () => {
    it('should validate required fields', async () => {
      const { POST } = await import('@/app/api/checkout/route')
      const request = createMockRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: {},
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('courseId e userId são obrigatórios')
    })

    it('should return 404 if course not found', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.from).mockReturnValue(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValue({
        data: null,
        error: { message: 'Not found', status: 404 },
      })

      const { POST } = await import('@/app/api/checkout/route')
      const request = createMockRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: {
          courseId: 'non-existent-course-id',
          userId: 'user-id',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Curso não encontrado')
    })

    it('should return 400 if user already enrolled', async () => {
      const mockCourse = {
        id: 'course-1',
        title: 'Test Course',
        price: 100,
      }

      const { supabase } = await import('@/lib/supabase')
      // Mock course query
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockCourse,
        error: null,
      })
      // Mock enrollment check
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: { id: 'enrollment-1' },
        error: null,
      })

      const { POST } = await import('@/app/api/checkout/route')
      const request = createMockRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: {
          courseId: 'course-1',
          userId: 'user-id',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Você já está inscrito neste curso')
    })

    it('should enroll user directly for free course', async () => {
      const mockCourse = {
        id: 'course-1',
        title: 'Free Course',
        price: 0,
      }

      const mockEnrollment = {
        id: 'enrollment-1',
        user_id: 'user-id',
        course_id: 'course-1',
        status: 'active',
      }

      const { supabase } = await import('@/lib/supabase')
      // Mock course query
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockCourse,
        error: null,
      })
      // Mock enrollment check (not enrolled)
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found', status: 404 },
      })
      // Mock enrollment insert
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().insert.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockEnrollment,
        error: null,
      })

      const { POST } = await import('@/app/api/checkout/route')
      const request = createMockRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: {
          courseId: 'course-1',
          userId: 'user-id',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.enrollment).toEqual(mockEnrollment)
      expect(data.redirect_url).toBeNull()
    })

    it('should return Stripe mock for paid course', async () => {
      const mockCourse = {
        id: 'course-1',
        title: 'Paid Course',
        price: 100,
      }

      // Set STRIPE_SECRET_KEY environment variable
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock'

      const { supabase } = await import('@/lib/supabase')
      // Mock course query
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockCourse,
        error: null,
      })
      // Mock enrollment check (not enrolled)
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found', status: 404 },
      })

      const { POST } = await import('@/app/api/checkout/route')
      const request = createMockRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: {
          courseId: 'course-1',
          userId: 'user-id',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.session_id).toBe('mock_session_id')
      expect(data.redirect_url).toBe('/my-courses')
      expect(data.message).toContain('Stripe')
    })

    it('should return 500 if Stripe not configured for paid course', async () => {
      const mockCourse = {
        id: 'course-1',
        title: 'Paid Course',
        price: 100,
      }

      // Unset STRIPE_SECRET_KEY
      delete process.env.STRIPE_SECRET_KEY

      const { supabase } = await import('@/lib/supabase')
      // Mock course query
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockCourse,
        error: null,
      })
      // Mock enrollment check (not enrolled)
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found', status: 404 },
      })

      const { POST } = await import('@/app/api/checkout/route')
      const request = createMockRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: {
          courseId: 'course-1',
          userId: 'user-id',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Stripe não configurado')
    })

    it('should handle enrollment errors', async () => {
      const mockCourse = {
        id: 'course-1',
        title: 'Free Course',
        price: 0,
      }

      const { supabase } = await import('@/lib/supabase')
      // Mock course query
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockCourse,
        error: null,
      })
      // Mock enrollment check (not enrolled)
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found', status: 404 },
      })
      // Mock enrollment insert (error)
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().insert.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', status: 500 },
      })

      const { POST } = await import('@/app/api/checkout/route')
      const request = createMockRequest('http://localhost/api/checkout', {
        method: 'POST',
        body: {
          courseId: 'course-1',
          userId: 'user-id',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Erro ao inscrever no curso')
    })
  })
})

