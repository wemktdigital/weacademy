'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export interface GamificationStats {
  total_xp: number
  current_level: number
  level_xp: number
  next_level_xp: number
  level_name?: string
  achievements_unlocked: number
  achievements_total: number
  current_streak: number
  longest_streak: number
  courses_completed: number
  lessons_completed: number
  quizzes_passed: number
  certificates_earned: number
}

export interface Achievement {
  id: string
  code: string
  name: string
  description: string
  icon: string
  category: string
  points: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  unlocked?: boolean
  unlocked_at?: string | null
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  points: number
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
  is_current_user: boolean
}

export function useGamification() {
  const { user } = useAuth()
  const [stats, setStats] = useState<GamificationStats | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Buscar estatísticas
  const fetchStats = useCallback(async () => {
    if (!user) {
      setStats(null)
      setLoading(false)
      setError(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !sessionData?.session) {
        console.warn('No active session:', sessionError)
        setStats(null)
        setError(null)
        setLoading(false)
        return
      }

      const token = sessionData.session.access_token

      if (!token) {
        console.warn('No access token available')
        setStats(null)
        setError(null)
        setLoading(false)
        return
      }

      let response: Response
      try {
        response = await fetch('/api/gamification/stats', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      } catch (fetchError: any) {
        // Erro de rede (Failed to fetch) - não é um erro crítico
        console.warn('Network error fetching stats:', fetchError?.message || fetchError)
        setStats(null)
        setError(null)
        setLoading(false)
        return
      }

      if (!response.ok) {
        // Se for erro 401, não é um erro real, apenas usuário não autenticado
        if (response.status === 401) {
          console.warn('User not authenticated')
          setStats(null)
          setError(null)
          setLoading(false)
          return
        }

        // Ler o body da resposta de erro
        let errorData: any = {}
        let errorText = ''
        const status = response.status
        const statusText = response.statusText
        const contentType = response.headers.get('content-type')
        
        try {
          // Tentar ler como texto primeiro
          errorText = await response.text()
          
          // Tentar parsear como JSON se houver conteúdo
          if (errorText) {
            try {
              errorData = JSON.parse(errorText)
            } catch {
              // Se não for JSON, usar o texto como mensagem
              errorData = { message: errorText }
            }
          }
        } catch (e: any) {
          console.warn('Failed to read error response body:', e?.message || e)
          errorData = {}
        }

        // Construir mensagem de erro com fallbacks e incluir detalhes/hint se disponível
        let errorMessage = errorData?.error || errorData?.details || errorData?.message || errorText || `Erro HTTP ${status}: ${statusText || 'Erro desconhecido'}`
        
        // Se for erro 503 (Service Unavailable), adicionar informações sobre a migration
        if (status === 503 && errorData?.hint) {
          errorMessage += ` - ${errorData.hint}`
        }
        
        // Log detalhado do erro
        console.error('=== ERROR FETCHING STATS ===')
        console.error('Status:', status)
        console.error('Status Text:', statusText)
        console.error('Content-Type:', contentType)
        console.error('Error Text (raw):', errorText)
        console.error('Error Data (parsed):', errorData)
        console.error('Error Data Type:', typeof errorData)
        console.error('Error Data Keys:', Object.keys(errorData))
        console.error('Error Message (final):', errorMessage)
        console.error('================================')
        setError(errorMessage)
        setLoading(false)
        return // Não continuar após erro
      }

      const data = await response.json()
      setStats(data.stats || null)
    } catch (err: any) {
      console.error('Error fetching stats:', err)
      // Erros de rede não devem quebrar a aplicação
      const isNetworkError = err?.message === 'Failed to fetch' || 
                            err?.name === 'TypeError' ||
                            err?.message?.includes('fetch') ||
                            err?.message?.includes('network')
      
      if (isNetworkError) {
        console.warn('Network error while fetching stats')
        // Não setar erro para erros de rede, apenas logar
        setStats(null)
        setError(null)
      } else {
        setError(err?.message || 'Erro ao carregar estatísticas')
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  // Buscar achievements
  const fetchAchievements = useCallback(async (includeUnlocked = true) => {
    if (!user) {
      setAchievements([])
      return
    }

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !sessionData?.session) {
        console.warn('No active session for achievements:', sessionError)
        setAchievements([])
        return
      }

      const token = sessionData.session.access_token

      if (!token) {
        console.warn('No access token for achievements')
        setAchievements([])
        return
      }

      let response: Response
      try {
        response = await fetch(
          `/api/gamification/badges?include_unlocked=${includeUnlocked}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
      } catch (fetchError: any) {
        // Erro de rede (Failed to fetch) - não é um erro crítico
        console.warn('Network error fetching achievements:', fetchError?.message || fetchError)
        setAchievements([])
        return
      }

      if (!response.ok) {
        // Se for erro 401, não é um erro real, apenas usuário não autenticado
        if (response.status === 401) {
          console.warn('User not authenticated for badges')
          setAchievements([])
          return
        }

        // Ler o body da resposta de erro
        let errorData: any = {}
        let errorText = ''
        const status = response.status
        const statusText = response.statusText
        const contentType = response.headers.get('content-type')
        
        try {
          // Tentar ler como texto primeiro
          errorText = await response.text()
          
          // Tentar parsear como JSON se houver conteúdo
          if (errorText) {
            try {
              errorData = JSON.parse(errorText)
            } catch {
              // Se não for JSON, usar o texto como mensagem
              errorData = { message: errorText }
            }
          }
        } catch (e: any) {
          console.warn('Failed to read error response body:', e?.message || e)
          errorData = {}
        }

        // Construir mensagem de erro com fallbacks e incluir detalhes/hint se disponível
        let errorMessage = errorData?.error || errorData?.details || errorData?.message || errorText || `Erro HTTP ${status}: ${statusText || 'Erro desconhecido'}`
        
        // Se for erro 503 (Service Unavailable), adicionar informações sobre a migration
        if (status === 503 && errorData?.hint) {
          errorMessage += ` - ${errorData.hint}`
        }
        
        // Log detalhado do erro
        console.error('=== ERROR FETCHING BADGES ===')
        console.error('Status:', status)
        console.error('Status Text:', statusText)
        console.error('Content-Type:', contentType)
        console.error('Error Text (raw):', errorText)
        console.error('Error Data (parsed):', errorData)
        console.error('Error Data Type:', typeof errorData)
        console.error('Error Data Keys:', Object.keys(errorData))
        console.error('Error Message (final):', errorMessage)
        console.error('================================')
        setAchievements([]) // Limpar achievements em caso de erro
        return // Não continuar após erro
      }

      const data = await response.json()
      setAchievements(data.badges || [])
    } catch (err: any) {
      console.error('Error fetching achievements:', err)
      // Erros de rede não devem quebrar a aplicação
      const isNetworkError = err?.message === 'Failed to fetch' || 
                            err?.name === 'TypeError' ||
                            err?.message?.includes('fetch') ||
                            err?.message?.includes('network')
      
      if (isNetworkError) {
        console.warn('Network error while fetching achievements - using empty array')
        // Não setar erro para erros de rede, apenas logar
      }
      setAchievements([])
    }
  }, [user])

  // Verificar e atualizar conquistas
  const checkAchievements = useCallback(async () => {
    if (!user) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        return
      }

      const response = await fetch('/api/gamification/check-achievements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: user.id }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Se houve novos achievements desbloqueados, atualizar stats e achievements
        if (data.unlocked_count > 0) {
          await fetchStats()
          await fetchAchievements()
          
          return {
            unlocked_count: data.unlocked_count,
            new_achievements: data.new_achievements || [],
          }
        }
      }
    } catch (err: any) {
      console.error('Error checking achievements:', err)
    }

    return { unlocked_count: 0, new_achievements: [] }
  }, [user, fetchStats, fetchAchievements])

  // Buscar leaderboard
  const fetchLeaderboard = useCallback(
    async (
      period: 'weekly' | 'monthly' | 'all-time' = 'all-time',
      limit = 100
    ): Promise<LeaderboardEntry[]> => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token

        const headers: HeadersInit = {}
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }

        let response: Response
        try {
          response = await fetch(
            `/api/gamification/leaderboard?period=${period}&limit=${limit}`,
            {
              headers,
            }
          )
        } catch (fetchError: any) {
          // Erro de rede (Failed to fetch) - não é um erro crítico
          console.warn('Network error fetching leaderboard:', fetchError?.message || fetchError)
          return []
        }

        if (!response.ok) {
          // Erros HTTP - usar console.warn em vez de console.error
          console.warn('Error fetching leaderboard:', response.status, response.statusText)
          return []
        }

        const data = await response.json()
        return data.leaderboard || []
      } catch (err: any) {
        // Outros erros - usar console.warn em vez de console.error
        console.warn('Error fetching leaderboard:', err?.message || err)
        return []
      }
    },
    []
  )

  // Atualizar estatísticas periodicamente
  useEffect(() => {
    if (user) {
      fetchStats()
      fetchAchievements()

      // Atualizar a cada 5 minutos
      const interval = setInterval(() => {
        fetchStats()
      }, 5 * 60 * 1000)

      return () => clearInterval(interval)
    }
  }, [user, fetchStats, fetchAchievements])

  // Escutar eventos de notificação (se houver sistema SSE ou WebSocket)
  useEffect(() => {
    if (!user) return

    // Aqui pode ser adicionado listener para eventos em tempo real
    // Por enquanto, apenas atualizamos periodicamente
  }, [user])

  return {
    stats,
    achievements,
    loading,
    error,
    fetchStats,
    fetchAchievements,
    checkAchievements,
    fetchLeaderboard,
    refresh: () => {
      fetchStats()
      fetchAchievements()
    },
  }
}

