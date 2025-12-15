'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TourStep {
  target: string // Seletor CSS ou ID do elemento
  content: string
  title?: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  disableBeacon?: boolean
}

export interface TourGuideProps {
  id: string // ID único para este tour (ex: 'homepage-tour', 'ai-lab-tour')
  steps: TourStep[]
  autoStart?: boolean
  onComplete?: () => void
  onSkip?: () => void
  className?: string
}

export function TourGuide({
  id,
  steps,
  autoStart = false,
  onComplete,
  onSkip,
  className,
}: TourGuideProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [hasSeenTour, setHasSeenTour] = useLocalStorage<boolean>(`tour-${id}-seen`, false)
  const [elementPosition, setElementPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoStart && !hasSeenTour) {
      // Pequeno delay para garantir que a página esteja renderizada
      const timer = setTimeout(() => {
        setIsOpen(true)
        updateElementPosition(0)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [autoStart, hasSeenTour])

  const updateElementPosition = useCallback((stepIndex: number) => {
    const step = steps[stepIndex]
    if (!step) return

    const target = step.target.startsWith('#') || step.target.startsWith('.')
      ? step.target
      : `#${step.target}`

    const element = document.querySelector(target) as HTMLElement
    if (element) {
      const rect = element.getBoundingClientRect()
      setElementPosition({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      })
    } else {
      setElementPosition(null)
    }
  }, [steps])

  useEffect(() => {
    if (isOpen && currentStep < steps.length) {
      updateElementPosition(currentStep)
      
      const handleResize = () => updateElementPosition(currentStep)
      window.addEventListener('resize', handleResize)
      window.addEventListener('scroll', handleResize)
      
      return () => {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('scroll', handleResize)
      }
    }
  }, [isOpen, currentStep, updateElementPosition, steps.length])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
      updateElementPosition(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      updateElementPosition(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setIsOpen(false)
    setHasSeenTour(true)
    if (onComplete) {
      onComplete()
    }
  }

  const handleSkip = () => {
    setIsOpen(false)
    setHasSeenTour(true)
    if (onSkip) {
      onSkip()
    }
  }

  const currentStepData = steps[currentStep]

  if (!isOpen || !currentStepData) {
    return null
  }

  return (
    <>
      {/* Overlay escuro com spotlight */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={handleSkip}
        style={{
          clipPath: elementPosition
            ? `polygon(
                0% 0%,
                0% 100%,
                ${elementPosition.left}px 100%,
                ${elementPosition.left}px ${elementPosition.top}px,
                ${elementPosition.left + elementPosition.width}px ${elementPosition.top}px,
                ${elementPosition.left + elementPosition.width}px ${elementPosition.top + elementPosition.height}px,
                ${elementPosition.left}px ${elementPosition.top + elementPosition.height}px,
                ${elementPosition.left}px 100%,
                100% 100%,
                100% 0%
              )`
            : undefined,
        }}
      />

      {/* Tooltip do tour */}
      {elementPosition && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: elementPosition.top + elementPosition.height + 16,
            left: elementPosition.left,
            maxWidth: '400px',
          }}
        >
          <div className="bg-background border-2 border-primary rounded-lg shadow-2xl p-6 pointer-events-auto space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                {currentStepData.title && (
                  <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {currentStepData.title}
                  </DialogTitle>
                )}
                <DialogDescription className="text-sm text-muted-foreground">
                  {currentStepData.content}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={handleSkip}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                Passo {currentStep + 1} de {steps.length}
              </div>
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Voltar
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                >
                  {currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Hook para gerenciar múltiplos tours
export function useTourGuide(tourId: string) {
  const [hasSeenTour, setHasSeenTour] = useLocalStorage<boolean>(`tour-${tourId}-seen`, false)

  const startTour = useCallback(() => {
    setHasSeenTour(false)
  }, [setHasSeenTour])

  const resetTour = useCallback(() => {
    setHasSeenTour(false)
  }, [setHasSeenTour])

  return {
    hasSeenTour,
    startTour,
    resetTour,
  }
}

