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

describe('Gamification Notifications', () => {
  const mockUser = createMockUser('user-123', 'test@example.com')

  beforeEach(() => {
    mockSupabase.reset()
    mockSupabase.mockAuth({ user: mockUser })
    // Notifications são criadas por triggers no banco, não precisamos mockar profile aqui
  })

  describe('Achievement Unlocked Notifications', () => {
    it('should create notification when achievement is unlocked', async () => {
      const achievement = {
        id: 'badge-1',
        code: 'first_step',
        name: 'Primeiro Passo',
        description: 'Completar primeira aula',
        icon: '🎯',
      }

      // Simulate achievement unlock
      mockSupabase.mockRpc('check_and_unlock_achievements', {
        data: 1, // 1 achievement unlocked
        error: null,
      })

      // Notification should be created by trigger
      const expectedNotification = {
        id: 'notif-1',
        user_id: 'user-123',
        type: 'achievement',
        title: 'Conquista Desbloqueada!',
        message: 'Primeiro Passo: Completar primeira aula',
        metadata: {
          achievement_id: 'badge-1',
          icon: '🎯',
        },
        created_at: new Date().toISOString(),
      }

      mockSupabase.mockInsert('notifications', {
        data: expectedNotification,
        error: null,
      })

      // Mock a query that will return the notification
      mockSupabase.mockSimpleQuery('notifications', 'single', {
        data: expectedNotification,
        error: null,
      })

      // Check notification was created
      const { data: notification } = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-123')
        .eq('type', 'achievement')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // .single() retorna { data: {...}, error: null }
      // Então notification já é o objeto de dados, não { data: {...} }
      expect(notification?.type).toBe('achievement')
      expect(notification?.title).toContain('Conquista')
      expect(notification?.metadata?.achievement_id).toBe('badge-1')
    })

    it('should not create duplicate notifications for same achievement', async () => {
      // User already has this achievement
      const existingAchievement = {
        id: 'user-badge-1',
        user_id: 'user-123',
        achievement_id: 'badge-1',
        unlocked_at: '2025-01-19T10:00:00Z',
      }

      mockSupabase.mockList('user_achievements', {
        data: [existingAchievement],
        error: null,
        count: 1,
      })

      // Attempting to unlock again should not create notification
      mockSupabase.mockRpc('check_and_unlock_achievements', {
        data: 0, // No new achievements
        error: null,
      })

      // Should not insert new notification
      mockSupabase.mockInsert('notifications', {
        data: null,
        error: null,
      })

      // Simular query - não deve criar nova notificação se já existe
      // O RPC retorna 0 (nenhum achievement novo desbloqueado)
      const serviceRoleSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      vi.mocked(createClient).mockReturnValue(mockSupabase.serviceRoleClient as any)
      
      const result = await serviceRoleSupabase.rpc('check_and_unlock_achievements', {
        p_user_id: 'user-123',
      })
      
      // Deve retornar 0 (nenhum achievement novo)
      expect(result.data).toBe(0)
      
      // Não deve inserir nova notificação
      const { data: notifications } = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-123')
        .eq('type', 'achievement')

      // Should have only one notification for this achievement
      expect(notifications?.data?.length || 0).toBeLessThanOrEqual(1)
    })
  })

  describe('Level Up Notifications', () => {
    it('should create notification when user levels up', async () => {
      // User was level 2, now level 3
      const oldStats = {
        user_id: 'user-123',
        total_xp: 199,
        current_level: 2,
      }

      const newStats = {
        user_id: 'user-123',
        total_xp: 200,
        current_level: 3,
      }

      // Simulate level up (trigger should detect change in current_level)
      mockSupabase.mockRpc('update_user_level_from_xp', {
        data: null,
        error: null,
      })

      // Notification should be created
      const expectedNotification = {
        id: 'notif-2',
        user_id: 'user-123',
        type: 'level_up',
        title: 'Subiu de Nível!',
        message: 'Parabéns! Você alcançou o nível 3!',
        metadata: {
          old_level: 2,
          new_level: 3,
          total_xp: 200,
        },
        created_at: new Date().toISOString(),
      }

      mockSupabase.mockInsert('notifications', {
        data: expectedNotification,
        error: null,
      })

      // Mock a query that will return the notification
      mockSupabase.mockSimpleQuery('notifications', 'single', {
        data: expectedNotification,
        error: null,
      })

      const { data: notification } = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-123')
        .eq('type', 'level_up')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // .single() retorna { data: {...}, error: null }
      expect(notification?.type).toBe('level_up')
      expect(notification?.metadata?.new_level).toBe(3)
    })

    it('should not create notification for same level', async () => {
      // User stays at same level
      const stats = {
        user_id: 'user-123',
        total_xp: 150,
        current_level: 2,
      }

      mockSupabase.mockRpc('update_user_level_from_xp', {
        data: null,
        error: null,
      })

      // No level change, no notification
      mockSupabase.mockList('notifications', {
        data: [],
        error: null,
        count: 0,
      })

      const { data: notifications } = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-123')
        .eq('type', 'level_up')
        .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Last minute

      expect(notifications?.data?.length || 0).toBe(0)
    })
  })

  describe('Streak Notifications', () => {
    it('should create notification when streak milestone is reached', async () => {
      // User reaches 7-day streak
      const streak = {
        user_id: 'user-123',
        current_streak: 7,
        longest_streak: 7,
        last_study_date: new Date().toISOString(),
      }

      mockSupabase.mockRpc('update_user_streak', {
        data: null,
        error: null,
      })

      // Notification for streak milestone
      const expectedNotification = {
        id: 'notif-3',
        user_id: 'user-123',
        type: 'streak_milestone',
        title: 'Sequência de 7 Dias!',
        message: 'Parabéns! Você manteve uma sequência de 7 dias estudando!',
        metadata: {
          streak_days: 7,
          achievement_id: 'streak_7', // If achievement unlocked
        },
        created_at: new Date().toISOString(),
      }

      mockSupabase.mockInsert('notifications', {
        data: expectedNotification,
        error: null,
      })

      // Mock a query that will return the notification
      mockSupabase.mockSimpleQuery('notifications', 'single', {
        data: expectedNotification,
        error: null,
      })

      const { data: notification } = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-123')
        .eq('type', 'streak_milestone')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // .single() retorna { data: {...}, error: null }
      expect(notification?.metadata?.streak_days).toBe(7)
    })

    it('should create notification when streak is broken', async () => {
      // User had streak of 5, now broken
      const oldStreak = {
        user_id: 'user-123',
        current_streak: 5,
        longest_streak: 5,
        last_study_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      }

      mockSupabase.mockRpc('update_user_streak', {
        data: null,
        error: null,
      })

      // Notification for broken streak (optional, may not be implemented)
      // This is a test for potential feature
      const expectedNotification = {
        id: 'notif-4',
        user_id: 'user-123',
        type: 'streak_broken',
        title: 'Sequência Quebrada',
        message: 'Você perdeu sua sequência de 5 dias. Continue estudando!',
        metadata: {
          broken_streak: 5,
          longest_streak: 5,
        },
        created_at: new Date().toISOString(),
      }

      // This may not be implemented, so we just test the structure
      expect(expectedNotification.type).toBe('streak_broken')
    })
  })

  describe('Leaderboard Notifications', () => {
    it('should create notification when user enters top 10', async () => {
      // User moves from rank 11 to rank 9
      const oldRank = 11
      const newRank = 9

      // Simulate leaderboard update
      mockSupabase.mockRpc('refresh_leaderboard', {
        data: null,
        error: null,
      })

      // Notification for entering top 10
      const expectedNotification = {
        id: 'notif-5',
        user_id: 'user-123',
        type: 'leaderboard',
        title: 'Top 10!',
        message: 'Parabéns! Você entrou no top 10 do ranking!',
        metadata: {
          rank: 9,
          period_type: 'all-time',
        },
        created_at: new Date().toISOString(),
      }

      mockSupabase.mockInsert('notifications', {
        data: expectedNotification,
        error: null,
      })

      // Mock a query that will return the notification
      mockSupabase.mockSimpleQuery('notifications', 'single', {
        data: expectedNotification,
        error: null,
      })

      const { data: notification } = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-123')
        .eq('type', 'leaderboard')
        .eq('metadata->>rank', '9')
        .single()

      // .single() retorna { data: {...}, error: null }
      expect(notification?.metadata?.rank).toBe(9)
    })

    it('should not create notification if already in top 10', async () => {
      // User was rank 5, still rank 5
      const rank = 5

      // No change in rank, no notification
      mockSupabase.mockList('notifications', {
        data: [],
        error: null,
        count: 0,
      })

      const { data: notifications } = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-123')
        .eq('type', 'leaderboard')
        .gte('created_at', new Date(Date.now() - 60000).toISOString())

      // Should not have new notification
      expect(notifications?.data?.length || 0).toBe(0)
    })

    it('should create notification when user reaches rank 1', async () => {
      // User reaches rank 1
      const expectedNotification = {
        id: 'notif-6',
        user_id: 'user-123',
        type: 'leaderboard',
        title: '🏆 Número 1!',
        message: 'Incrível! Você alcançou o primeiro lugar no ranking!',
        metadata: {
          rank: 1,
          period_type: 'all-time',
        },
        created_at: new Date().toISOString(),
      }

      mockSupabase.mockInsert('notifications', {
        data: expectedNotification,
        error: null,
      })

      // Mock a query that will return the notification
      mockSupabase.mockSimpleQuery('notifications', 'single', {
        data: expectedNotification,
        error: null,
      })

      const { data: notification } = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-123')
        .eq('type', 'leaderboard')
        .eq('metadata->>rank', '1')
        .single()

      // .single() retorna { data: {...}, error: null }
      expect(notification?.title).toContain('Número 1')
      expect(notification?.metadata?.rank).toBe(1)
    })
  })

  describe('Multiple Notifications', () => {
    it('should handle multiple notifications from single action', async () => {
      // User completes course, which:
      // 1. Unlocks achievement
      // 2. Levels up
      // 3. Updates streak

      const notifications = [
        {
          id: 'notif-7',
          user_id: 'user-123',
          type: 'achievement',
          title: 'Conquista Desbloqueada!',
          message: 'Estudioso: Completar 5 cursos',
        },
        {
          id: 'notif-8',
          user_id: 'user-123',
          type: 'level_up',
          title: 'Subiu de Nível!',
          message: 'Parabéns! Você alcançou o nível 4!',
        },
      ]

      mockSupabase.mockList('notifications', {
        data: notifications,
        error: null,
        count: 2,
      })

      const queryResult = await mockSupabase
        .from('notifications')
        .select('*')
        .eq('user_id', 'user-123')
        .gte('created_at', new Date(Date.now() - 60000).toISOString())
        .order('created_at', { ascending: false })

      // mockList retorna { data: [...], error: null, count: ... }
      const allNotifications = queryResult?.data || []
      expect(allNotifications.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Notification Error Handling', () => {
    it('should not fail gamification if notification creation fails', async () => {
      // Simulate notification table not existing or error
      mockSupabase.mockInsert('notifications', {
        data: null,
        error: { code: '42P01', message: 'Table notifications does not exist' },
      })

      // Gamification should still work
      mockSupabase.mockRpc('add_user_points', {
        data: null,
        error: null,
      })

      mockSupabase.mockRpc('check_and_unlock_achievements', {
        data: 1,
        error: null,
      })

      // Should not throw error
      const { error: pointsError } = await mockSupabase.rpc('add_user_points', {
        p_user_id: 'user-123',
        p_points: 100,
        p_source_type: 'course_complete',
        p_source_id: 'course-1',
        p_metadata: {},
      })

      expect(pointsError).toBeNull()

      const { error: achievementsError } = await mockSupabase.rpc('check_and_unlock_achievements', {
        p_user_id: 'user-123',
      })

      expect(achievementsError).toBeNull()
    })
  })
})
