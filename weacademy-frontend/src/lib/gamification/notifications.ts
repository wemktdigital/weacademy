/**
 * Integração de gamificação com sistema de notificações
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export interface Achievement {
  id: string
  code: string
  name: string
  description: string
  icon: string
  category: string
  points: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export interface LevelInfo {
  level_number: number
  level_name: string
  level_xp: number
  next_level_xp: number
  progress_percentage: number
}

/**
 * Notificar ao desbloquear badge
 */
export async function notifyBadgeUnlocked(
  userId: string,
  achievement: Achievement
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // Verificar se tabela de notificações existe
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'achievement',
        title: '🎉 Conquista Desbloqueada!',
        message: `${achievement.icon} ${achievement.name}: ${achievement.description}`,
        metadata: {
          achievement_id: achievement.id,
          achievement_code: achievement.code,
          icon: achievement.icon,
          rarity: achievement.rarity,
          points: achievement.points,
        },
        read: false,
      })

    if (error) {
      // Log erro mas não falha a gamificação
      console.error('Error creating notification:', error)
    }
  } catch (error: any) {
    // Ignorar erros de notificação (tabela pode não existir ainda)
    console.warn('Failed to create notification:', error.message)
  }
}

/**
 * Notificar ao subir de nível
 */
export async function notifyLevelUp(
  userId: string,
  newLevel: LevelInfo
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'level_up',
        title: '⭐ Novo Nível Alcançado!',
        message: `Parabéns! Você alcançou o nível ${newLevel.level_number}: ${newLevel.level_name}`,
        metadata: {
          level_number: newLevel.level_number,
          level_name: newLevel.level_name,
          level_xp: newLevel.level_xp,
          next_level_xp: newLevel.next_level_xp,
        },
        read: false,
      })

    if (error) {
      console.error('Error creating notification:', error)
    }
  } catch (error: any) {
    console.warn('Failed to create notification:', error.message)
  }
}

/**
 * Notificar ao quebrar recorde de streak
 */
export async function notifyStreakRecord(
  userId: string,
  streak: number
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'streak',
        title: '🔥 Novo Recorde de Sequência!',
        message: `Incrível! Você está estudando há ${streak} dias seguidos!`,
        metadata: {
          streak: streak,
          record_type: 'record',
        },
        read: false,
      })

    if (error) {
      console.error('Error creating notification:', error)
    }
  } catch (error: any) {
    console.warn('Failed to create notification:', error.message)
  }
}

/**
 * Notificar ao entrar no top 10 do leaderboard
 */
export async function notifyTopLeaderboard(
  userId: string,
  rank: number,
  period: 'weekly' | 'monthly' | 'all-time'
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const periodNames = {
      weekly: 'semanal',
      monthly: 'mensal',
      'all-time': 'geral',
    }

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'leaderboard',
        title: '🏆 Top 10 no Ranking!',
        message: `Parabéns! Você está em ${rank}º lugar no ranking ${periodNames[period]}!`,
        metadata: {
          rank: rank,
          period: period,
        },
        read: false,
      })

    if (error) {
      console.error('Error creating notification:', error)
    }
  } catch (error: any) {
    console.warn('Failed to create notification:', error.message)
  }
}

