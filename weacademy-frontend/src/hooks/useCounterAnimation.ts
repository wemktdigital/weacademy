'use client'

import { useEffect, useRef, useState } from 'react'

interface UseCounterAnimationOptions {
  duration?: number
  startValue?: number
  endValue: number
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  onComplete?: () => void
}

export function useCounterAnimation({
  duration = 1000,
  startValue = 0,
  endValue,
  easing = 'easeOut',
  onComplete,
}: UseCounterAnimationOptions) {
  const [value, setValue] = useState(startValue)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Funções de easing
  const easingFunctions = {
    linear: (t: number) => t,
    easeIn: (t: number) => t * t,
    easeOut: (t: number) => t * (2 - t),
    easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  }

  useEffect(() => {
    if (startValue === endValue) {
      setValue(endValue)
      return
    }

    startTimeRef.current = Date.now()
    const startVal = startValue
    const endVal = endValue
    const diff = endVal - startVal
    const easingFn = easingFunctions[easing]

    const animate = () => {
      const now = Date.now()
      const elapsed = now - (startTimeRef.current || 0)
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easingFn(progress)

      const currentValue = Math.round(startVal + diff * easedProgress)
      setValue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setValue(endVal)
        onComplete?.()
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [startValue, endValue, duration, easing, onComplete])

  // Função para resetar e animar para um novo valor
  const resetAndAnimate = (newEndValue: number, newStartValue?: number) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    setValue(newStartValue ?? endValue)
    // Trigger re-animation via effect
    setTimeout(() => {
      startTimeRef.current = Date.now()
      const startVal = newStartValue ?? endValue
      const endVal = newEndValue
      const diff = endVal - startVal
      const easingFn = easingFunctions[easing]

      const animate = () => {
        const now = Date.now()
        const elapsed = now - (startTimeRef.current || 0)
        const progress = Math.min(elapsed / duration, 1)
        const easedProgress = easingFn(progress)

        const currentValue = Math.round(startVal + diff * easedProgress)
        setValue(currentValue)

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          setValue(endVal)
          onComplete?.()
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }, 10)
  }

  return { value, resetAndAnimate }
}

