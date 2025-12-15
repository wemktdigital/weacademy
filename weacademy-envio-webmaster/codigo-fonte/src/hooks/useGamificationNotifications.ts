'use client'

import { useEffect, useRef, useState } from 'react'
import { showGamificationToast, showAchievementToast, showLevelUpToast, showXPToast } from '@/lib/gamification/toasts'
import { useGamification } from './useGamification'

import type { Achievement } from './useGamification'

interface AchievementWithUnlock extends Achievement {
  unlocked?: boolean
  unlocked_at?: string | null
}

export function useGamificationNotifications() {
  const { stats, achievements } = useGamification()
  const previousStatsRef = useRef<typeof stats | null>(null)
  const previousAchievementsRef = useRef<AchievementWithUnlock[]>([])
  
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ level: number; levelName?: string } | null>(null)
  
  const [showAchievementUnlock, setShowAchievementUnlock] = useState(false)
  const [achievementUnlockData, setAchievementUnlockData] = useState<AchievementWithUnlock | null>(null)

  // Detectar level up
  useEffect(() => {
    if (!stats || !previousStatsRef.current) {
      previousStatsRef.current = stats
      return
    }

    const previousLevel = previousStatsRef.current.current_level
    const currentLevel = stats.current_level

    if (currentLevel > previousLevel) {
      // Level up detectado!
      setLevelUpData({
        level: currentLevel,
        levelName: stats.level_name,
      })
      setShowLevelUp(true)
      showLevelUpToast(currentLevel, stats.level_name)
    }

    previousStatsRef.current = stats
  }, [stats])

  // Detectar achievements desbloqueados
  useEffect(() => {
    if (!achievements || achievements.length === 0) {
      previousAchievementsRef.current = []
      return
    }

    const currentUnlocked = achievements.filter((a: AchievementWithUnlock) => a.unlocked_at || a.unlocked)
    const previousUnlocked = previousAchievementsRef.current.filter((a: AchievementWithUnlock) => a.unlocked_at || a.unlocked)

    // Encontrar achievements recém-desbloqueados
    const newlyUnlocked = currentUnlocked.filter((current: AchievementWithUnlock) => {
      const wasUnlockedBefore = previousUnlocked.some((prev: AchievementWithUnlock) => prev.id === current.id)
      return !wasUnlockedBefore
    })

    // Mostrar modais apenas para achievements raros ou acima
    const rareAchievements = newlyUnlocked.filter(
      (a: AchievementWithUnlock) => a.rarity && a.rarity !== 'common'
    )

    // Mostrar toast para todos
    newlyUnlocked.forEach((achievement: AchievementWithUnlock) => {
      showAchievementToast(achievement.name, achievement.rarity)
    })

    // Mostrar modal para o primeiro achievement raro desbloqueado
    if (rareAchievements.length > 0) {
      setAchievementUnlockData(rareAchievements[0])
      setShowAchievementUnlock(true)
    }

    previousAchievementsRef.current = achievements
  }, [achievements])

  // Detectar mudanças de XP (apenas para toast, não modal)
  useEffect(() => {
    if (!stats || !previousStatsRef.current) {
      previousStatsRef.current = stats
      return
    }

    const previousXP = previousStatsRef.current.total_xp
    const currentXP = stats.total_xp

    if (currentXP > previousXP && previousXP > 0) {
      const xpGained = currentXP - previousXP
      // Só mostrar toast se ganhou mais de 1 XP (evitar spam)
      if (xpGained > 1) {
        showXPToast(xpGained)
      }
    }

    previousStatsRef.current = stats
  }, [stats])

  return {
    // Estados dos modais
    showLevelUp,
    levelUpData,
    showAchievementUnlock,
    achievementUnlockData,
    // Funções para fechar
    onCloseLevelUp: () => setShowLevelUp(false),
    onCloseAchievementUnlock: () => setShowAchievementUnlock(false),
  }
}

