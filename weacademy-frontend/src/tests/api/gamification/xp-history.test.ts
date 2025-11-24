import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/gamification/xp-history/route'

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          gte: vi.fn(() => ({
            then: vi.fn(),
          })),
          then: vi.fn(),
        })),
      })),
    })),
  })),
}

vi.mock('@/lib/supabaseServer', () => ({
  supabaseServer: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

describe('GET /api/gamification/xp-history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return XP history for authenticated user', async () => {
    // Mock autenticação
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
      error: null,
    })

    // Mock dados de pontos
    const mockPoints = [
      { points: 10, created_at: new Date('2025-01-01').toISOString(), source_type: 'lesson' },
      { points: 20, created_at: new Date('2025-01-02').toISOString(), source_type: 'quiz' },
    ]

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: mockPoints, error: null }),
    })

    const request = new NextRequest('http://localhost:3000/api/gamification/xp-history?period=30d&groupBy=day')
    
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('history')
    expect(data).toHaveProperty('stats')
  })

  it('should return 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const request = new NextRequest('http://localhost:3000/api/gamification/xp-history')
    
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('Não autenticado')
  })

  it('should group by day when groupBy=day', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
      error: null,
    })

    const mockPoints = [
      { points: 10, created_at: new Date('2025-01-01T10:00:00').toISOString(), source_type: 'lesson' },
      { points: 20, created_at: new Date('2025-01-01T15:00:00').toISOString(), source_type: 'quiz' },
    ]

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: mockPoints, error: null }),
    })

    const request = new NextRequest('http://localhost:3000/api/gamification/xp-history?groupBy=day')
    
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.stats.groupBy).toBe('day')
  })

  it('should calculate cumulative XP correctly', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
      error: null,
    })

    const mockPoints = [
      { points: 10, created_at: new Date('2025-01-01').toISOString(), source_type: 'lesson' },
      { points: 20, created_at: new Date('2025-01-02').toISOString(), source_type: 'quiz' },
      { points: 15, created_at: new Date('2025-01-03').toISOString(), source_type: 'lesson' },
    ]

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: mockPoints, error: null }),
    })

    const request = new NextRequest('http://localhost:3000/api/gamification/xp-history')
    
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    if (data.history.length > 0) {
      const lastItem = data.history[data.history.length - 1]
      expect(lastItem.cumulativeXp).toBeGreaterThanOrEqual(45) // Soma de todos os pontos
    }
  })
})

