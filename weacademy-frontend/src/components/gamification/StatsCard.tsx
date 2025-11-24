'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Trophy, 
  Star, 
  Flame, 
  Award, 
  Target, 
  TrendingUp,
  LucideIcon,
} from 'lucide-react'

export interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label: string
    isPositive?: boolean
  }
  badge?: string
  variant?: 'default' | 'primary' | 'success' | 'warning'
  className?: string
  onClick?: () => void
}

const VARIANT_STYLES = {
  default: 'border-border',
  primary: 'border-primary bg-primary/5',
  success: 'border-green-500 bg-green-500/5',
  warning: 'border-yellow-500 bg-yellow-500/5',
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  badge,
  variant = 'default',
  className,
  onClick,
}: StatsCardProps) {
  const formattedValue = typeof value === 'number' 
    ? value.toLocaleString('pt-BR')
    : value

  return (
    <Card
      className={cn(
        'transition-all duration-300 group',
        VARIANT_STYLES[variant],
        onClick && 'cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 active:scale-[0.98]',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
      aria-label={onClick ? `${title}: ${formattedValue}` : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && (
          <Icon className={cn(
            'h-4 w-4 text-muted-foreground transition-colors',
            onClick && 'group-hover:text-primary'
          )} />
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="space-y-1">
            <div className={cn(
              'text-2xl font-bold transition-colors',
              onClick && 'group-hover:text-primary'
            )}>
              {formattedValue}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {badge && (
            <Badge variant="outline" className="ml-2">
              {badge}
            </Badge>
          )}
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 mt-2 text-xs font-medium',
            trend.isPositive !== false 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          )}>
            <TrendingUp className={cn(
              'h-3 w-3',
              trend.isPositive === false && 'rotate-180'
            )} />
            <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
            <span className="text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export interface GamificationStatsProps {
  totalXP: number
  currentLevel: number
  levelName?: string
  achievementsUnlocked: number
  totalAchievements: number
  currentStreak: number
  longestStreak?: number
  className?: string
}

export function GamificationStats({
  totalXP,
  currentLevel,
  levelName,
  achievementsUnlocked,
  totalAchievements,
  currentStreak,
  longestStreak,
  className,
}: GamificationStatsProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      <StatsCard
        title="XP Total"
        value={totalXP}
        description="Pontos acumulados"
        icon={Target}
        variant="primary"
      />
      
      <StatsCard
        title="Nível"
        value={currentLevel}
        description={levelName || 'Nível atual'}
        icon={Star}
        variant="primary"
      />
      
      <StatsCard
        title="Conquistas"
        value={`${achievementsUnlocked}/${totalAchievements}`}
        description="Badges desbloqueados"
        icon={Trophy}
        badge={`${Math.round((achievementsUnlocked / totalAchievements) * 100)}%`}
      />
      
      <StatsCard
        title="Sequência"
        value={currentStreak}
        description={longestStreak ? `Recorde: ${longestStreak} dias` : 'Dias seguidos'}
        icon={Flame}
        variant={currentStreak >= 7 ? 'warning' : 'default'}
      />
    </div>
  )
}

