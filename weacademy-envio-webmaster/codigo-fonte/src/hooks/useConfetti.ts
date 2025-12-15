'use client'

import { useCallback } from 'react'
import confetti from 'canvas-confetti'

export type ConfettiType = 'achievement' | 'level-up' | 'rare' | 'epic' | 'legendary'

interface ConfettiOptions {
  type?: ConfettiType
  particleCount?: number
  spread?: number
  origin?: { x: number; y: number }
  colors?: string[]
}

export function useConfetti() {
  const fire = useCallback((options: ConfettiOptions = {}) => {
    const {
      type = 'achievement',
      particleCount = 50,
      spread = 70,
      origin = { x: 0.5, y: 0.5 },
      colors,
    } = options

    // Configurações por tipo
    const typeConfigs: Record<ConfettiType, Partial<ConfettiOptions>> = {
      achievement: {
        particleCount: 50,
        spread: 70,
        colors: ['#10b981', '#3b82f6', '#8b5cf6'],
      },
      'level-up': {
        particleCount: 100,
        spread: 70,
        colors: ['#fbbf24', '#f59e0b', '#d97706', '#10b981'],
      },
      rare: {
        particleCount: 75,
        spread: 70,
        colors: ['#3b82f6', '#2563eb', '#1e40af'],
      },
      epic: {
        particleCount: 100,
        spread: 70,
        colors: ['#8b5cf6', '#7c3aed', '#6d28d9'],
      },
      legendary: {
        particleCount: 150,
        spread: 90,
        colors: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#fde047'],
      },
    }

    const config = typeConfigs[type]
    const finalColors = colors || config.colors || ['#10b981']

    // Disparar confetti do centro
    confetti({
      particleCount: particleCount || config.particleCount || 50,
      spread: spread || config.spread || 70,
      origin,
      colors: finalColors,
      gravity: 0.8,
      decay: 0.9,
    })

    // Para legendary, disparar múltiplos bursts
    if (type === 'legendary') {
      setTimeout(() => {
        confetti({
          particleCount: 100,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: finalColors,
        })
        confetti({
          particleCount: 100,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: finalColors,
        })
      }, 250)
    }
  }, [])

  const fireFromElement = useCallback((element: HTMLElement | null, options: ConfettiOptions = {}) => {
    if (!element) {
      fire(options)
      return
    }

    const rect = element.getBoundingClientRect()
    const x = (rect.left + rect.width / 2) / window.innerWidth
    const y = (rect.top + rect.height / 2) / window.innerHeight

    fire({
      ...options,
      origin: { x, y },
    })
  }, [fire])

  return {
    fire,
    fireFromElement,
  }
}

