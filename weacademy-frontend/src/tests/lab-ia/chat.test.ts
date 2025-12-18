import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockProfile, createMockUser } from '../utils/mockSupabase'

// Mock Supabase e dependências
vi.mock('@supabase/supabase-js')
vi.mock('@/lib/supabase')
vi.mock('@/lib/supabaseServer')
vi.mock('@/modules/laboratorio-ia/services/llmRouter')
vi.mock('@/modules/laboratorio-ia/services/knowledgeBase')
vi.mock('@/modules/laboratorio-ia/services/memory', () => ({
  recallGlobal: vi.fn().mockResolvedValue([]),
  recallProfile: vi.fn().mockResolvedValue({ global: [], agent: [] }),
  getRecentSummaries: vi.fn().mockResolvedValue([]),
  formatMemoriesForContext: vi.fn().mockReturnValue(''),
}))

// Mock supabase do @/lib/supabase
vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual('@/lib/supabase')
  return {
    ...actual,
    supabase: {
      auth: {
        getUser: vi.fn(),
        getSession: vi.fn(),
      },
      from: vi.fn(),
    },
  }
})

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

describe('Chat API - Lab IA', () => {
  beforeEach(() => {
    mockSupabase.reset()
    vi.clearAllMocks()
  })

  describe('POST /api/lab-ia/chat', () => {
    it('should return 401 if not authenticated', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token', status: 401 },
      })
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { POST } = await import('@/app/api/lab-ia/chat/route')
      const request = createMockRequest('http://localhost/api/lab-ia/chat', {
        method: 'POST',
        body: {
          messages: [{ role: 'user', content: 'Olá' }],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should return 403 if user is guest', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'guest@test.com')
      const mockProfile = createMockProfile('guest')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
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
      expect(data.error).toBe('Acesso negado. Guest não pode usar o Laboratório de IA')
    })

    it('should validate messages array', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('student')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
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
          // Missing messages
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Mensagens inválidas')
    })

    it('should validate that messages is an array', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('student')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
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
          messages: 'not an array',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Mensagens inválidas')
    })

    it('should validate that messages array is not empty', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('student')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
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
          messages: [],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Mensagens inválidas')
    })

    it('should call LLM with correct parameters (streaming mode)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('student')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValue(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValue({
        data: mockProfile,
        error: null,
      })

      // Mock callLLM
      const { callLLM } = await import('@/modules/laboratorio-ia/services/llmRouter')
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Olá! Como posso ajudar?'))
          controller.close()
        },
      })

      vi.mocked(callLLM).mockResolvedValue({
        provider: 'OpenAI',
        model: 'gpt-5-nano',
        content: 'Olá! Como posso ajudar?',
        latency: 500,
        cost: 0.001,
        stream: mockStream,
      })

      const { POST } = await import('@/app/api/lab-ia/chat/route')
      const request = createMockRequest('http://localhost/api/lab-ia/chat', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          messages: [{ role: 'user', content: 'Olá' }],
          provider: 'OpenAI',
          model: 'gpt-5-nano',
          stream: true,
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/event-stream')
      expect(callLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'OpenAI',
          model: 'gpt-5-nano',
          stream: true,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'Olá' }),
          ]),
        })
      )
    })

    it('should call LLM with correct parameters (non-streaming mode)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('student')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValue(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValue({
        data: mockProfile,
        error: null,
      })

      // Mock callLLM
      const { callLLM } = await import('@/modules/laboratorio-ia/services/llmRouter')
      vi.mocked(callLLM).mockResolvedValue({
        provider: 'OpenAI',
        model: 'gpt-5-nano',
        content: 'Olá! Como posso ajudar?',
        latency: 500,
        cost: 0.001,
        taskCategory: 'chat',
      })

      const { POST } = await import('@/app/api/lab-ia/chat/route')
      const request = createMockRequest('http://localhost/api/lab-ia/chat', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          messages: [{ role: 'user', content: 'Olá' }],
          provider: 'OpenAI',
          model: 'gpt-5-nano',
          stream: false,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toBe('Olá! Como posso ajudar?')
      expect(data.provider).toBe('OpenAI')
      expect(data.model).toBe('gpt-5-nano')
      expect(data.taskCategory).toBe('chat')
      expect(callLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'OpenAI',
          model: 'gpt-5-nano',
          stream: false,
        })
      )
    })

    it('should inject agent system prompt when agentId is provided', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('student')
      const mockAgent = {
        id: 'agent-1',
        name: 'Agent Test',
        prompt: 'You are a helpful assistant',
        knowledge_base_files: null,
        provider: 'OpenAI',
        model: 'gpt-5-nano',
      }

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })
        .mockResolvedValue({ // Sticky agent for subsequent queries (settings + agent)
          data: mockAgent,
          error: null,
        })

      // Ensure creation of client uses the mocked service role client
      vi.mocked(createClient).mockReturnValue(mockSupabase.getServiceRoleClient())

      // Mock callLLM
      const { callLLM } = await import('@/modules/laboratorio-ia/services/llmRouter')
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Resposta do agente'))
          controller.close()
        },
      })
      vi.mocked(callLLM).mockResolvedValue({
        provider: 'OpenAI',
        model: 'gpt-5-nano',
        content: 'Resposta do agente',
        latency: 500,
        cost: 0.001,
        stream: mockStream,
      })

      const { POST } = await import('@/app/api/lab-ia/chat/route')
      const request = createMockRequest('http://localhost/api/lab-ia/chat', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          messages: [{ role: 'user', content: 'Olá' }],
          agentId: 'agent-1',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(callLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'OpenAI',
          model: 'gpt-5-nano',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system', content: 'You are a helpful assistant' }),
            expect.objectContaining({ role: 'user', content: 'Olá' }),
          ]),
        })
      )
    })

    it('should use agent model when agent has provider and model defined', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('student')
      const mockAgent = {
        id: 'agent-1',
        name: 'Agent Test',
        prompt: 'You are a helpful assistant',
        knowledge_base_files: null,
        provider: 'Google',
        model: 'gemini-2.5-pro',
      }

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      // Mock buscar agente
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockAgent,
        error: null,
      })

      // Ensure creation of client uses the mocked service role client
      vi.mocked(createClient).mockReturnValue(mockSupabase.getServiceRoleClient())

      // Mock callLLM
      const { callLLM } = await import('@/modules/laboratorio-ia/services/llmRouter')
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Resposta do agente'))
          controller.close()
        },
      })
      vi.mocked(callLLM).mockResolvedValue({
        provider: 'Google',
        model: 'gemini-2.5-pro',
        content: 'Resposta do agente',
        latency: 500,
        cost: 0.001,
        stream: mockStream,
      })

      const { POST } = await import('@/app/api/lab-ia/chat/route')
      const request = createMockRequest('http://localhost/api/lab-ia/chat', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          messages: [{ role: 'user', content: 'Olá' }],
          provider: 'OpenAI', // Usuário escolheu OpenAI, mas agente usa Google
          model: 'gpt-5-nano', // Usuário escolheu gpt-5-nano, mas agente usa gemini-2.5-pro
          agentId: 'agent-1',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(callLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'Google', // Deve usar o provider do agente
          model: 'gemini-2.5-pro', // Deve usar o model do agente
        })
      )
    })

    it('should disable intelligent routing when agentId is provided', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('student')
      const mockAgent = {
        id: 'agent-1',
        name: 'Agent Test',
        prompt: 'You are a helpful assistant',
        knowledge_base_files: null,
        provider: null,
        model: null,
      }

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      })

      // Mock buscar agente
      mockSupabase.serviceRoleClient.from.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().select.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValueOnce(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValueOnce({
        data: mockAgent,
        error: null,
      })

      // Mock callLLM
      const { callLLM } = await import('@/modules/laboratorio-ia/services/llmRouter')
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Resposta'))
          controller.close()
        },
      })
      vi.mocked(callLLM).mockResolvedValue({
        provider: 'OpenAI',
        model: 'gpt-5-nano',
        content: 'Resposta',
        latency: 500,
        cost: 0.001,
        stream: mockStream,
      })

      const { POST } = await import('@/app/api/lab-ia/chat/route')
      const request = createMockRequest('http://localhost/api/lab-ia/chat', {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        body: {
          messages: [{ role: 'user', content: 'Olá' }],
          provider: 'OpenAI',
          model: 'gpt-5-nano',
          agentId: 'agent-1',
          enableIntelligentRouting: true, // Tentativa de habilitar routing
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(callLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          enableIntelligentRouting: false, // Deve ser false quando agentId está presente
        })
      )
    })

    it('should handle errors from callLLM', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('student')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValue(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValue({
        data: mockProfile,
        error: null,
      })

      // Mock callLLM para lançar erro
      const { callLLM } = await import('@/modules/laboratorio-ia/services/llmRouter')
      vi.mocked(callLLM).mockRejectedValue(new Error('LLM service error'))

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

      expect(response.status).toBe(500)
      expect(data.error).toBe('LLM service error')
    })

    it('should use session authentication as fallback', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('student')

      const { supabase } = await import('@/lib/supabase')
      // Token authentication fails
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token', status: 401 },
      })
      // Session authentication succeeds
      // O código faz: const { data: { user: sessionUser } } = await supabase.auth.getSession()
      // E então verifica: if (sessionUser?.session)
      // Então data.user deve ser um objeto com propriedade session
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          user: {
            session: {
              access_token: 'session-token',
              user: mockUser,
              expires_at: Date.now() + 3600 * 1000,
            },
            user: mockUser,
          },
        },
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValue(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValue({
        data: mockProfile,
        error: null,
      })

      // Mock callLLM
      const { callLLM } = await import('@/modules/laboratorio-ia/services/llmRouter')
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Resposta'))
          controller.close()
        },
      })
      vi.mocked(callLLM).mockResolvedValue({
        provider: 'OpenAI',
        model: 'gpt-5-nano',
        content: 'Resposta',
        latency: 500,
        cost: 0.001,
        stream: mockStream,
      })

      const { POST } = await import('@/app/api/lab-ia/chat/route')
      const request = createMockRequest('http://localhost/api/lab-ia/chat', {
        method: 'POST',
        headers: { authorization: 'Bearer invalid-token' },
        body: {
          messages: [{ role: 'user', content: 'Olá' }],
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(callLLM).toHaveBeenCalled()
    })
  })

  describe('POST /api/lab-ia/chat/upload', () => {
    it('should return 401 if not authenticated', async () => {
      const { supabaseServer } = await import('@/lib/supabaseServer')
      const supabase = await supabaseServer()
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', status: 401 },
      })

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }))

      const request = {
        headers: new Headers(),
        formData: vi.fn().mockResolvedValue(formData),
      } as unknown as NextRequest

      const { POST } = await import('@/app/api/lab-ia/chat/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should validate that file is provided', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      mockSupabase.mockAuthUser(mockUser)

      const formData = new FormData()
      // No file appended

      const request = {
        headers: new Headers({ authorization: 'Bearer token-123' }),
        formData: vi.fn().mockResolvedValue(formData),
      } as unknown as NextRequest

      const { POST } = await import('@/app/api/lab-ia/chat/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Nenhum arquivo enviado')
    })

    it('should validate file type', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      mockSupabase.mockAuthUser(mockUser)

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.exe', { type: 'application/x-msdownload' }))

      const request = {
        headers: new Headers({ authorization: 'Bearer token-123' }),
        formData: vi.fn().mockResolvedValue(formData),
      } as unknown as NextRequest

      const { POST } = await import('@/app/api/lab-ia/chat/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Tipo de arquivo não permitido')
    })

    it('should validate file size (max 50MB)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      mockSupabase.mockAuthUser(mockUser)

      // Criar arquivo maior que 50MB
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024) // 51 MB
      const formData = new FormData()
      formData.append('file', new File([largeBuffer], 'large.jpg', { type: 'image/jpeg' }))

      const request = {
        headers: new Headers({ authorization: 'Bearer token-123' }),
        formData: vi.fn().mockResolvedValue(formData),
      } as unknown as NextRequest

      const { POST } = await import('@/app/api/lab-ia/chat/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Arquivo muito grande')
    })

    it('should upload file successfully (image)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      mockSupabase.mockAuthUser(mockUser)

      const fileBuffer = Buffer.from('fake image data')
      const mockFile = new File([fileBuffer], 'test.jpg', { type: 'image/jpeg' })
      // Mock arrayBuffer() method
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(fileBuffer.buffer)

      const formData = new FormData()
      formData.append('file', mockFile)

      // Mock Supabase Storage
      const mockUploadResult = {
        path: '1234567890-abc123.jpg',
      }
      const mockPublicUrl = 'https://supabase.co/storage/v1/object/public/lab-chat-images/1234567890-abc123.jpg'

      // Mock createClient for serviceRoleSupabase
      const serviceRoleSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      vi.mocked(createClient).mockReturnValueOnce(serviceRoleSupabase as any)

      mockSupabase.serviceRoleClient.storage = {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({
            data: mockUploadResult,
            error: null,
          }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: mockPublicUrl },
          }),
        }),
        listBuckets: vi.fn().mockResolvedValue({
          data: [{ name: 'lab-chat-images' }],
          error: null,
        }),
        createBucket: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any

      const request = {
        headers: new Headers({ authorization: 'Bearer token-123' }),
        formData: vi.fn().mockResolvedValue(formData),
      } as unknown as NextRequest

      const { POST } = await import('@/app/api/lab-ia/chat/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.url).toBe(mockPublicUrl)
      expect(data.type).toBe('image/jpeg')
    })

    it('should upload file successfully (document)', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      mockSupabase.mockAuthUser(mockUser)

      const fileBuffer = Buffer.from('fake pdf data')
      const mockFile = new File([fileBuffer], 'test.pdf', { type: 'application/pdf' })
      // Mock arrayBuffer() method
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(fileBuffer.buffer)

      const formData = new FormData()
      formData.append('file', mockFile)

      const mockUploadResult = {
        path: '1234567890-abc123.pdf',
      }
      const mockPublicUrl = 'https://supabase.co/storage/v1/object/public/lab-chat-documents/1234567890-abc123.pdf'

      // Mock createClient for serviceRoleSupabase
      const serviceRoleSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      vi.mocked(createClient).mockReturnValueOnce(serviceRoleSupabase as any)

      mockSupabase.serviceRoleClient.storage = {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({
            data: mockUploadResult,
            error: null,
          }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: mockPublicUrl },
          }),
        }),
        listBuckets: vi.fn().mockResolvedValue({
          data: [{ name: 'lab-chat-documents' }],
          error: null,
        }),
        createBucket: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any

      const request = {
        headers: new Headers({ authorization: 'Bearer token-123' }),
        formData: vi.fn().mockResolvedValue(formData),
      } as unknown as NextRequest

      const { POST } = await import('@/app/api/lab-ia/chat/upload/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.url).toBe(mockPublicUrl)
      expect(data.type).toBe('application/pdf')
    })
  })
})

