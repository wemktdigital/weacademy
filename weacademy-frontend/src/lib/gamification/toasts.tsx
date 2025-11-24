'use client'

import { toast } from 'sonner'
import { 
  Trophy, 
  Star, 
  TrendingUp, 
  Sparkles, 
  Award, 
  Zap,
  CheckCircle2,
  AlertCircle,
  Info,
  XCircle,
} from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'
type GamificationToastType = 'achievement' | 'level-up' | 'xp-earned' | 'streak' | 'milestone'

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertCircle,
  achievement: Trophy,
  'level-up': Star,
  'xp-earned': TrendingUp,
  streak: Zap,
  milestone: Award,
}

const TOAST_COLORS = {
  success: {
    background: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-900 dark:text-emerald-100',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    background: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-900 dark:text-red-100',
    icon: 'text-red-600 dark:text-red-400',
  },
  info: {
    background: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-900 dark:text-blue-100',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  warning: {
    background: 'bg-yellow-50 dark:bg-yellow-950/30',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-900 dark:text-yellow-100',
    icon: 'text-yellow-600 dark:text-yellow-400',
  },
  achievement: {
    background: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-900 dark:text-purple-100',
    icon: 'text-purple-600 dark:text-purple-400',
  },
  'level-up': {
    background: 'bg-yellow-50 dark:bg-yellow-950/30',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-900 dark:text-yellow-100',
    icon: 'text-yellow-600 dark:text-yellow-400',
  },
  'xp-earned': {
    background: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-900 dark:text-green-100',
    icon: 'text-green-600 dark:text-green-400',
  },
  streak: {
    background: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-900 dark:text-orange-100',
    icon: 'text-orange-600 dark:text-orange-400',
  },
  milestone: {
    background: 'bg-indigo-50 dark:bg-indigo-950/30',
    border: 'border-indigo-200 dark:border-indigo-800',
    text: 'text-indigo-900 dark:text-indigo-100',
    icon: 'text-indigo-600 dark:text-indigo-400',
  },
}

interface ShowToastOptions {
  title: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export function showGamificationToast(
  type: GamificationToastType,
  options: ShowToastOptions
) {
  const Icon = TOAST_ICONS[type]
  const colors = TOAST_COLORS[type]

  toast.success(options.title, {
    description: options.description,
    duration: options.duration || 4000,
    icon: <Icon className={`w-5 h-5 ${colors.icon}`} />,
    className: `${colors.background} ${colors.border} ${colors.text} border-l-4`,
    action: options.action ? {
      label: options.action.label,
      onClick: options.action.onClick,
    } : undefined,
  })
}

export function showAchievementToast(achievementName: string, rarity?: 'common' | 'rare' | 'epic' | 'legendary') {
  showGamificationToast('achievement', {
    title: 'Conquista Desbloqueada!',
    description: achievementName,
    duration: rarity === 'legendary' ? 6000 : rarity === 'epic' ? 5000 : 4000,
  })
}

export function showLevelUpToast(newLevel: number, levelName?: string) {
  showGamificationToast('level-up', {
    title: 'Level Up!',
    description: `Você alcançou o nível ${newLevel}${levelName ? `: ${levelName}` : ''}!`,
    duration: 5000,
  })
}

export function showXPToast(points: number, source?: string) {
  showGamificationToast('xp-earned', {
    title: `+${points.toLocaleString('pt-BR')} XP`,
    description: source || 'Pontos ganhos!',
    duration: 3000,
  })
}

export function showStreakToast(currentStreak: number) {
  showGamificationToast('streak', {
    title: 'Sequência de Estudos!',
    description: `${currentStreak} dia${currentStreak > 1 ? 's' : ''} seguido${currentStreak > 1 ? 's' : ''}! Continue assim! 🔥`,
    duration: 4000,
  })
}

export function showMilestoneToast(milestone: string) {
  showGamificationToast('milestone', {
    title: 'Marco Alcançado!',
    description: milestone,
    duration: 4000,
  })
}
