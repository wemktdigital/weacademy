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

describe('Quizzes API', () => {
  beforeEach(() => {
    mockSupabase.reset()
  })

  describe('GET /api/quizzes', () => {
    it('should list quizzes successfully', async () => {
      const mockQuizzes = [
        {
          id: 'quiz-1',
          lesson_id: 'lesson-1',
          title: 'Quiz 1',
          description: 'Descrição do quiz 1',
          passing_score: 70,
        },
        {
          id: 'quiz-2',
          lesson_id: 'lesson-1',
          title: 'Quiz 2',
          description: 'Descrição do quiz 2',
          passing_score: 80,
        },
      ]

      // Mock: from('quizzes').select('*') - quizzes API não usa .order()
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockResolvedValueOnce({
        data: mockQuizzes,
        error: null,
      })

      const { GET } = await import('@/app/api/quizzes/route')
      const request = createMockRequest('http://localhost/api/quizzes')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.quizzes).toEqual(mockQuizzes)
    })

    it('should filter quizzes by lesson_id', async () => {
      const lessonId = 'lesson-1'
      const mockQuizzes = [
        {
          id: 'quiz-1',
          lesson_id: lessonId,
          title: 'Quiz 1',
          passing_score: 70,
        },
      ]

      // Mock: from('quizzes').select().eq('lesson_id', lessonId)
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockResolvedValueOnce({
        data: mockQuizzes,
        error: null,
      })

      const { GET } = await import('@/app/api/quizzes/route')
      const request = createMockRequest(`http://localhost/api/quizzes?lesson_id=${lessonId}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.quizzes).toEqual(mockQuizzes)
    })

    it('should filter quizzes by course_id', async () => {
      const courseId = 'course-1'
      const mockModules = [{ id: 'module-1' }]
      const mockLessons = [{ id: 'lesson-1' }]
      const mockQuizzes = [
        {
          id: 'quiz-1',
          lesson_id: 'lesson-1',
          title: 'Quiz 1',
          passing_score: 70,
        },
      ]

      // Ordem das chamadas no código:
      // 1. from('quizzes').select('*') - query inicial (PRIMEIRO from())
      // 2. from('modules').select('id').eq('course_id', courseId) - buscar modules (SEGUNDO from())
      // 3. from('lessons').select('id').in('module_id', [...]) - buscar lessons (TERCEIRO from())
      // 4. query.in('lesson_id', lessonIds) - adiciona filtro ao query inicial
      // 5. await query - executa query inicial final

      // Mock: from('modules').select('id').eq('course_id', courseId) - PRIMEIRA chamada serviceRole
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockResolvedValueOnce({
        data: mockModules,
        error: null,
      })

      // Mock: from('lessons').select('id').in('module_id', [...]) - SEGUNDA chamada serviceRole
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().in.mockResolvedValueOnce({
        data: mockLessons,
        error: null,
      })

      // Mock: query inicial (from('quizzes').select('*')) e query.in('lesson_id', lessonIds)
      // IMPORTANTE: O query inicial é criado primeiro, mas só é executado no final
      // Então a ordem das chamadas from() é: modules, lessons, quizzes
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().in.mockResolvedValueOnce({
        data: mockQuizzes,
        error: null,
      })

      const { GET } = await import('@/app/api/quizzes/route')
      const request = createMockRequest(`http://localhost/api/quizzes?course_id=${courseId}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.quizzes).toEqual(mockQuizzes)
    })

    it('should handle database errors', async () => {
      mockSupabase.serviceRoleClient.from.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      })

      const { GET } = await import('@/app/api/quizzes/route')
      const request = createMockRequest('http://localhost/api/quizzes')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Database error')
    })
  })

  describe('POST /api/quizzes', () => {
    it('should create a quiz successfully (admin)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')
      const mockQuiz = {
        id: 'quiz-1',
        lesson_id: 'lesson-1',
        title: 'Novo Quiz',
        description: 'Descrição do quiz',
        passing_score: 70,
        time_limit_minutes: 30,
      }
      const mockCompleteQuiz = {
        ...mockQuiz,
        questions: [
          {
            id: 'question-1',
            quiz_id: 'quiz-1',
            question_text: 'Pergunta 1?',
            question_type: 'multiple_choice',
            points: 1,
            options: [
              { id: 'option-1', option_text: 'Opção 1', is_correct: true },
              { id: 'option-2', option_text: 'Opção 2', is_correct: false },
            ],
          },
        ],
      }

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')
      
      // Mock inserção do quiz
      mockSupabase.mockInsert('quizzes', {
        data: mockQuiz,
        error: null,
      })

      // Mock inserção da questão
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().insert.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockCompleteQuiz.questions[0],
        error: null,
      })

      // Mock inserção das opções (2 opções)
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().insert.mockResolvedValueOnce({
        data: null,
        error: null,
      })
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().insert.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      // Mock busca do quiz completo
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockCompleteQuiz,
        error: null,
      })

      const { POST } = await import('@/app/api/quizzes/route')
      const request = createMockRequest('http://localhost/api/quizzes', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          lesson_id: 'lesson-1',
          title: 'Novo Quiz',
          description: 'Descrição do quiz',
          passing_score: 70,
          time_limit_minutes: 30,
          questions: [
            {
              question_text: 'Pergunta 1?',
              question_type: 'multiple_choice',
              points: 1,
              options: [
                { option_text: 'Opção 1', is_correct: true },
                { option_text: 'Opção 2', is_correct: false },
              ],
            },
          ],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.quiz.title).toBe('Novo Quiz')
      expect(data.quiz.questions).toHaveLength(1)
    })

    it('should create a quiz successfully (instructor)', async () => {
      const instructorId = '123e4567-e89b-12d3-a456-426614174001'
      const mockUser = createMockUser(instructorId, 'instructor@test.com')
      const mockProfile = createMockProfile('instructor')
      const mockQuiz = {
        id: 'quiz-1',
        lesson_id: 'lesson-1',
        title: 'Novo Quiz',
        passing_score: 70,
      }
      const mockCompleteQuiz = {
        ...mockQuiz,
        questions: [],
      }

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')
      mockSupabase.mockInsert('quizzes', {
        data: mockQuiz,
        error: null,
      })

      // Mock busca do quiz completo (sem questões)
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockCompleteQuiz,
        error: null,
      })

      const { POST } = await import('@/app/api/quizzes/route')
      const request = createMockRequest('http://localhost/api/quizzes', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          lesson_id: 'lesson-1',
          title: 'Novo Quiz',
          questions: [],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.quiz.title).toBe('Novo Quiz')
    })

    it('should return 401 if not authenticated', async () => {
      mockSupabase.mockAuthUser(null)

      const { POST } = await import('@/app/api/quizzes/route')
      const request = createMockRequest('http://localhost/api/quizzes', {
        method: 'POST',
        body: {
          lesson_id: 'lesson-1',
          title: 'Novo Quiz',
          questions: [],
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

      const { POST } = await import('@/app/api/quizzes/route')
      const request = createMockRequest('http://localhost/api/quizzes', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          lesson_id: 'lesson-1',
          title: 'Novo Quiz',
          questions: [],
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

      const { POST } = await import('@/app/api/quizzes/route')
      const request = createMockRequest('http://localhost/api/quizzes', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          // Missing required fields: lesson_id, title, questions
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Campos obrigatórios: lesson_id, title, questions (array)')
    })
  })

  describe('GET /api/quizzes/[id]', () => {
    it('should get a quiz by id successfully', async () => {
      const quizId = 'quiz-1'
      const mockQuiz = {
        id: quizId,
        lesson_id: 'lesson-1',
        title: 'Quiz 1',
        questions: [
          {
            id: 'question-1',
            question_text: 'Pergunta 1?',
            options: [
              { id: 'option-1', option_text: 'Opção 1', is_correct: true },
            ],
          },
        ],
        lesson: {
          id: 'lesson-1',
          title: 'Lição 1',
        },
      }

      mockSupabase.mockSimpleQuery('quizzes', 'single', {
        data: mockQuiz,
        error: null,
      }, 'serviceRole')

      const { GET } = await import('@/app/api/quizzes/[id]/route')
      const request = createMockRequest(`http://localhost/api/quizzes/${quizId}`)

      const response = await GET(request, { params: Promise.resolve({ id: quizId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.quiz).toEqual(mockQuiz)
    })

    it('should return 404 if quiz not found', async () => {
      const quizId = 'non-existent-quiz'

      mockSupabase.mockSimpleQuery('quizzes', 'single', {
        data: null,
        error: { code: 'PGRST116', message: 'Quiz not found' },
      }, 'serviceRole')

      const { GET } = await import('@/app/api/quizzes/[id]/route')
      const request = createMockRequest(`http://localhost/api/quizzes/${quizId}`)

      const response = await GET(request, { params: Promise.resolve({ id: quizId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Quiz not found')
    })
  })

  describe('PUT /api/quizzes/[id]', () => {
    it('should update a quiz successfully (admin)', async () => {
      const quizId = 'quiz-1'
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')
      const mockUpdatedQuiz = {
        id: quizId,
        title: 'Quiz Atualizado',
        description: 'Nova descrição',
        passing_score: 80,
      }

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')
      mockSupabase.mockUpdate('quizzes', {
        data: mockUpdatedQuiz,
        error: null,
      })

      const { PUT } = await import('@/app/api/quizzes/[id]/route')
      const request = createMockRequest(`http://localhost/api/quizzes/${quizId}`, {
        method: 'PUT',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Quiz Atualizado',
          description: 'Nova descrição',
          passing_score: 80,
        },
      })

      const response = await PUT(request, { params: Promise.resolve({ id: quizId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.quiz.title).toBe('Quiz Atualizado')
    })

    it('should return 401 if not authenticated', async () => {
      const quizId = 'quiz-1'
      mockSupabase.mockAuthUser(null)

      const { PUT } = await import('@/app/api/quizzes/[id]/route')
      const request = createMockRequest(`http://localhost/api/quizzes/${quizId}`, {
        method: 'PUT',
        body: {
          title: 'Quiz Atualizado',
        },
      })

      const response = await PUT(request, { params: Promise.resolve({ id: quizId }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return 403 if user is not admin or instructor', async () => {
      const quizId = 'quiz-1'
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'student@test.com')
      const mockProfile = createMockProfile('student')

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: mockProfile,
        error: null,
      }, 'serviceRole')

      const { PUT } = await import('@/app/api/quizzes/[id]/route')
      const request = createMockRequest(`http://localhost/api/quizzes/${quizId}`, {
        method: 'PUT',
        headers: { authorization: 'Bearer token-123' },
        body: {
          title: 'Quiz Atualizado',
        },
      })

      const response = await PUT(request, { params: Promise.resolve({ id: quizId }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Sem permissão')
    })
  })

  describe('POST /api/quizzes/[id]/submit', () => {
    it('should submit a quiz successfully', async () => {
      const quizId = 'quiz-1'
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'student@test.com')
      const mockQuiz = {
        id: quizId,
        passing_score: 70,
        questions: [
          {
            id: 'question-1',
            question_type: 'multiple_choice',
            points: 1,
            options: [
              { id: 'option-1', is_correct: true },
              { id: 'option-2', is_correct: false },
            ],
          },
        ],
      }
      const mockAttempt = {
        id: 'attempt-1',
        user_id: mockUser.id,
        quiz_id: quizId,
        score: 100,
        passed: true,
      }

      mockSupabase.mockAuthUser(mockUser)
      
      // Mock busca do quiz
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockQuiz,
        error: null,
      })

      // Mock inserção da tentativa
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().insert.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockAttempt,
        error: null,
      })

      // Mock RPC call (opcional, pode retornar undefined)
      mockSupabase.serviceRoleClient.rpc = vi.fn().mockResolvedValueOnce({
        data: null,
        error: null,
      })

      const { POST } = await import('@/app/api/quizzes/[id]/submit/route')
      const request = createMockRequest(`http://localhost/api/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          answers: {
            'question-1': 'option-1',
          },
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: quizId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.attempt).toEqual(mockAttempt)
      expect(data.passed).toBe(true)
      expect(data.score).toBe(100)
    })

    it('should return 401 if not authenticated', async () => {
      const quizId = 'quiz-1'
      mockSupabase.mockAuthUser(null)

      const { POST } = await import('@/app/api/quizzes/[id]/submit/route')
      const request = createMockRequest(`http://localhost/api/quizzes/${quizId}/submit`, {
        method: 'POST',
        body: {
          answers: {},
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: quizId }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return 404 if quiz not found', async () => {
      const quizId = 'non-existent-quiz'
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'student@test.com')

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Quiz not found' },
      })

      const { POST } = await import('@/app/api/quizzes/[id]/submit/route')
      const request = createMockRequest(`http://localhost/api/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          answers: {},
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: quizId }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Quiz não encontrado')
    })

    it('should validate that answers are provided', async () => {
      const quizId = 'quiz-1'
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'student@test.com')
      const mockQuiz = {
        id: quizId,
        passing_score: 70,
        questions: [],
      }

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockQuiz,
        error: null,
      })

      const { POST } = await import('@/app/api/quizzes/[id]/submit/route')
      const request = createMockRequest(`http://localhost/api/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          // Missing answers
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: quizId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Respostas não fornecidas')
    })

    it('should calculate score correctly for multiple choice questions', async () => {
      const quizId = 'quiz-1'
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'student@test.com')
      const mockQuiz = {
        id: quizId,
        passing_score: 70,
        questions: [
          {
            id: 'question-1',
            question_type: 'multiple_choice',
            points: 1,
            options: [
              { id: 'option-1', is_correct: true },
              { id: 'option-2', is_correct: false },
            ],
          },
          {
            id: 'question-2',
            question_type: 'multiple_choice',
            points: 1,
            options: [
              { id: 'option-3', is_correct: true },
              { id: 'option-4', is_correct: false },
            ],
          },
        ],
      }
      const mockAttempt = {
        id: 'attempt-1',
        user_id: mockUser.id,
        quiz_id: quizId,
        score: 50, // 1 de 2 corretas = 50%
        passed: false,
      }

      mockSupabase.mockAuthUser(mockUser)
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockQuiz,
        error: null,
      })

      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().insert.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockAttempt,
        error: null,
      })

      mockSupabase.serviceRoleClient.rpc = vi.fn().mockResolvedValueOnce({
        data: null,
        error: null,
      })

      const { POST } = await import('@/app/api/quizzes/[id]/submit/route')
      const request = createMockRequest(`http://localhost/api/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          answers: {
            'question-1': 'option-1', // Correta
            'question-2': 'option-4', // Incorreta
          },
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: quizId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.score).toBe(50)
      expect(data.passed).toBe(false)
      expect(data.totalPoints).toBe(2)
      expect(data.earnedPoints).toBe(1)
    })
  })
})

