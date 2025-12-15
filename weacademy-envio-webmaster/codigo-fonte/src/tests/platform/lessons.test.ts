import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockProfile, createMockUser } from '../utils/mockSupabase'

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

describe('Lessons API', () => {
  beforeEach(() => {
    mockSupabase.reset()
  })

  describe('GET /api/lessons', () => {
    it('should list lessons successfully', async () => {
      const mockLessons = [
        {
          id: 'lesson-1',
          module_id: 'module-1',
          title: 'Lição 1',
          description: 'Descrição da lição 1',
          type: 'video',
          order_index: 0,
        },
        {
          id: 'lesson-2',
          module_id: 'module-1',
          title: 'Lição 2',
          description: 'Descrição da lição 2',
          type: 'text',
          order_index: 1,
        },
      ]

      mockSupabase.mockList('lessons', {
        data: mockLessons,
        error: null,
      })

      const { GET } = await import('@/app/api/lessons/route')
      const request = createMockRequest('http://localhost/api/lessons')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.lessons).toEqual(mockLessons)
    })

    it('should filter lessons by module_id', async () => {
      const moduleId = 'module-1'
      const mockLessons = [
        {
          id: 'lesson-1',
          module_id: moduleId,
          title: 'Lição 1',
          type: 'video',
          order_index: 0,
        },
      ]

      // Mock: from('lessons').select().order().eq('module_id', moduleId)
      // select() e order() retornam queryBuilder, eq() retorna resultado final
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().order.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockResolvedValueOnce({
        data: mockLessons,
        error: null,
      })

      const { GET } = await import('@/app/api/lessons/route')
      const request = createMockRequest(`http://localhost/api/lessons?module_id=${moduleId}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.lessons).toEqual(mockLessons)
    })

    it('should filter lessons by course_id', async () => {
      const courseId = 'course-1'
      const mockModules = [
        { id: 'module-1' },
        { id: 'module-2' },
      ]
      const mockLessons = [
        {
          id: 'lesson-1',
          module_id: 'module-1',
          title: 'Lição 1',
          type: 'video',
          order_index: 0,
        },
      ]

      // Mock: from('modules').select('id').eq('course_id', courseId)
      // Primeira chamada: buscar modules
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockResolvedValueOnce({
        data: mockModules,
        error: null,
      })

      // Mock: from('lessons').select().order().in('module_id', [...])
      // Segunda chamada: buscar lessons
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().order.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().in.mockResolvedValueOnce({
        data: mockLessons,
        error: null,
      })

      const { GET } = await import('@/app/api/lessons/route')
      const request = createMockRequest(`http://localhost/api/lessons?course_id=${courseId}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.lessons).toEqual(mockLessons)
    })

    it('should handle database errors', async () => {
      mockSupabase.serviceRoleClient.from.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      })

      const { GET } = await import('@/app/api/lessons/route')
      const request = createMockRequest('http://localhost/api/lessons')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Database error')
    })
  })

  describe('POST /api/lessons', () => {
    it('should create a lesson successfully (admin)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')
      const mockLesson = {
        id: 'lesson-1',
        module_id: 'module-1',
        title: 'Nova Lição',
        description: 'Descrição da nova lição',
        type: 'video',
        content: null,
        video_url: null,
        video_provider: null,
        attachments: [],
        duration_minutes: 0,
        is_preview: false,
        is_free: false,
        order_index: 0,
      }

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')
      mockSupabase.mockInsert('lessons', {
        data: mockLesson,
        error: null,
      })

      const { POST } = await import('@/app/api/lessons/route')
      const request = createMockRequest('http://localhost/api/lessons', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          module_id: 'module-1',
          title: 'Nova Lição',
          description: 'Descrição da nova lição',
          type: 'video',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.lesson).toEqual(mockLesson)
    })

    it('should create a lesson successfully (instructor)', async () => {
      const instructorId = '123e4567-e89b-12d3-a456-426614174001'
      const mockUser = createMockUser(instructorId, 'instructor@test.com')
      const mockProfile = createMockProfile('instructor')
      const mockLesson = {
        id: 'lesson-1',
        module_id: 'module-1',
        title: 'Nova Lição',
        type: 'text',
      }

      mockSupabase.mockAuthUser(mockUser)
      
      // Ordem dos mocks deve seguir a ordem das chamadas no código
      // 1. serviceRoleClient.from('profiles').select('role').eq('id', ...).single() - buscar perfil
      // 2. serviceRoleClient.from('lessons').insert(...).select().single() - inserir lição
      
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')
      mockSupabase.mockInsert('lessons', {
        data: mockLesson,
        error: null,
      })

      const { POST } = await import('@/app/api/lessons/route')
      const request = createMockRequest('http://localhost/api/lessons', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          module_id: 'module-1',
          title: 'Nova Lição',
          type: 'text',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.lesson).toEqual(mockLesson)
    })

    it('should return 401 if not authenticated', async () => {
      mockSupabase.mockAuthUser(null)

      const { POST } = await import('@/app/api/lessons/route')
      const request = createMockRequest('http://localhost/api/lessons', {
        method: 'POST',
        body: {
          module_id: 'module-1',
          title: 'Nova Lição',
          type: 'video',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return 403 if user is not admin or instructor', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'student@test.com')
      const mockProfile = createMockProfile('student')

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')

      const { POST } = await import('@/app/api/lessons/route')
      const request = createMockRequest('http://localhost/api/lessons', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          module_id: 'module-1',
          title: 'Nova Lição',
          type: 'video',
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

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')

      const { POST } = await import('@/app/api/lessons/route')
      const request = createMockRequest('http://localhost/api/lessons', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          // Missing required fields: module_id, title, type
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Campos obrigatórios: module_id, title, type')
    })
  })

  describe('GET /api/lessons/[id]', () => {
    it('should get a lesson by id successfully', async () => {
      const lessonId = 'lesson-1'
      const mockLesson = {
        id: lessonId,
        module_id: 'module-1',
        title: 'Lição 1',
        type: 'video',
        module: {
          id: 'module-1',
          course: {
            id: 'course-1',
            title: 'Curso 1',
          },
        },
      }

      mockSupabase.mockSimpleQuery('lessons', 'single', {
        data: mockLesson,
        error: null,
      }, 'serviceRole')

      const { GET } = await import('@/app/api/lessons/[id]/route')
      const request = createMockRequest(`http://localhost/api/lessons/${lessonId}`)

      const response = await GET(request, { params: Promise.resolve({ id: lessonId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.lesson).toEqual(mockLesson)
    })

    it('should return 404 if lesson not found', async () => {
      const lessonId = 'non-existent-lesson'

      mockSupabase.mockSimpleQuery('lessons', 'single', {
        data: null,
        error: { code: 'PGRST116', message: 'Lesson not found' },
      }, 'serviceRole')

      const { GET } = await import('@/app/api/lessons/[id]/route')
      const request = createMockRequest(`http://localhost/api/lessons/${lessonId}`)

      const response = await GET(request, { params: Promise.resolve({ id: lessonId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Lesson not found')
    })
  })

  describe('PUT /api/lessons/[id]', () => {
    it('should update a lesson successfully (admin)', async () => {
      const lessonId = 'lesson-1'
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')
      const mockExistingLesson = {
        id: lessonId,
        title: 'Lição Original',
        type: 'video',
      }
      const mockUpdatedLesson = {
        ...mockExistingLesson,
        title: 'Lição Atualizada',
        description: 'Nova descrição',
      }

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')
      mockSupabase.mockUpdate('lessons', {
        data: mockUpdatedLesson,
        error: null,
      })

      const { PUT } = await import('@/app/api/lessons/[id]/route')
      const request = createMockRequest(`http://localhost/api/lessons/${lessonId}`, {
        method: 'PUT',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Lição Atualizada',
          description: 'Nova descrição',
        },
      })

      const response = await PUT(request, { params: Promise.resolve({ id: lessonId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.lesson.title).toBe('Lição Atualizada')
    })

    it('should return 401 if not authenticated', async () => {
      const lessonId = 'lesson-1'
      mockSupabase.mockAuthUser(null)

      const { PUT } = await import('@/app/api/lessons/[id]/route')
      const request = createMockRequest(`http://localhost/api/lessons/${lessonId}`, {
        method: 'PUT',
        body: {
          title: 'Lição Atualizada',
        },
      })

      const response = await PUT(request, { params: Promise.resolve({ id: lessonId }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return 403 if user is not admin or instructor', async () => {
      const lessonId = 'lesson-1'
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'student@test.com')
      const mockProfile = createMockProfile('student')

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')

      const { PUT } = await import('@/app/api/lessons/[id]/route')
      const request = createMockRequest(`http://localhost/api/lessons/${lessonId}`, {
        method: 'PUT',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Lição Atualizada',
        },
      })

      const response = await PUT(request, { params: Promise.resolve({ id: lessonId }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Sem permissão')
    })
  })

  describe('DELETE /api/lessons/[id]', () => {
    it('should delete a lesson successfully (admin)', async () => {
      const lessonId = 'lesson-1'
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')
      mockSupabase.mockDelete('lessons', {
        error: null,
      })

      const { DELETE } = await import('@/app/api/lessons/[id]/route')
      const request = createMockRequest(`http://localhost/api/lessons/${lessonId}`, {
        method: 'DELETE',
        headers: { authorization: 'Bearer token-123' },
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: lessonId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Lição deletada com sucesso')
    })

    it('should return 401 if not authenticated', async () => {
      const lessonId = 'lesson-1'
      mockSupabase.mockAuthUser(null)

      const { DELETE } = await import('@/app/api/lessons/[id]/route')
      const request = createMockRequest(`http://localhost/api/lessons/${lessonId}`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: lessonId }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return 403 if user is not admin or instructor', async () => {
      const lessonId = 'lesson-1'
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'student@test.com')
      const mockProfile = createMockProfile('student')

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')

      const { DELETE } = await import('@/app/api/lessons/[id]/route')
      const request = createMockRequest(`http://localhost/api/lessons/${lessonId}`, {
        method: 'DELETE',
        headers: { authorization: 'Bearer token-123' },
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: lessonId }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Sem permissão')
    })
  })
})

