'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Coins, TrendingUp } from 'lucide-react'
import { useCounterAnimation } from '@/hooks/useCounterAnimation'

export interface PointsDisplayProps {
  points: number
  showIcon?: boolean
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact' | 'highlight'
  className?: string
  animated?: boolean
  animateCounter?: boolean // Novo prop para animação de contador
}

const SIZE_STYLES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

const VARIANT_STYLES = {
  default: 'text-foreground',
  compact: 'text-muted-foreground text-sm',
  highlight: 'text-primary font-bold',
}

export function PointsDisplay({
  points,
  showIcon = true,
  showLabel = false,
  size = 'md',
  variant = 'default',
  className,
  animated = false,
  animateCounter = false,
}: PointsDisplayProps) {
  const [displayPoints, setDisplayPoints] = useState(points)
  const previousPointsRef = useRef(points)

  // Animar contador quando pontos mudarem
  useEffect(() => {
    if (animateCounter && points !== previousPointsRef.current) {
      const startValue = previousPointsRef.current
      const endValue = points
      const duration = Math.min(Math.abs(endValue - startValue) * 5, 1000) // Máximo 1 segundo
      const steps = 30
      const stepSize = (endValue - startValue) / steps
      let currentStep = 0

      const interval = setInterval(() => {
        currentStep++
        const currentValue = Math.round(startValue + stepSize * currentStep)
        setDisplayPoints(currentValue)

        if (currentStep >= steps) {
          setDisplayPoints(endValue)
          previousPointsRef.current = endValue
          clearInterval(interval)
        }
      }, duration / steps)

      return () => clearInterval(interval)
    } else {
      setDisplayPoints(points)
      previousPointsRef.current = points
    }
  }, [points, animateCounter])

  const formattedPoints = displayPoints.toLocaleString('pt-BR')

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5',
        SIZE_STYLES[size],
        VARIANT_STYLES[variant],
        animated && 'motion-safe:animate-pulse',
        'transition-all duration-300',
        className
      )}
      aria-label={`${formattedPoints} pontos de experiência`}
      role="text"
    >
      {showIcon && (
        <Coins
          className={cn(
            'text-primary transition-transform duration-300',
            animateCounter && points > previousPointsRef.current && 'motion-safe:scale-110',
            size === 'sm' && 'h-3 w-3',
            size === 'md' && 'h-4 w-4',
            size === 'lg' && 'h-5 w-5'
          )}
          aria-hidden="true"
        />
      )}
      <span className="font-semibold transition-all duration-300">
        {formattedPoints}
      </span>
      {showLabel && <span className="text-muted-foreground">XP</span>}
    </div>
  )
}

export interface PointsChangeDisplayProps {
  points: number
  type?: 'earned' | 'spent' | 'bonus'
  animated?: boolean
  className?: string
}

export function PointsChangeDisplay({
  points,
  type = 'earned',
  animated = true,
  className,
}: PointsChangeDisplayProps) {
  const isPositive = type === 'earned' || type === 'bonus'
  const prefix = isPositive ? '+' : '-'
  const color = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 font-semibold transition-all duration-300',
        color,
        animated && 'motion-safe:animate-bounce',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={`${isPositive ? 'Ganhou' : 'Perdeu'} ${Math.abs(points).toLocaleString('pt-BR')} pontos de experiência`}
    >
      {type === 'bonus' && <TrendingUp className="h-4 w-4" aria-hidden="true" />}
      <span>
        {prefix}
        {Math.abs(points).toLocaleString('pt-BR')} XP
      </span>
    </div>
  )
}

