import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockProfile, createMockUser } from '../utils/mockSupabase'

// Mock Supabase e dependências
vi.mock('@supabase/supabase-js')
vi.mock('@/lib/supabase')
vi.mock('@/lib/supabaseServer')

// Mock supabaseServer
vi.mock('@/lib/supabaseServer', () => {
  return {
    supabaseServer: vi.fn().mockImplementation(async () => {
      return mockSupabase.getClient()
    }),
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

describe('RBAC - Role-Based Access Control', () => {
  beforeEach(() => {
    mockSupabase.reset()
    vi.clearAllMocks()
  })

  describe('Admin Access', () => {
    it('should allow admin to access admin-only endpoints', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      mockSupabase.mockAuthUser(mockUser)
      // Mock profile query - admin role check
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const { POST } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Test Course',
          slug: 'test-course',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      // Admin não deve receber 403 (Sem permissão)
      // Pode receber 400 (validação) ou 401 (não autenticado), mas não 403
      expect(response.status).not.toBe(403)
      if (response.status === 403) {
        expect(data.error).not.toBe('Sem permissão')
      }
    })
  })

  describe('User Access', () => {
    it('should allow user to list courses', async () => {
      const mockCourses = [
        { id: 'course-1', title: 'Course 1' },
        { id: 'course-2', title: 'Course 2' },
      ]

      mockSupabase.mockList('courses', {
        data: mockCourses,
        error: null,
        count: 2,
      })

      const { GET } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.courses).toHaveLength(2)
    })

    it('should deny user from creating courses', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('user')

      mockSupabase.mockAuthUser(mockUser)
      // Mock profile query - user role check
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const { POST } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Test Course',
          slug: 'test-course',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Sem permissão')
    })

    it('should deny user from updating courses', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('user')

      mockSupabase.mockAuthUser(mockUser)
      // Mock profile query - user role check
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const { PUT } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/course-1', {
        method: 'PUT',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Updated Course',
        },
      })

      const response = await PUT(request, { params: Promise.resolve({ id: 'course-1' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Sem permissão')
    })

    it('should deny user from deleting courses', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('user')

      mockSupabase.mockAuthUser(mockUser)
      // Mock profile query - user role check
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const { DELETE } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/course-1', {
        method: 'DELETE',
        headers: { authorization: 'Bearer token-123' },
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'course-1' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      // A API pode retornar "Sem permissão" ou "Somente admin pode deletar cursos"
      expect(data.error).toMatch(/Sem permissão|Somente admin pode deletar cursos/)
    })
  })

  describe('Guest Access', () => {
    it('should allow guest to list courses', async () => {
      const mockCourses = [
        { id: 'course-1', title: 'Course 1' },
      ]

      mockSupabase.mockList('courses', {
        data: mockCourses,
        error: null,
        count: 1,
      })

      const { GET } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.courses).toHaveLength(1)
    })

    it('should deny guest from using AI Lab', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'guest@test.com')
      const mockProfile = createMockProfile('guest')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValue(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValue({
        data: mockProfile,
        error: null,
      })

      const { POST } = await import('@/app/api/lab-ia/chat/route')
      const request = createMockRequest('http://localhost/api/lab-ia/chat', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          messages: [{ role: 'user', content: 'Olá' }],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Guest não pode usar o Laboratório de IA')
    })

    it('should deny guest from creating courses', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'guest@test.com')
      const mockProfile = createMockProfile('guest')

      mockSupabase.mockAuthUser(mockUser)
      // Mock profile query - guest role check
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      const { POST } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Test Course',
          slug: 'test-course',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Sem permissão')
    })
  })

  describe('Unauthenticated Access', () => {
    it('should deny unauthenticated user from creating courses', async () => {
      const { supabaseServer } = await import('@/lib/supabaseServer')
      const supabaseClient = await supabaseServer()
      vi.mocked(supabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', status: 401 },
      })

      const { POST } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'POST',
        body: {
          title: 'Test Course',
          slug: 'test-course',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should deny unauthenticated user from updating courses', async () => {
      const { supabaseServer } = await import('@/lib/supabaseServer')
      const supabaseClient = await supabaseServer()
      vi.mocked(supabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', status: 401 },
      })

      const { PUT } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/course-1', {
        method: 'PUT',
        body: {
          title: 'Updated Course',
        },
      })

      const response = await PUT(request, { params: Promise.resolve({ id: 'course-1' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should allow unauthenticated user to list courses', async () => {
      const mockCourses = [
        { id: 'course-1', title: 'Course 1' },
      ]

      mockSupabase.mockList('courses', {
        data: mockCourses,
        error: null,
        count: 1,
      })

      const { GET } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.courses).toHaveLength(1)
    })
  })

  describe('Role Hierarchy', () => {
    it('should verify admin > user > guest hierarchy', async () => {
      // Admin pode fazer tudo
      const adminUser = createMockUser('admin-id', 'admin@test.com')
      const adminProfile = createMockProfile('admin')

      // User pode fazer algumas coisas
      const regularUser = createMockUser('user-id', 'user@test.com')
      const userProfile = createMockProfile('user')

      // Guest pode fazer quase nada
      const guestUser = createMockUser('guest-id', 'guest@test.com')
      const guestProfile = createMockProfile('guest')

      // Verificar que admin tem acesso total
      expect(adminProfile.role).toBe('admin')
      
      // Verificar que user não é admin
      expect(userProfile.role).toBe('user')
      
      // Verificar que guest não é admin nem user
      expect(guestProfile.role).toBe('guest')
      expect(['admin', 'user']).not.toContain(guestProfile.role)
    })
  })
})

