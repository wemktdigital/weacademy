'use client'

import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Star } from 'lucide-react'

export interface LevelProgressProps {
  currentLevel: number
  levelName?: string
  currentXP: number
  nextLevelXP: number
  showLabel?: boolean
  showPercentage?: boolean
  showXPValues?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_STYLES = {
  sm: {
    progress: 'h-1.5',
    text: 'text-xs',
    badge: 'text-xs px-1.5 py-0.5',
  },
  md: {
    progress: 'h-2',
    text: 'text-sm',
    badge: 'text-sm px-2 py-1',
  },
  lg: {
    progress: 'h-3',
    text: 'text-base',
    badge: 'text-base px-3 py-1.5',
  },
}

export function LevelProgress({
  currentLevel,
  levelName,
  currentXP,
  nextLevelXP,
  showLabel = true,
  showPercentage = true,
  showXPValues = true,
  size = 'md',
  className,
}: LevelProgressProps) {
  const progress = nextLevelXP > 0 
    ? Math.min((currentXP / nextLevelXP) * 100, 100)
    : 100
  
  const xpNeeded = Math.max(nextLevelXP - currentXP, 0)

  const styles = SIZE_STYLES[size]

  return (
    <div className={cn('space-y-2', className)}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn('flex items-center gap-1', styles.badge)}>
              <Star className="h-3 w-3 fill-primary text-primary" />
              Nível {currentLevel}
            </Badge>
            {levelName && (
              <span className={cn('text-muted-foreground', styles.text)}>
                {levelName}
              </span>
            )}
          </div>
          {showPercentage && (
            <span className={cn('text-muted-foreground font-medium', styles.text)}>
              {progress.toFixed(0)}%
            </span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Nível ${currentLevel}, ${progress.toFixed(0)}% completo`}
      >
        <Progress value={progress} className={cn(styles.progress, 'transition-all duration-500 ease-out')} />
      </div>

      {showXPValues && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {currentXP.toLocaleString('pt-BR')} / {nextLevelXP.toLocaleString('pt-BR')} XP
          </span>
          {xpNeeded > 0 && (
            <span className="hidden sm:inline">
              {xpNeeded.toLocaleString('pt-BR')} XP para próximo nível
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export interface LevelBadgeProps {
  level: number
  levelName?: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

export function LevelBadge({
  level,
  levelName,
  size = 'md',
  showIcon = true,
  className,
}: LevelBadgeProps) {
  const SIZE_STYLES_BADGE = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }

  return (
    <Badge variant="secondary" className={cn('flex items-center gap-1.5', SIZE_STYLES_BADGE[size], className)}>
      {showIcon && <Star className="h-3 w-3 fill-primary text-primary" />}
      <span>Nível {level}</span>
      {levelName && (
        <>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{levelName}</span>
        </>
      )}
    </Badge>
  )
}

