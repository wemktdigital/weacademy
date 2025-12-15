'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Target, 
  TrendingUp, 
  Flame, 
  Star, 
  Award, 
  Trophy,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface PersonalizedInsightsProps {
  stats: {
    total_xp: number
    current_level: number
    level_xp: number
    next_level_xp: number
    current_streak: number
    longest_streak: number
    achievements_unlocked: number
    achievements_total: number
  }
  className?: string
}

export function PersonalizedInsights({ stats, className }: PersonalizedInsightsProps) {
  const insights: Array<{
    type: 'level' | 'streak' | 'achievement' | 'motivation' | 'warning'
    icon: React.ReactNode
    title: string
    message: string
    action?: {
      label: string
      href: string
    }
    priority: number
  }> = []

  // Insight 1: Próximo nível
  const xpNeeded = stats.next_level_xp - stats.level_xp
  const progressToNextLevel = stats.next_level_xp > 0 
    ? (stats.level_xp / stats.next_level_xp) * 100 
    : 0
  
  if (xpNeeded > 0 && progressToNextLevel >= 70) {
    insights.push({
      type: 'level',
      icon: <Star className="h-5 w-5 text-yellow-500" />,
      title: 'Quase lá!',
      message: `Você está perto do próximo nível! Falta apenas ${xpNeeded} XP para subir para o nível ${stats.current_level + 1}.`,
      action: {
        label: 'Ver Cursos',
        href: '/courses',
      },
      priority: 1,
    })
  }

  // Insight 2: Sequência de estudos
  if (stats.current_streak >= 3 && stats.current_streak < 7) {
    insights.push({
      type: 'streak',
      icon: <Flame className="h-5 w-5 text-orange-500" />,
      title: 'Mantenha a sequência!',
      message: `Você está com ${stats.current_streak} dias seguidos de estudos! Continue por mais ${7 - stats.current_streak} dia${7 - stats.current_streak > 1 ? 's' : ''} para alcançar uma sequência quente.`,
      action: {
        label: 'Ver Cursos',
        href: '/courses',
      },
      priority: 2,
    })
  } else if (stats.current_streak >= 7 && stats.current_streak < 30) {
    insights.push({
      type: 'streak',
      icon: <Flame className="h-5 w-5 text-red-500" />,
      title: 'Sequência quente!',
      message: `🔥 Você está em chamas! ${stats.current_streak} dias seguidos de estudos. Continue assim para manter sua sequência e ganhar bônus!`,
      priority: 2,
    })
  } else if (stats.current_streak >= 30) {
    insights.push({
      type: 'achievement',
      icon: <Award className="h-5 w-5 text-yellow-500" />,
      title: 'Lenda!',
      message: `🏆 Incrível! ${stats.current_streak} dias consecutivos de estudos! Você é uma lenda!`,
      priority: 1,
    })
  }

  // Insight 3: Recorde de sequência
  if (stats.current_streak > 0 && stats.current_streak === stats.longest_streak) {
    insights.push({
      type: 'achievement',
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      title: 'Novo recorde!',
      message: `Parabéns! Você alcançou um novo recorde de ${stats.current_streak} dias consecutivos de estudos!`,
      priority: 3,
    })
  }

  // Insight 4: Progresso de conquistas
  const achievementProgress = stats.achievements_total > 0
    ? (stats.achievements_unlocked / stats.achievements_total) * 100
    : 0

  if (achievementProgress > 0 && achievementProgress < 50) {
    const remaining = stats.achievements_total - stats.achievements_unlocked
    insights.push({
      type: 'motivation',
      icon: <Target className="h-5 w-5 text-blue-500" />,
      title: 'Continue conquistando!',
      message: `Você desbloqueou ${stats.achievements_unlocked} de ${stats.achievements_total} badges. Faltam apenas ${remaining} para completar sua coleção!`,
      action: {
        label: 'Ver Badges',
        href: '/profile/badges',
      },
      priority: 3,
    })
  } else if (achievementProgress >= 50 && achievementProgress < 100) {
    insights.push({
      type: 'achievement',
      icon: <Trophy className="h-5 w-5 text-purple-500" />,
      title: 'Metade do caminho!',
      message: `Você já desbloqueou ${Math.round(achievementProgress)}% dos badges! Continue assim para completar sua coleção.`,
      action: {
        label: 'Ver Badges',
        href: '/profile/badges',
      },
      priority: 3,
    })
  }

  // Insight 5: Motivação para novos usuários
  if (stats.total_xp < 100 && stats.current_streak === 0) {
    insights.push({
      type: 'motivation',
      icon: <Sparkles className="h-5 w-5 text-primary" />,
      title: 'Bem-vindo!',
      message: 'Comece sua jornada de aprendizado hoje! Complete seu primeiro curso para ganhar XP e desbloquear conquistas.',
      action: {
        label: 'Explorar Cursos',
        href: '/courses',
      },
      priority: 1,
    })
  }

  // Insight 6: Aviso de sequência em risco
  if (stats.current_streak > 0 && stats.current_streak < 3) {
    insights.push({
      type: 'warning',
      icon: <AlertCircle className="h-5 w-5 text-yellow-500" />,
      title: 'Mantenha a sequência!',
      message: `Você tem ${stats.current_streak} dia${stats.current_streak > 1 ? 's' : ''} de estudos seguidos. Continue estudando hoje para manter sua sequência!`,
      action: {
        label: 'Ver Cursos',
        href: '/courses',
      },
      priority: 1,
    })
  }

  // Ordenar por prioridade (menor número = maior prioridade)
  insights.sort((a, b) => a.priority - b.priority)

  // Pegar apenas os 3 insights mais importantes
  const topInsights = insights.slice(0, 3)

  if (topInsights.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-4', className)}>
      {topInsights.map((insight, index) => (
        <Card
          key={index}
          className={cn(
            'transition-all duration-300 hover:shadow-lg cursor-pointer',
            insight.type === 'warning' && 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20',
            insight.type === 'achievement' && 'border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/20',
            insight.type === 'level' && 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20',
            insight.type === 'streak' && 'border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20',
          )}
        >
          {insight.action ? (
            <Link href={insight.action.href}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn(
                      'rounded-full p-2 bg-background',
                      insight.type === 'warning' && 'bg-yellow-100 dark:bg-yellow-900/30',
                      insight.type === 'achievement' && 'bg-purple-100 dark:bg-purple-900/30',
                      insight.type === 'level' && 'bg-blue-100 dark:bg-blue-900/30',
                      insight.type === 'streak' && 'bg-orange-100 dark:bg-orange-900/30',
                    )}>
                      {insight.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-1">{insight.title}</CardTitle>
                      <CardDescription className="text-sm">{insight.message}</CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </CardHeader>
            </Link>
          ) : (
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'rounded-full p-2 bg-background',
                  insight.type === 'warning' && 'bg-yellow-100 dark:bg-yellow-900/30',
                  insight.type === 'achievement' && 'bg-purple-100 dark:bg-purple-900/30',
                  insight.type === 'level' && 'bg-blue-100 dark:bg-blue-900/30',
                  insight.type === 'streak' && 'bg-orange-100 dark:bg-orange-900/30',
                )}>
                  {insight.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg mb-1">{insight.title}</CardTitle>
                  <CardDescription className="text-sm">{insight.message}</CardDescription>
                </div>
              </div>
            </CardHeader>
          )}
        </Card>
      ))}
    </div>
  )
}

