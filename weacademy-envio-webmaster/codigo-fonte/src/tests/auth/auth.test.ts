import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { mockSupabase, createMockProfile, createMockUser } from '../utils/mockSupabase'

// Mock Supabase e dependências
vi.mock('@supabase/supabase-js')
vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        signUp: vi.fn(),
      },
      from: vi.fn(),
      rpc: vi.fn(),
    },
  }
})

describe('Auth Functions', () => {
  beforeEach(() => {
    mockSupabase.reset()
    vi.clearAllMocks()
  })

  describe('getCurrentUser', () => {
    it('should return current user with role', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('admin')

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

      const { getCurrentUser } = await import('@/lib/auth')
      const user = await getCurrentUser()

      expect(user).not.toBeNull()
      expect(user?.id).toBe(mockUser.id)
      expect(user?.email).toBe(mockProfile.email)
      expect(user?.role).toBe('admin')
    })

    it('should return null if user is not authenticated', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', status: 401 },
      })

      const { getCurrentUser } = await import('@/lib/auth')
      const user = await getCurrentUser()

      expect(user).toBeNull()
    })

    it('should return null if profile is not found', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
      vi.mocked(supabase.from).mockReturnValue(mockSupabase.getQueryBuilder() as any)
      mockSupabase.getQueryBuilder().select.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().eq.mockReturnValue(mockSupabase.getQueryBuilder())
      mockSupabase.getQueryBuilder().single.mockResolvedValue({
        data: null,
        error: { message: 'Profile not found', status: 404 },
      })

      const { getCurrentUser } = await import('@/lib/auth')
      const user = await getCurrentUser()

      expect(user).toBeNull()
    })
  })

  describe('isAdmin', () => {
    it('should return true if user is admin', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

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

      const { isAdmin } = await import('@/lib/auth')
      const result = await isAdmin()

      expect(result).toBe(true)
    })

    it('should return false if user is not admin', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('user')

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

      const { isAdmin } = await import('@/lib/auth')
      const result = await isAdmin()

      expect(result).toBe(false)
    })

    it('should return false if user is not authenticated', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', status: 401 },
      })

      const { isAdmin } = await import('@/lib/auth')
      const result = await isAdmin()

      expect(result).toBe(false)
    })
  })

  describe('isUserOrAdmin', () => {
    it('should return true if user is admin', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'admin@test.com')
      const mockProfile = createMockProfile('admin')

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

      const { isUserOrAdmin } = await import('@/lib/auth')
      const result = await isUserOrAdmin()

      expect(result).toBe(true)
    })

    it('should return true if user is user', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockProfile = createMockProfile('user')

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

      const { isUserOrAdmin } = await import('@/lib/auth')
      const result = await isUserOrAdmin()

      expect(result).toBe(true)
    })

    it('should return false if user is guest', async () => {
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

      const { isUserOrAdmin } = await import('@/lib/auth')
      const result = await isUserOrAdmin()

      expect(result).toBe(false)
    })

    it('should return false if user is not authenticated', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', status: 401 },
      })

      const { isUserOrAdmin } = await import('@/lib/auth')
      const result = await isUserOrAdmin()

      expect(result).toBe(false)
    })
  })

  describe('signIn', () => {
    it('should sign in successfully', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'user@test.com')
      const mockSession = {
        access_token: 'token-123',
        user: mockUser,
        expires_at: Date.now() + 3600 * 1000,
      }

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockUser,
          session: mockSession,
        },
        error: null,
      })

      const { signIn } = await import('@/lib/auth')
      const result = await signIn('user@test.com', 'password123')

      expect(result.error).toBeNull()
      expect(result.data?.user).toEqual(mockUser)
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@test.com',
        password: 'password123',
      })
    })

    it('should return error on invalid credentials', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: null,
          session: null,
        },
        error: { message: 'Invalid credentials', status: 400 },
      })

      const { signIn } = await import('@/lib/auth')
      const result = await signIn('user@test.com', 'wrongpassword')

      expect(result.error).not.toBeNull()
      expect(result.error?.message).toBe('Invalid credentials')
    })
  })

  describe('signUp', () => {
    it('should sign up successfully', async () => {
      const mockUser = createMockUser('123e4567-e89b-12d3-a456-426614174000', 'newuser@test.com')
      const mockSession = {
        access_token: 'token-123',
        user: mockUser,
        expires_at: Date.now() + 3600 * 1000,
      }

      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: {
          user: mockUser,
          session: mockSession,
        },
        error: null,
      })

      const { signUp } = await import('@/lib/auth')
      const result = await signUp('newuser@test.com', 'password123', 'New User')

      expect(result.error).toBeNull()
      expect(result.data?.user).toEqual(mockUser)
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@test.com',
        password: 'password123',
        options: {
          data: {
            full_name: 'New User',
          },
        },
      })
    })

    it('should return error on invalid email', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: {
          user: null,
          session: null,
        },
        error: { message: 'Invalid email', status: 400 },
      })

      const { signUp } = await import('@/lib/auth')
      const result = await signUp('invalid-email', 'password123')

      expect(result.error).not.toBeNull()
      expect(result.error?.message).toBe('Invalid email')
    })
  })

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: null,
      })

      const { signOut } = await import('@/lib/auth')
      const result = await signOut()

      expect(result.error).toBeNull()
      expect(supabase.auth.signOut).toHaveBeenCalled()
    })

    it('should return error on sign out failure', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: { message: 'Sign out failed', status: 500 },
      })

      const { signOut } = await import('@/lib/auth')
      const result = await signOut()

      expect(result.error).not.toBeNull()
      expect(result.error?.message).toBe('Sign out failed')
    })
  })

  describe('updateUserRole', () => {
    it('should update user role successfully (admin only)', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null,
      })

      const { updateUserRole } = await import('@/lib/auth')
      const result = await updateUserRole('123e4567-e89b-12d3-a456-426614174000', 'admin')

      expect(result.error).toBeNull()
      expect(result.data).toBe(true)
      expect(supabase.rpc).toHaveBeenCalledWith('update_user_role', {
        target_user_id: '123e4567-e89b-12d3-a456-426614174000',
        new_role: 'admin',
      })
    })

    it('should return error if not admin', async () => {
      const { supabase } = await import('@/lib/supabase')
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Apenas administradores podem alterar roles de usuários', status: 403 },
      })

      const { updateUserRole } = await import('@/lib/auth')
      const result = await updateUserRole('123e4567-e89b-12d3-a456-426614174000', 'admin')

      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('administradores')
    })
  })
})

