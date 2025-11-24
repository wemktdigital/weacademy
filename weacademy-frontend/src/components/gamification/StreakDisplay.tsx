'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Flame } from 'lucide-react'

export interface StreakDisplayProps {
  currentStreak: number
  longestStreak?: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'badge' | 'compact' | 'detailed'
  className?: string
}

const SIZE_STYLES = {
  sm: {
    icon: 'h-3 w-3',
    text: 'text-xs',
    badge: 'text-xs px-2 py-0.5',
  },
  md: {
    icon: 'h-4 w-4',
    text: 'text-sm',
    badge: 'text-sm px-2.5 py-1',
  },
  lg: {
    icon: 'h-5 w-5',
    text: 'text-base',
    badge: 'text-base px-3 py-1.5',
  },
}

export function StreakDisplay({
  currentStreak,
  longestStreak,
  showLabel = true,
  size = 'md',
  variant = 'badge',
  className,
}: StreakDisplayProps) {
  const styles = SIZE_STYLES[size]
  const isHot = currentStreak >= 7
  const isOnFire = currentStreak >= 30

  if (variant === 'compact') {
    return (
      <div 
        className={cn('inline-flex items-center gap-1', className)}
        aria-label={`Sequência de ${currentStreak} ${currentStreak === 1 ? 'dia' : 'dias'}`}
        role="text"
      >
        <Flame
          className={cn(
            styles.icon,
            isOnFire ? 'text-orange-500 motion-safe:animate-pulse' : isHot ? 'text-orange-500' : 'text-muted-foreground',
            'transition-colors duration-300'
          )}
          aria-hidden="true"
        />
        <span className={cn('font-semibold', styles.text)}>{currentStreak}</span>
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div 
        className={cn('space-y-2', className)}
        aria-label={`Sequência de ${currentStreak} ${currentStreak === 1 ? 'dia' : 'dias'}${longestStreak !== undefined && longestStreak > currentStreak ? `, recorde de ${longestStreak} dias` : ''}`}
        role="text"
      >
        <div className="flex items-center gap-2">
          <Flame
            className={cn(
              styles.icon,
              isOnFire ? 'text-orange-500 motion-safe:animate-pulse' : isHot ? 'text-orange-500' : 'text-muted-foreground',
              'transition-colors duration-300'
            )}
            aria-hidden="true"
          />
          <div>
            <p className={cn('font-semibold', styles.text)}>
              {currentStreak} dia{currentStreak !== 1 ? 's' : ''} seguidos
            </p>
            {longestStreak !== undefined && longestStreak > currentStreak && (
              <p className={cn('text-muted-foreground', styles.text)}>
                Recorde: {longestStreak} dias
              </p>
            )}
          </div>
        </div>
        {isHot && (
          <p className={cn('text-orange-500 font-medium', styles.text)} aria-hidden="true">
            {isOnFire ? '🔥 Em chamas!' : '🔥 Sequência quente!'}
          </p>
        )}
      </div>
    )
  }

  // Default: badge variant
  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1.5 transition-all duration-300',
        styles.badge,
        isOnFire && 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
        isHot && !isOnFire && 'border-orange-400 bg-orange-50/50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400',
        className
      )}
      role="text"
      aria-label={`Sequência de ${currentStreak} ${currentStreak === 1 ? 'dia' : 'dias'}`}
    >
      <Flame
        className={cn(
          styles.icon,
          (isOnFire || isHot) ? 'text-orange-500' : 'text-muted-foreground',
          isOnFire && 'motion-safe:animate-pulse',
          'transition-colors duration-300'
        )}
        aria-hidden="true"
      />
      {showLabel ? (
        <>
          <span>{currentStreak}</span>
          <span className="text-muted-foreground">dias</span>
        </>
      ) : (
        <span>{currentStreak}</span>
      )}
    </Badge>
  )
}

