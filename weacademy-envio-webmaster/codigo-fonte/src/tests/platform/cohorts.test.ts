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
    method: options?.method || 'GET',
    headers,
    json: vi.fn().mockResolvedValue(options?.body || {}),
  } as unknown as NextRequest
}

describe('Cohorts API', () => {
  beforeEach(() => {
    mockSupabase.reset()
    vi.clearAllMocks()
  })

  describe('GET /api/cohorts', () => {
    it('should list cohorts successfully', async () => {
      const mockCohorts = [
        {
          id: 'cohort-1',
          course_id: 'course-1',
          name: 'Turma 2024.1',
          status: 'open',
        },
        {
          id: 'cohort-2',
          course_id: 'course-1',
          name: 'Turma 2024.2',
          status: 'open',
        },
      ]

      const { supabase } = await import('@/lib/supabase')
      // Mock cohorts query
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().range.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().order.mockResolvedValueOnce({
        data: mockCohorts,
        error: null,
      })

      const { GET } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.cohorts).toEqual(mockCohorts)
    })

    it('should filter cohorts by course_id', async () => {
      const mockCohorts = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          course_id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Turma 2024.1',
          status: 'open',
        },
      ]

      // Mock cohorts query with course_id filter
      mockSupabase.mockList('cohorts', {
        data: mockCohorts,
        error: null,
      })

      const { GET } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts?course_id=123e4567-e89b-12d3-a456-426614174002', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.cohorts).toEqual(mockCohorts)
    })

    it('should filter cohorts by status', async () => {
      const mockCohorts = [
        {
          id: 'cohort-1',
          course_id: 'course-1',
          name: 'Turma 2024.1',
          status: 'open',
        },
      ]

      const { supabase } = await import('@/lib/supabase')
      // Mock cohorts query with status filter
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().range.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().order.mockResolvedValueOnce({
        data: mockCohorts,
        error: null,
      })

      const { GET } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts?status=open', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.cohorts).toEqual(mockCohorts)
    })

    it('should handle pagination', async () => {
      const mockCohorts = [
        {
          id: 'cohort-1',
          course_id: 'course-1',
          name: 'Turma 2024.1',
          status: 'open',
        },
      ]

      const { supabase } = await import('@/lib/supabase')
      // Mock cohorts query with pagination
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().range.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().order.mockResolvedValueOnce({
        data: mockCohorts,
        error: null,
      })

      const { GET } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts?page=2&limit=10', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.cohorts).toEqual(mockCohorts)
    })

    it('should handle database errors', async () => {
      const { supabase } = await import('@/lib/supabase')
      // Mock cohorts query (error)
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().range.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', status: 500 },
      })

      const { GET } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Database error')
    })
  })

  describe('POST /api/cohorts', () => {
    it('should return 401 if not authenticated', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', status: 401 },
      })

      const { POST } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts', {
        method: 'POST',
        body: {
          course_id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Turma 2024.1',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return 403 if user is not admin or instructor', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('user')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      // Mock profile query
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const { POST } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts', {
        method: 'POST',
        body: {
          course_id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Turma 2024.1',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Sem permissão')
    })

    it('should validate required fields', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      // Mock profile query
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const { POST } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts', {
        method: 'POST',
        body: {},
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('course_id')
    })

    it('should validate end_date is after start_date', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      // Mock profile query
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const { POST } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts', {
        method: 'POST',
        body: {
          course_id: 'course-1',
          name: 'Turma 2024.1',
          start_date: '2024-12-31',
          end_date: '2024-01-01', // End date before start date
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('término')
    })

    it('should create cohort successfully (admin)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')
      const mockCohort = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        course_id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Turma 2024.1',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        status: 'open',
        capacity: 50,
      }

      mockSupabase.mockAuthUser(mockUser)

      // Mock profile query
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'all')
      // Mock cohort insert
      mockSupabase.mockInsert('cohorts', {
        data: mockCohort,
        error: null,
      })

      const { POST } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts', {
        method: 'POST',
        body: {
          course_id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Turma 2024.1',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          capacity: 50,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.cohort).toEqual(mockCohort)
    })

    it('should allow instructor to create cohort', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'instructor@test.com')
      const mockProfile = createMockProfile('instructor')
      const mockCohort = {
        id: 'cohort-1',
        course_id: 'course-1',
        name: 'Turma 2024.1',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        status: 'open',
      }

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      // Mock profile query
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })
      // Mock cohort insert
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().insert.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockCohort,
        error: null,
      })

      const { POST } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts', {
        method: 'POST',
        body: {
          course_id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Turma 2024.1',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        },
      })

      const response = await POST(request)

      // Should not return 403
      expect(response.status).not.toBe(403)
    })

    it('should handle database errors', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      // Mock profile query
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })
      // Mock cohort insert (error)
      vi.mocked(supabase.from).mockReturnValueOnce(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().insert.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', status: 500 },
      })

      const { POST } = await import('@/app/api/cohorts/route')
      const request = createMockRequest('http://localhost/api/cohorts', {
        method: 'POST',
        body: {
          course_id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Turma 2024.1',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Database error')
    })
  })
})

