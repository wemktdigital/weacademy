import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockProfile, createMockUser } from '../utils/mockSupabase'

// Mock Supabase
vi.mock('@supabase/supabase-js', async () => {
  const actual = await vi.importActual('@supabase/supabase-js')
  return {
    ...actual,
    createClient: vi.fn().mockImplementation((url: string, key: string, options?: any) => {
      // Se for service role key, retornar serviceRoleClient
      // A chave pode vir como segundo parâmetro ou dentro de options
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-key'
      if (key === serviceRoleKey || (options && options.global?.headers?.Authorization?.includes(serviceRoleKey))) {
        return mockSupabase.serviceRoleClient
      }
      // Se for anon key ou token header, retornar cliente padrão
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-key'
      if (key === anonKey || (options && options.global?.headers?.Authorization)) {
        return mockSupabase.getClient()
      }
      // Caso contrário, retornar cliente padrão
      return mockSupabase.getClient()
    }),
  }
})
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

describe('Gamification API', () => {
  const mockUser = createMockUser({ id: 'user-123', email: 'test@example.com' })
  const mockAdminUser = createMockUser({ id: 'admin-123', email: 'admin@example.com' })

  beforeEach(() => {
    mockSupabase.reset()
    mockSupabase.mockAuth({ user: mockUser })
    mockSupabase.mockProfile(createMockProfile({ id: mockUser.id, role: 'user' }))
  })

  describe('GET /api/gamification/stats', () => {
    it('should return user gamification stats', async () => {
      const mockStats = {
        user_id: 'user-123',
        total_xp: 500,
        current_level: 3,
        level_xp: 100,
        next_level_xp: 200,
        achievements_unlocked: 5,
        achievements_total: 20,
        current_streak: 7,
        longest_streak: 10,
      }

      mockSupabase.mockRpc('get_user_gamification_stats', {
        data: mockStats,
        error: null,
      })

      const { GET } = await import('@/app/api/gamification/stats/route')
      const request = createMockRequest('http://localhost/api/gamification/stats', {
        headers: {
          authorization: `Bearer token-123`,
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // A API retorna { stats: {...} }, não os dados diretamente
      expect(data.stats).toBeDefined()
      expect(data.stats.total_xp).toBe(500)
      expect(data.stats.current_level).toBe(3)
      expect(data.stats.current_streak).toBe(7)
    })

    it('should return 401 if not authenticated', async () => {
      mockSupabase.mockAuth({ user: null })

      const { GET } = await import('@/app/api/gamification/stats/route')
      const request = createMockRequest('http://localhost/api/gamification/stats')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })

    it('should allow admin to view other user stats', async () => {
      const mockStats = {
        user_id: 'user-456',
        total_xp: 1000,
        current_level: 5,
      }

      mockSupabase.mockAuth({ user: mockAdminUser })
      
      // A API cria serviceRoleSupabase DUAS vezes:
      // 1. Para verificar se é admin (linha 57-66) - query de profiles
      // 2. Para buscar stats do usuário (linha 73-81) - RPC
      // IMPORTANTE: criar dois serviceRoleSupabase diferentes com createClient
      // Usar mockSimpleQuery para configurar o perfil admin no serviceRoleClient
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: { id: mockAdminUser.id, role: 'admin' },
        error: null,
      }, 'serviceRole')
      
      // Mock RPC para obter stats do usuário (segunda instância de serviceRoleSupabase)
      mockSupabase.mockRpc('get_user_gamification_stats', {
        data: mockStats,
        error: null,
      })

      const { GET } = await import('@/app/api/gamification/stats/route')
      const request = createMockRequest('http://localhost/api/gamification/stats?user_id=user-456', {
        headers: {
          authorization: `Bearer admin-token`,
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.stats).toBeDefined()
      expect(data.stats.user_id).toBe('user-456')
    })

    it('should deny non-admin access to other user stats', async () => {
      mockSupabase.mockProfile(createMockProfile({ id: mockUser.id, role: 'user' }))

      const { GET } = await import('@/app/api/gamification/stats/route')
      const request = createMockRequest('http://localhost/api/gamification/stats?user_id=user-456', {
        headers: {
          authorization: `Bearer token-123`,
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Sem permissão')
    })
  })

  describe('GET /api/gamification/points', () => {
    it('should return user point history', async () => {
      const mockPoints = [
        {
          id: 'point-1',
          user_id: 'user-123',
          points: 50,
          source_type: 'quiz_pass',
          source_id: 'quiz-1',
          created_at: '2025-01-20T10:00:00Z',
        },
        {
          id: 'point-2',
          user_id: 'user-123',
          points: 100,
          source_type: 'course_complete',
          source_id: 'course-1',
          created_at: '2025-01-19T10:00:00Z',
        },
      ]

      mockSupabase.mockList('user_points', {
        data: mockPoints,
        error: null,
        count: 2,
      })

      const { GET } = await import('@/app/api/gamification/points/route')
      const request = createMockRequest('http://localhost/api/gamification/points', {
        headers: {
          authorization: `Bearer token-123`,
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.points).toHaveLength(2)
      expect(data.points[0].points).toBe(50)
      expect(data.points[1].points).toBe(100)
    })
  })

  describe('GET /api/gamification/badges', () => {
    it('should return all badges', async () => {
      const mockBadges = [
        {
          id: 'badge-1',
          code: 'first_step',
          name: 'Primeiro Passo',
          description: 'Completar primeira aula',
          icon: '🎯',
          category: 'courses',
          points: 10,
          rarity: 'common',
          active: true,
        },
        {
          id: 'badge-2',
          code: 'streak_7',
          name: 'Sequência 7',
          description: 'Estudar 7 dias seguidos',
          icon: '🔥',
          category: 'streaks',
          points: 50,
          rarity: 'uncommon',
          active: true,
        },
      ]

      mockSupabase.mockList('achievements', {
        data: mockBadges,
        error: null,
        count: 2,
      })

      const { GET } = await import('@/app/api/gamification/badges/route')
      const request = createMockRequest('http://localhost/api/gamification/badges', {
        headers: {
          authorization: `Bearer token-123`,
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.badges).toHaveLength(2)
      expect(data.badges[0].code).toBe('first_step')
    })
  })

  describe('GET /api/gamification/badges/user', () => {
    it('should return user unlocked badges', async () => {
      const mockUserBadges = [
        {
          id: 'user-badge-1',
          user_id: 'user-123',
          achievement_id: 'badge-1',
          unlocked_at: '2025-01-20T10:00:00Z',
          achievement: {
            id: 'badge-1',
            code: 'first_step',
            name: 'Primeiro Passo',
            icon: '🎯',
          },
        },
      ]

      mockSupabase.mockList('user_achievements', {
        data: mockUserBadges,
        error: null,
        count: 1,
      })

      const { GET } = await import('@/app/api/gamification/badges/user/route')
      const request = createMockRequest('http://localhost/api/gamification/badges/user', {
        headers: {
          authorization: `Bearer token-123`,
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.badges).toHaveLength(1)
      // A API retorna badges com achievement já expandido, não dentro de achievement
      expect(data.badges[0].code || data.badges[0].achievement?.code).toBe('first_step')
    })
  })

  describe('GET /api/gamification/leaderboard', () => {
    it('should return weekly leaderboard', async () => {
      const mockLeaderboard = [
        {
          id: 'entry-1',
          user_id: 'user-1',
          rank: 1,
          points: 1000,
          user: {
            id: 'user-1',
            full_name: 'Usuário Top',
            avatar_url: null,
          },
        },
        {
          id: 'entry-2',
          user_id: 'user-2',
          rank: 2,
          points: 800,
          user: {
            id: 'user-2',
            full_name: 'Usuário Segundo',
            avatar_url: null,
          },
        },
      ]

      mockSupabase.mockList('leaderboard_entries', {
        data: mockLeaderboard,
        error: null,
        count: 2,
      })

      const { GET } = await import('@/app/api/gamification/leaderboard/route')
      const request = createMockRequest('http://localhost/api/gamification/leaderboard?period=weekly', {
        headers: {
          authorization: `Bearer token-123`,
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.leaderboard).toHaveLength(2)
      expect(data.leaderboard[0].rank).toBe(1)
      expect(data.period).toBe('weekly')
    })

    it('should return monthly leaderboard', async () => {
      // Mock para quando não há cache (vai chamar refresh_leaderboard e depois buscar)
      // Primeiro: verifica cache (vai retornar vazio)
      mockSupabase.mockList('leaderboard_entries', {
        data: [],
        error: null,
        count: 0,
      })
      
      // Segundo: refresh_leaderboard RPC
      mockSupabase.mockRpc('refresh_leaderboard', {
        data: null,
        error: null,
      })
      
      // Terceiro: busca leaderboard após refresh
      mockSupabase.mockList('leaderboard_entries', {
        data: [],
        error: null,
        count: 0,
      })
      
      // Quarto: busca profiles (pode ser vazio se não há entries)
      mockSupabase.mockList('profiles', {
        data: [],
        error: null,
      })

      const { GET } = await import('@/app/api/gamification/leaderboard/route')
      const request = createMockRequest('http://localhost/api/gamification/leaderboard?period=monthly', {
        headers: {
          authorization: `Bearer token-123`,
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.period).toBe('monthly')
    })

    it('should return all-time leaderboard by default', async () => {
      // Mock para quando não há cache (vai chamar refresh_leaderboard e depois buscar)
      // Primeiro: verifica cache (vai retornar vazio)
      mockSupabase.mockList('leaderboard_entries', {
        data: [],
        error: null,
        count: 0,
      })
      
      // Segundo: refresh_leaderboard RPC
      mockSupabase.mockRpc('refresh_leaderboard', {
        data: null,
        error: null,
      })
      
      // Terceiro: busca leaderboard após refresh
      mockSupabase.mockList('leaderboard_entries', {
        data: [],
        error: null,
        count: 0,
      })
      
      // Quarto: busca profiles (pode ser vazio se não há entries)
      mockSupabase.mockList('profiles', {
        data: [],
        error: null,
      })

      const { GET } = await import('@/app/api/gamification/leaderboard/route')
      const request = createMockRequest('http://localhost/api/gamification/leaderboard', {
        headers: {
          authorization: `Bearer token-123`,
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.period).toBe('all-time')
    })
  })

  describe('POST /api/gamification/check-achievements', () => {
    it('should check and unlock achievements', async () => {
      mockSupabase.mockRpc('check_and_unlock_achievements', {
        data: 2, // 2 achievements unlocked
        error: null,
      })

      const { POST } = await import('@/app/api/gamification/check-achievements/route')
      const request = createMockRequest('http://localhost/api/gamification/check-achievements', {
        method: 'POST',
        headers: {
          authorization: `Bearer token-123`,
        },
        body: {},
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.unlocked_count).toBe(2)
    })

    it('should return 401 if not authenticated', async () => {
      mockSupabase.mockAuth({ user: null })

      const { POST } = await import('@/app/api/gamification/check-achievements/route')
      const request = createMockRequest('http://localhost/api/gamification/check-achievements', {
        method: 'POST',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Não autenticado')
    })
  })

  describe('POST /api/gamification/points', () => {
    it('should allow admin to manually add points', async () => {
      const mockPoint = {
        id: 'point-new',
        user_id: 'user-123',
        points: 100,
        source_type: 'manual',
        source_id: null,
        created_at: '2025-01-20T10:00:00Z',
      }

      mockSupabase.mockAuth({ user: mockAdminUser })
      // Mock query de profile para verificar admin usando mockSimpleQuery
      mockSupabase.mockSimpleQuery('profiles', 'single', {
        data: { id: mockAdminUser.id, role: 'admin' },
        error: null,
      }, 'serviceRole')
      mockSupabase.mockInsert('user_points', {
        data: mockPoint,
        error: null,
      })
      mockSupabase.mockRpc('add_user_points', {
        data: 'point-new',
        error: null,
      })
      mockSupabase.mockRpc('update_user_level_from_xp', {
        data: null,
        error: null,
      })

      const { POST } = await import('@/app/api/gamification/points/route')
      const request = createMockRequest('http://localhost/api/gamification/points', {
        method: 'POST',
        headers: {
          authorization: `Bearer admin-token`,
        },
        body: {
          user_id: 'user-123',
          points: 100,
          source_type: 'manual',
          reason: 'Ajuste manual',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should deny non-admin access to add points', async () => {
      mockSupabase.mockProfile(createMockProfile({ id: mockUser.id, role: 'user' }))

      const { POST } = await import('@/app/api/gamification/points/route')
      const request = createMockRequest('http://localhost/api/gamification/points', {
        method: 'POST',
        headers: {
          authorization: `Bearer token-123`,
        },
        body: {
          user_id: 'user-123',
          points: 100,
          source_type: 'manual',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Sem permissão')
    })
  })
})
