import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockProfile, createMockUser } from '../utils/mockSupabase'

// Mock Supabase
vi.mock('@supabase/supabase-js')
vi.mock('@/lib/supabaseServer')

// Mock supabaseServer - retorna o cliente anon que pode ser usado para auth via cookies
// IMPORTANTE: supabaseServer() é uma função async, então precisa retornar uma Promise
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

describe('Courses API', () => {
  beforeEach(() => {
    mockSupabase.reset()
  })

  describe('GET /api/courses', () => {
    it('should list courses successfully', async () => {
      const mockCourses = [
        {
          id: 'course-1',
          title: 'Curso Teste',
          description: 'Descrição teste',
          status: 'published',
          category: { id: 'cat-1', name: 'Categoria 1' },
          instructor: { id: 'user-1', full_name: 'Instrutor Teste' },
        },
      ]

      mockSupabase.mockList('courses', {
        data: mockCourses,
        error: null,
        count: 1,
      })

      const { GET } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses?page=1&limit=20')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.courses).toHaveLength(1)
      expect(data.courses[0].title).toBe('Curso Teste')
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(20)
      expect(data.pagination.total).toBe(1)
    })

    it('should filter courses by category', async () => {
      const mockCourses = [
        {
          id: 'course-1',
          title: 'Curso Teste',
          category_id: 'cat-1',
        },
      ]

      mockSupabase.mockList('courses', {
        data: mockCourses,
        error: null,
        count: 1,
      })

      const { GET } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses?category=123e4567-e89b-12d3-a456-426614174000')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSupabase.getQueryBuilder().eq).toHaveBeenCalledWith('category_id', '123e4567-e89b-12d3-a456-426614174000')
      expect(data.courses).toHaveLength(1)
    })

    it('should filter courses by instructor', async () => {
      const mockCourses = [
        {
          id: 'course-1',
          title: 'Curso Teste',
          instructor_id: '123e4567-e89b-12d3-a456-426614174000',
        },
      ]

      mockSupabase.mockList('courses', {
        data: mockCourses,
        error: null,
        count: 1,
      })

      const { GET } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses?instructor=123e4567-e89b-12d3-a456-426614174001')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSupabase.getQueryBuilder().eq).toHaveBeenCalledWith('instructor_id', '123e4567-e89b-12d3-a456-426614174001')
      expect(data.courses).toHaveLength(1)
    })

    it('should filter courses by status', async () => {
      const mockCourses = [
        {
          id: 'course-1',
          title: 'Curso Teste',
          status: 'published',
        },
      ]

      mockSupabase.mockList('courses', {
        data: mockCourses,
        error: null,
        count: 1,
      })

      const { GET } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses?status=published')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSupabase.getQueryBuilder().eq).toHaveBeenCalledWith('status', 'published')
      expect(data.courses).toHaveLength(1)
    })

    it('should search courses by title or description', async () => {
      const mockCourses = [
        {
          id: 'course-1',
          title: 'Curso Teste',
          description: 'Descrição teste',
        },
      ]

      mockSupabase.mockList('courses', {
        data: mockCourses,
        error: null,
        count: 1,
      })

      const { GET } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses?search=teste')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSupabase.getQueryBuilder().or).toHaveBeenCalledWith('title.ilike.%teste%,description.ilike.%teste%')
      expect(data.courses).toHaveLength(1)
    })

    it('should handle pagination correctly', async () => {
      const mockCourses = Array.from({ length: 20 }, (_, i) => ({
        id: `course-${i + 1}`,
        title: `Curso ${i + 1}`,
      }))

      mockSupabase.mockList('courses', {
        data: mockCourses,
        error: null,
        count: 50,
      })

      const { GET } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses?page=2&limit=20')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSupabase.getQueryBuilder().range).toHaveBeenCalledWith(20, 39)
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.limit).toBe(20)
      expect(data.pagination.total).toBe(50)
    })

    it('should handle database errors', async () => {
      mockSupabase.mockList('courses', {
        data: null,
        error: { message: 'Database error' },
        count: 0,
      })

      const { GET } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Database error')
    })
  })

  describe('POST /api/courses', () => {
    it('should create a course successfully (admin)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')
      const mockCourse = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Novo Curso',
        description: 'Descrição',
        status: 'draft',
        instructor_id: '123e4567-e89b-12d3-a456-426614174000',
      }

      // Mock autenticação - deve ser configurado primeiro
      // O código cria cliente com token e chama auth.getUser(token)
      mockSupabase.mockAuthUser(mockUser)

      // Ordem das chamadas no código:
      // 1. createClient(url, anonKey, { global: { headers: { Authorization } } }) -> authClient
      // 2. createClient(url, serviceRoleKey) -> serviceRoleClient
      // 3. serviceRoleClient.from('courses').select('id').eq('slug', ...).single() - verificar slug
      // 4. serviceRoleClient.from('profiles').select('role').eq('id', ...).single() - buscar perfil
      // 5. serviceRoleClient.from('courses').insert(...).select().single() - inserir curso

      // IMPORTANTE: Ordem dos mocks deve seguir a ordem das chamadas no código
      // O código faz:
      // 1. serviceRoleClient.from('profiles').select('role').eq('id', ...).single() - buscar perfil (PRIMEIRO!)
      // 2. serviceRoleClient.from('courses').select('id').eq('slug', ...).single() - verificar slug (depois da validação)
      // 3. serviceRoleClient.from('courses').insert(...).select().single() - inserir curso

      // Mock buscar perfil (PRIMEIRA chamada serviceRole)
      // IMPORTANTE: Este mock precisa retornar { data: { role: 'admin' }, error: null }
      // O código faz: const { data: profile } = await serviceRoleSupabase.from('profiles').select('role').eq('id', user.id).single()
      // Então precisa retornar data com o objeto completo { role: 'admin' }
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile, // Retorna { role: 'admin' }
        error: null,
      }, 'serviceRole')

      // Mock verificação de slug (segunda chamada serviceRole)
      mockSupabase.mockSimpleQuery('courses', 'single', {
        data: null,
        error: { code: 'PGRST116' }, // PGRST116 = não encontrado
      }, 'serviceRole')

      // Mock inserção de curso (terceira chamada serviceRole)
      mockSupabase.mockInsert('courses', {
        data: mockCourse,
        error: null,
      })

      const { POST } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Novo Curso',
          slug: 'novo-curso',
          description: 'Esta é uma descrição completa do curso com pelo menos 50 caracteres necessários para passar na validação do schema',
          status: 'draft',
          instructor_id: '123e4567-e89b-12d3-a456-426614174000',
          modules: [],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.course.title).toBe('Novo Curso')
    })

    it('should create a course successfully (instructor)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'instructor@test.com')
      const mockProfile = createMockProfile('instructor')
      const mockCourse = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Novo Curso',
        instructor_id: '123e4567-e89b-12d3-a456-426614174000',
      }

      mockSupabase.mockAuthUser(mockUser)
      
      // Ordem: primeiro perfil, depois slug (mesma ordem do código)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')
      mockSupabase.mockSimpleQuery('courses', 'single', {
        data: null,
        error: { code: 'PGRST116' },
      }, 'serviceRole')
      mockSupabase.mockInsert('courses', {
        data: mockCourse,
        error: null,
      })

      const { POST } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Novo Curso',
          slug: 'novo-curso',
          description: 'Esta é uma descrição completa do curso com pelo menos 50 caracteres necessários para passar na validação do schema',
          instructor_id: '123e4567-e89b-12d3-a456-426614174000',
          modules: [],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.course.title).toBe('Novo Curso')
    })

    it('should return 401 if not authenticated', async () => {
      mockSupabase.mockAuthUser(null)

      const { POST } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'POST',
        body: {
          title: 'Novo Curso',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return 403 if user is not admin or instructor', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174003', 'student@test.com')
      const mockProfile = createMockProfile('student')

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      })

      const { POST } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Novo Curso',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Sem permissão')
    })

    it('should validate required fields', async () => {
      // Validação deve falhar antes da autenticação
      // Mock autenticação caso seja chamada
      mockSupabase.mockAuthUser(createMockUser())
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: createMockProfile('admin'),
        error: null,
      })

      const { POST } = await import('@/app/api/courses/route')
      const request = createMockRequest('http://localhost/api/courses', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          // Missing required fields
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })
  })

  describe('GET /api/courses/[id]', () => {
    it('should get a course by id successfully', async () => {
      const mockCourse = {
        id: 'course-1',
        title: 'Curso Teste',
        description: 'Descrição',
        status: 'published',
      }

      mockSupabase.mockSimpleQuery('courses', 'single', {
        data: mockCourse,
        error: null,
      })

      const { GET } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/course-1')

      const response = await GET(request, { params: Promise.resolve({ id: 'course-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.course).toBeDefined()
      expect(data.course.id).toBe('course-1')
      expect(data.course.title).toBe('Curso Teste')
      expect(mockSupabase.getQueryBuilder().eq).toHaveBeenCalledWith('id', 'course-1')
    })

    it('should return 404 if course not found', async () => {
      mockSupabase.mockSimpleQuery('courses', 'single', {
        data: null,
        error: { message: 'Course not found', code: 'PGRST116' },
      })

      const { GET } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/course-999')

      const response = await GET(request, { params: Promise.resolve({ id: 'course-999' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBeDefined()
    })
  })

  describe('PUT /api/courses/[id]', () => {
    it('should update a course successfully (admin)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')
      const mockExistingCourse = { id: '123e4567-e89b-12d3-a456-426614174001', instructor_id: '123e4567-e89b-12d3-a456-426614174000' }
      const mockUpdatedCourse = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Curso Atualizado',
        description: 'Esta é uma nova descrição completa do curso com pelo menos 50 caracteres necessários para passar na validação do schema',
      }

      mockSupabase.mockAuthUser(mockUser)
      // Ordem das chamadas no código PUT:
      // 1. serviceRoleClient.from('profiles').select('role').eq('id', ...).single() - buscar perfil
      // 2. (OPCIONAL, apenas se slug está sendo atualizado) from('courses').select('id').eq('slug', ...).neq('id', ...).maybeSingle() - verificar slug único
      // 3. serviceRoleClient.from('courses').update(...).eq('id', ...).select().single() - atualizar curso
      // IMPORTANTE: O código PUT NÃO verifica se o curso existe antes de atualizar!
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')
      // Não estamos atualizando slug neste teste, então não precisa mockar verificação de slug único (maybeSingle)
      mockSupabase.mockUpdate('courses', {
        data: mockUpdatedCourse,
        error: null,
      })

      const { PUT } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/123e4567-e89b-12d3-a456-426614174001', {
        method: 'PUT',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Curso Atualizado',
          description: 'Esta é uma nova descrição completa do curso com pelo menos 50 caracteres necessários para passar na validação do schema',
        },
      })

      const response = await PUT(request, { params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174001' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      // O código faz: const { data: course } = await serviceRoleSupabase.from('courses').update(...).eq('id', ...).select().single()
      // single() retorna Promise<{ data: mockUpdatedCourse, error: null }>
      // Então course = mockUpdatedCourse
      // E retorna NextResponse.json({ course })
      // Então data = { course: { ...mockUpdatedCourse } }
      expect(data).toBeDefined()
      // Debug: log do que foi retornado se course não estiver definido
      if (!data.course) {
        console.log('DEBUG - data retornado:', JSON.stringify(data, null, 2))
      }
      expect(data.course).toBeDefined()
      expect(data.course?.title).toBe('Curso Atualizado')
    })

    it('should return 401 if not authenticated', async () => {
      mockSupabase.mockAuthUser(null)

      const { PUT } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/course-1', {
        method: 'PUT',
        body: {
          title: 'Curso Atualizado',
        },
      })

      const response = await PUT(request, { params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174001' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return 403 if user is not owner, admin or instructor', async () => {
      const mockUser = createMockUser('user-2', 'student@test.com')
      const mockProfile = createMockProfile('student')

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      })
      mockSupabase.mockSimpleQuery('courses', 'single', {
        data: { id: '123e4567-e89b-12d3-a456-426614174001', instructor_id: '123e4567-e89b-12d3-a456-426614174002' }, // Different instructor
        error: null,
      })

      const { PUT } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/course-1', {
        method: 'PUT',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Curso Atualizado',
        },
      })

      const response = await PUT(request, { params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174001' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Sem permissão')
    })

    it('should return 400 if body is empty', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      })

      const { PUT } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/course-1', {
        method: 'PUT',
        headers: { authorization: 'Bearer token-123' },
        body: {},
      })

      const response = await PUT(request, { params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174001' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Dados não fornecidos')
    })
  })

  describe('DELETE /api/courses/[id]', () => {
    it('should delete a course successfully (admin)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')
      // DELETE não verifica se curso existe antes de deletar (apenas verifica permissão)
      mockSupabase.mockDelete('courses', {
        error: null,
      })

      const { DELETE } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/123e4567-e89b-12d3-a456-426614174001', {
        method: 'DELETE',
        headers: { authorization: 'Bearer token-123' },
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174001' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 401 if not authenticated', async () => {
      // Mock auth.getUser para retornar null (não autenticado)
      mockSupabase.mockAuthUser(null)

      const { DELETE } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/123e4567-e89b-12d3-a456-426614174001', {
        method: 'DELETE',
        // Sem header authorization
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174001' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return success even if course does not exist (Supabase behavior)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

      mockSupabase.mockAuthUser(mockUser)
      // Ordem das chamadas no código DELETE:
      // 1. serviceRoleClient.from('profiles').select('role').eq('id', ...).single() - buscar perfil
      // 2. serviceRoleClient.from('courses').delete().eq('id', ...) - deletar curso (idempotente)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')
      // DELETE não verifica se curso existe antes de deletar (idempotente)
      // Supabase não retorna erro se registro não existir
      mockSupabase.mockDelete('courses', {
        error: null, // Supabase não retorna erro se registro não existir
      })

      const { DELETE } = await import('@/app/api/courses/[id]/route')
      const request = createMockRequest('http://localhost/api/courses/123e4567-e89b-12d3-a456-426614174999', {
        method: 'DELETE',
        headers: { authorization: 'Bearer token-123' },
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174999' }) })
      const data = await response.json()

      // Supabase não retorna erro se o registro não existir, apenas retorna sucesso
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})
