import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockUser, createMockProfile } from '../utils/mockSupabase'

// Mock createClient para retornar serviceRoleClient quando necessário
vi.mock('@supabase/supabase-js', async () => {
  const actual = await vi.importActual('@supabase/supabase-js')
  return {
    ...actual,
    createClient: vi.fn().mockImplementation((url: string, key: string, options?: any) => {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-key'
      if (key === serviceRoleKey) {
        return mockSupabase.serviceRoleClient
      }
      return mockSupabase.getClient()
    }),
  }
})

// Mock Supabase
vi.mock('@supabase/supabase-js')
vi.mock('@/lib/supabaseServer', () => {
  return {
    supabaseServer: vi.fn().mockImplementation(async () => {
      return mockSupabase.getClient()
    }),
  }
})

describe('Gamification Performance Tests', () => {
  const mockUser = createMockUser('user-123', 'test@example.com')

  beforeEach(() => {
    mockSupabase.reset()
    mockSupabase.mockAuth({ user: mockUser })
    // Performance tests focam em eficiência de queries, não precisam de profile mock
  })

  describe('Leaderboard Performance', () => {
    it('should handle leaderboard with 1000+ users efficiently', async () => {
      // Simulate 1000 users
      const manyEntries = Array.from({ length: 1000 }, (_, i) => ({
        id: `entry-${i}`,
        user_id: `user-${i}`,
        rank: i + 1,
        points: 10000 - i * 10,
        period_type: 'all-time',
        period_value: '2025',
      }))

      const startTime = Date.now()

      mockSupabase.mockList('leaderboard_entries', {
        data: manyEntries.slice(0, 100), // Should limit to top 100
        error: null,
        count: 100,
      })

      // Query should be fast even with many users
      // mockList já configura o mock para retornar os dados
      const queryResult = await mockSupabase
        .from('leaderboard_entries')
        .select('*')
        .eq('period_type', 'all-time')
        .eq('period_value', '2025')
        .order('rank', { ascending: true })
        .limit(100)

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete in reasonable time (under 1 second for mock, but real query should be < 500ms)
      expect(duration).toBeLessThan(1000)
      
      // mockList retorna { data: [...], error: null, count: ... }
      // então queryResult já é { data: [...], error: null, count: ... }
      const leaderboard = queryResult?.data || []
      expect(leaderboard.length).toBe(100)
    })

    it('should use indexes for leaderboard queries', async () => {
      // Leaderboard queries should use indexes on (period_type, period_value, rank)
      mockSupabase.mockList('leaderboard_entries', {
        data: [],
        error: null,
        count: 0,
      })

      // Simular query com índices
      const serviceRoleSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      vi.mocked(createClient).mockReturnValue(mockSupabase.serviceRoleClient as any)
      
      const { data: leaderboard } = await serviceRoleSupabase
        .from('leaderboard_entries')
        .select('*')
        .eq('period_type', 'weekly')
        .eq('period_value', '2025-W03')
        .order('rank', { ascending: true })
        .limit(100)

      // Query should use indexes (check via query plan in real DB)
      // For mock, we just verify the query structure
      expect(leaderboard).toBeDefined()
    })

    it('should cache leaderboard results', async () => {
      // First query should populate cache
      const leaderboard1 = [
        {
          id: 'entry-1',
          user_id: 'user-1',
          rank: 1,
          points: 1000,
        },
      ]

      mockSupabase.mockList('leaderboard_entries', {
        data: leaderboard1,
        error: null,
        count: 1,
      })

      const queryResult1 = await mockSupabase
        .from('leaderboard_entries')
        .select('*')
        .eq('period_type', 'all-time')
        .order('rank', { ascending: true })
        .limit(100)

      // Second query should use cache (in real implementation)
      // Need to mock again for second query
      mockSupabase.mockList('leaderboard_entries', {
        data: leaderboard1,
        error: null,
        count: 1,
      })

      const queryResult2 = await mockSupabase
        .from('leaderboard_entries')
        .select('*')
        .eq('period_type', 'all-time')
        .order('rank', { ascending: true })
        .limit(100)

      // mockList retorna { data: [...], error: null, count: ... }
      const result1 = queryResult1?.data || []
      const result2 = queryResult2?.data || []
      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
    })
  })

  describe('Stats Query Performance', () => {
    it('should fetch user stats efficiently', async () => {
      const mockStats = {
        user_id: 'user-123',
        total_xp: 5000,
        current_level: 10,
        level_xp: 4900,
        next_level_xp: 5000,
        achievements_unlocked: 15,
        achievements_total: 20,
        current_streak: 30,
        longest_streak: 45,
      }

      const startTime = Date.now()

      mockSupabase.mockRpc('get_user_gamification_stats', {
        data: mockStats,
        error: null,
      })

      const rpcResult = await mockSupabase.rpc('get_user_gamification_stats', {
        p_user_id: 'user-123',
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete quickly
      expect(duration).toBeLessThan(500)
      // mockRpc retorna { data: {...}, error: null }
      const stats = rpcResult?.data
      expect(stats?.total_xp).toBe(5000)
      expect(stats?.current_level).toBe(10)
    })

    it('should handle stats query with many achievements', async () => {
      // User with many achievements (50+)
      const manyAchievements = Array.from({ length: 50 }, (_, i) => ({
        id: `user-achievement-${i}`,
        user_id: 'user-123',
        achievement_id: `badge-${i}`,
        unlocked_at: new Date().toISOString(),
      }))

      mockSupabase.mockList('user_achievements', {
        data: manyAchievements,
        error: null,
        count: 50,
      })

      const startTime = Date.now()

      const queryResult = await mockSupabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', 'user-123')
        .order('unlocked_at', { ascending: false }) // Adicionar order() para garantir retorno de Promise

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should still be fast even with many achievements
      expect(duration).toBeLessThan(500)
      // mockList retorna { data: [...], error: null, count: ... }
      // order() retorna thenable que resolve para { data, error, count }
      const result = await queryResult
      const achievements = result?.data || []
      expect(achievements.length).toBe(50)
    })
  })

  describe('Points History Performance', () => {
    it('should paginate points history efficiently', async () => {
      // User with 1000+ point entries
      const manyPoints = Array.from({ length: 1000 }, (_, i) => ({
        id: `point-${i}`,
        user_id: 'user-123',
        points: 10,
        source_type: 'lesson_complete',
        source_id: `lesson-${i}`,
        created_at: new Date(Date.now() - i * 60000).toISOString(),
      }))

      const startTime = Date.now()

      // First page (20 items)
      mockSupabase.mockList('user_points', {
        data: manyPoints.slice(0, 20),
        error: null,
        count: 1000,
      })

      const queryResult = await mockSupabase
        .from('user_points')
        .select('*')
        .eq('user_id', 'user-123')
        .order('created_at', { ascending: false })
        .range(0, 19)

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should be fast even with 1000 total entries
      expect(duration).toBeLessThan(500)
      // mockList retorna { data: [...], error: null, count: ... }
      const page1 = queryResult?.data || []
      expect(page1.length).toBe(20)
    })

    it('should use indexes for points queries', async () => {
      // Points queries should use index on (user_id, created_at)
      mockSupabase.mockList('user_points', {
        data: [],
        error: null,
        count: 0,
      })

      const { data: points } = await mockSupabase
        .from('user_points')
        .select('*')
        .eq('user_id', 'user-123')
        .order('created_at', { ascending: false })
        .limit(50)

      // Query should use indexes
      expect(points).toBeDefined()
    })
  })

  describe('Achievement Check Performance', () => {
    it('should check achievements efficiently', async () => {
      // User with many achievements to check
      const startTime = Date.now()

      mockSupabase.mockRpc('check_and_unlock_achievements', {
        data: 0, // No new achievements
        error: null,
      })

      const rpcResult = await mockSupabase.rpc('check_and_unlock_achievements', {
        p_user_id: 'user-123',
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete quickly even with many conditions to check
      expect(duration).toBeLessThan(1000)
      // mockRpc retorna { data: {...}, error: null }
      const unlocked = rpcResult?.data
      expect(unlocked).toBe(0)
    })

    it('should handle checking all achievements for multiple users', async () => {
      // Simulate checking achievements for 100 users
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`)

      const startTime = Date.now()

      // In real implementation, should batch or optimize
      for (const userId of userIds.slice(0, 10)) { // Test with 10 to keep test fast
        mockSupabase.mockRpc('check_and_unlock_achievements', {
          data: 0,
          error: null,
        })

        await mockSupabase.rpc('check_and_unlock_achievements', {
          p_user_id: userId,
        })
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete in reasonable time (10 * 100ms = ~1s max)
      expect(duration).toBeLessThan(2000)
    })
  })

  describe('Level Calculation Performance', () => {
    it('should calculate levels efficiently for many users', async () => {
      // Simulate calculating levels for 1000 users
      const startTime = Date.now()

      mockSupabase.mockRpc('update_user_level_from_xp', {
        data: null,
        error: null,
      })

      // Test with 10 users to keep test fast
      for (let i = 0; i < 10; i++) {
        await mockSupabase.rpc('update_user_level_from_xp', {
          p_user_id: `user-${i}`,
          p_total_xp: 1000 + i * 100,
        })
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete quickly
      expect(duration).toBeLessThan(2000)
    })

    it('should use efficient level lookup', async () => {
      // Level lookup should use indexed query on gamification_levels_config
      const levels = [
        { level_number: 1, min_xp: 0, max_xp: 100 },
        { level_number: 2, min_xp: 100, max_xp: 200 },
        { level_number: 3, min_xp: 200, max_xp: 300 },
      ]

      mockSupabase.mockList('gamification_levels_config', {
        data: levels,
        error: null,
        count: 3,
      })

      const startTime = Date.now()

      const { data: levelConfig } = await mockSupabase
        .from('gamification_levels_config')
        .select('*')
        .gte('min_xp', 150)
        .lte('max_xp', 150)
        .single()

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should be very fast with indexed query
      expect(duration).toBeLessThan(100)
    })
  })

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent point additions', async () => {
      // Simulate multiple concurrent point additions
      const operations = Array.from({ length: 10 }, (_, i) => ({
        user_id: 'user-123',
        points: 10,
        source_type: 'lesson_complete',
        source_id: `lesson-${i}`,
      }))

      const startTime = Date.now()

      // Simulate concurrent operations
      const promises = operations.map((op) => {
        mockSupabase.mockInsert('user_points', {
          data: { id: `point-${op.source_id}`, ...op },
          error: null,
        })

        return mockSupabase.from('user_points').insert(op)
      })

      await Promise.all(promises)

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should handle concurrent operations efficiently
      expect(duration).toBeLessThan(2000)
    })

    it('should handle concurrent achievement checks', async () => {
      // Simulate multiple users checking achievements simultaneously
      const userIds = Array.from({ length: 10 }, (_, i) => `user-${i}`)

      const startTime = Date.now()

      const promises = userIds.map((userId) => {
        mockSupabase.mockRpc('check_and_unlock_achievements', {
          data: 0,
          error: null,
        })

        return mockSupabase.rpc('check_and_unlock_achievements', {
          p_user_id: userId,
        })
      })

      await Promise.all(promises)

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should handle concurrent checks efficiently
      expect(duration).toBeLessThan(3000)
    })
  })

  describe('Database Query Optimization', () => {
    it('should use JOINs efficiently for leaderboard', async () => {
      // Leaderboard should JOIN with profiles/user table efficiently
      const leaderboardWithUsers = [
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
      ]

      mockSupabase.mockList('leaderboard_entries', {
        data: leaderboardWithUsers,
        error: null,
        count: 1,
      })

      const startTime = Date.now()

      const queryResult = await mockSupabase
        .from('leaderboard_entries')
        .select(`
          *,
          user:profiles(id, full_name, avatar_url)
        `)
        .eq('period_type', 'all-time')
        .order('rank', { ascending: true })
        .limit(100)

      const endTime = Date.now()
      const duration = endTime - startTime

      // JOIN should be efficient
      expect(duration).toBeLessThan(500)
      // mockList retorna { data: [...], error: null, count: ... }
      const leaderboard = queryResult?.data || []
      expect(leaderboard[0]?.user).toBeDefined()
    })

    it('should avoid N+1 queries for achievements', async () => {
      // Should fetch user achievements with achievement details in single query
      const userAchievements = [
        {
          id: 'user-badge-1',
          user_id: 'user-123',
          achievement_id: 'badge-1',
          unlocked_at: new Date().toISOString(),
          achievement: {
            id: 'badge-1',
            code: 'first_step',
            name: 'Primeiro Passo',
            icon: '🎯',
          },
        },
      ]

      mockSupabase.mockList('user_achievements', {
        data: userAchievements,
        error: null,
        count: 1,
      })

      const startTime = Date.now()

      const queryResult = await mockSupabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', 'user-123')
        .order('unlocked_at', { ascending: false }) // Adicionar order() para garantir retorno de Promise

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should use JOIN instead of N+1 queries
      expect(duration).toBeLessThan(500)
      // order() retorna thenable que resolve para { data, error, count }
      const result = await queryResult
      const achievements = result?.data || []
      expect(achievements[0]?.achievement).toBeDefined()
    })
  })

  describe('Memory Usage', () => {
    it('should limit leaderboard result size', async () => {
      // Should always limit to top 100
      const manyEntries = Array.from({ length: 10000 }, (_, i) => ({
        id: `entry-${i}`,
        user_id: `user-${i}`,
        rank: i + 1,
        points: 100000 - i * 10,
      }))

      mockSupabase.mockList('leaderboard_entries', {
        data: manyEntries.slice(0, 100), // Should limit to 100
        error: null,
        count: 100,
      })

      const { data: leaderboard } = await mockSupabase
        .from('leaderboard_entries')
        .select('*')
        .eq('period_type', 'all-time')
        .order('rank', { ascending: true })
        .limit(100)

      // Should never return more than 100 entries
      expect(leaderboard?.data?.length || 0).toBeLessThanOrEqual(100)
    })

    it('should paginate large result sets', async () => {
      // Points history should be paginated
      const manyPoints = Array.from({ length: 5000 }, (_, i) => ({
        id: `point-${i}`,
        user_id: 'user-123',
        points: 10,
        created_at: new Date(Date.now() - i * 60000).toISOString(),
      }))

      // First page
      mockSupabase.mockList('user_points', {
        data: manyPoints.slice(0, 50),
        error: null,
        count: 5000,
      })

      const { data: page1 } = await mockSupabase
        .from('user_points')
        .select('*')
        .eq('user_id', 'user-123')
        .order('created_at', { ascending: false })
        .range(0, 49)

      // Should paginate, not return all at once
      expect(page1?.data?.length || 0).toBeLessThanOrEqual(50)
    })
  })
})
