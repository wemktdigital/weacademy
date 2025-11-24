/**
 * Helper functions para gamificação
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export interface AwardPointsParams {
  userId: string
  points: number
  sourceType: 'course_complete' | 'lesson_complete' | 'quiz_pass' | 'quiz_perfect' | 'lab_ia_usage' | 'certificate' | 'streak' | 'achievement' | 'manual'
  sourceId?: string | null
  metadata?: Record<string, any>
}

export interface AchievementCondition {
  courses_completed?: number
  lessons_completed?: number
  quizzes_passed?: number
  quizzes_perfect_score?: number
  streak_days?: number
  certificates_count?: number
}

/**
 * Conceder pontos a um usuário
 */
export async function awardPoints(params: AwardPointsParams): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase.rpc('add_user_points', {
    p_user_id: params.userId,
    p_points: params.points,
    p_source_type: params.sourceType,
    p_source_id: params.sourceId || null,
    p_metadata: params.metadata || {},
  })

  if (error) {
    throw new Error(`Failed to award points: ${error.message}`)
  }

  return data
}

/**
 * Verificar e desbloquear conquistas
 */
export async function checkAchievements(userId: string): Promise<number> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase.rpc('check_and_unlock_achievements', {
    p_user_id: userId,
  })

  if (error) {
    throw new Error(`Failed to check achievements: ${error.message}`)
  }

  return data || 0
}

/**
 * Atualizar streak do usuário
 */
export async function updateStreak(userId: string): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { error } = await supabase.rpc('update_user_streak', {
    p_user_id: userId,
  })

  if (error) {
    throw new Error(`Failed to update streak: ${error.message}`)
  }
}

/**
 * Obter estatísticas do usuário
 */
export async function getUserStats(userId: string): Promise<any> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase.rpc('get_user_gamification_stats', {
    p_user_id: userId,
  })

  if (error) {
    throw new Error(`Failed to get user stats: ${error.message}`)
  }

  return data || {}
}

/**
 * Validar origem de pontos
 */
export function validatePointOrigin(
  sourceType: string,
  sourceId: string | null | undefined
): boolean {
  const validSourceTypes = [
    'course_complete',
    'lesson_complete',
    'quiz_pass',
    'quiz_perfect',
    'lab_ia_usage',
    'certificate',
    'streak',
    'achievement',
    'manual',
  ]

  if (!validSourceTypes.includes(sourceType)) {
    return false
  }

  // Alguns sourceTypes requerem sourceId
  const requiresSourceId = [
    'course_complete',
    'lesson_complete',
    'quiz_pass',
    'quiz_perfect',
    'certificate',
  ]

  if (requiresSourceId.includes(sourceType) && !sourceId) {
    return false
  }

  return true
}

/**
 * Calcular XP necessário para próximo nível
 */
export function calculateXPForNextLevel(currentXP: number, levels: any[]): {
  nextLevelXP: number
  xpNeeded: number
  progress: number
} {
  if (!levels || levels.length === 0) {
    return { nextLevelXP: 100, xpNeeded: 100, progress: 0 }
  }

  // Encontrar nível atual
  const currentLevel = levels.find(
    (level: any) =>
      currentXP >= level.min_xp &&
      (level.max_xp === null || currentXP < level.max_xp)
  ) || levels[0]

  // Encontrar próximo nível
  const nextLevel = levels.find(
    (level: any) => level.level_number === currentLevel.level_number + 1
  )

  if (!nextLevel) {
    // Nível máximo
    return {
      nextLevelXP: currentLevel.max_xp || currentXP + 100,
      xpNeeded: 0,
      progress: 100,
    }
  }

  const xpInCurrentLevel = currentXP - currentLevel.min_xp
  const xpNeededForNext = nextLevel.min_xp - currentLevel.min_xp
  const progress = (xpInCurrentLevel / xpNeededForNext) * 100

  return {
    nextLevelXP: nextLevel.min_xp,
    xpNeeded: nextLevel.min_xp - currentXP,
    progress: Math.min(progress, 100),
  }
}

