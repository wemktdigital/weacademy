'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useConfetti } from '@/hooks/useConfetti'

export interface AchievementBadgeProps {
  icon: string
  name: string
  description?: string
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
  unlocked?: boolean
  unlockedAt?: string | null
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  className?: string
  onClick?: () => void
  'aria-label'?: string
  playUnlockAnimation?: boolean // Novo prop para controlar animação ao desbloquear
}

const RARITY_STYLES = {
  common: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600',
  rare: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  epic: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
  legendary: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700 shadow-lg shadow-yellow-500/20',
}

const RARITY_ANIMATION = {
  common: '',
  rare: 'motion-safe:animate-pulse',
  epic: 'motion-safe:animate-pulse',
  legendary: 'motion-safe:animate-pulse shadow-lg shadow-yellow-500/30',
}

const RARITY_GLOW = {
  common: '',
  rare: 'motion-safe:shadow-blue-500/20 motion-safe:shadow-[0_0_20px_rgba(59,130,246,0.3)]',
  epic: 'motion-safe:shadow-purple-500/30 motion-safe:shadow-[0_0_25px_rgba(139,92,246,0.4)]',
  legendary: 'motion-safe:shadow-yellow-500/40 motion-safe:shadow-[0_0_30px_rgba(234,179,8,0.5)] motion-safe:ring-2 motion-safe:ring-yellow-400/30 motion-safe:ring-[3px]',
}

const SIZE_STYLES = {
  sm: 'w-12 h-12 text-lg',
  md: 'w-16 h-16 text-2xl',
  lg: 'w-24 h-24 text-4xl',
}

export function AchievementBadge({
  icon,
  name,
  description,
  rarity = 'common',
  unlocked = true,
  unlockedAt,
  size = 'md',
  showTooltip = true,
  className,
  onClick,
  'aria-label': ariaLabel,
  playUnlockAnimation = false,
}: AchievementBadgeProps) {
  const { fireFromElement } = useConfetti()
  const badgeRef = useRef<HTMLDivElement>(null)
  const previousUnlockedRef = useRef(unlocked)

  // Disparar confetti ao desbloquear
  useEffect(() => {
    if (playUnlockAnimation && unlocked && !previousUnlockedRef.current && rarity !== 'common') {
      const confettiType = rarity === 'legendary' ? 'legendary' : rarity === 'epic' ? 'epic' : 'rare'
      setTimeout(() => {
        fireFromElement(badgeRef.current, { type: confettiType })
      }, 100)
    }
    previousUnlockedRef.current = unlocked
  }, [unlocked, rarity, playUnlockAnimation, fireFromElement])

  const defaultAriaLabel = unlocked
    ? `Achievement ${name}, raridade ${rarity}${description ? `, ${description}` : ''}`
    : `Achievement bloqueado: ${name}`

  const badge = (
    <div
      ref={badgeRef}
      className={cn(
        'relative flex items-center justify-center rounded-full border-2 transition-all duration-300',
        SIZE_STYLES[size],
        unlocked
          ? cn(RARITY_STYLES[rarity], RARITY_GLOW[rarity])
          : 'bg-muted text-muted-foreground border-muted-foreground/20 opacity-50 grayscale',
        unlocked && rarity !== 'common' && RARITY_ANIMATION[rarity],
        unlocked && rarity === 'legendary' && 'motion-safe:animate-[glow_2s_ease-in-out_infinite]',
        onClick && 'cursor-pointer motion-safe:hover:scale-110 motion-safe:hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : 'img'}
      aria-label={ariaLabel || defaultAriaLabel}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
    >
      <span className="select-none" aria-hidden="true">{icon || '🏆'}</span>
      {!unlocked && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="text-xs font-bold opacity-50">?</span>
        </div>
      )}
      {unlocked && rarity === 'legendary' && (
        <div className="absolute inset-0 rounded-full border-2 border-yellow-400 motion-safe:animate-ping opacity-20 pointer-events-none" aria-hidden="true" />
      )}
    </div>
  )

  if (showTooltip && unlocked && (name || description)) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold">{name}</p>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
              {unlockedAt && (
                <p className="text-xs text-muted-foreground">
                  Desbloqueado em: {new Date(unlockedAt).toLocaleDateString('pt-BR')}
                </p>
              )}
              <Badge variant="outline" className="mt-1">
                {rarity}
              </Badge>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}

