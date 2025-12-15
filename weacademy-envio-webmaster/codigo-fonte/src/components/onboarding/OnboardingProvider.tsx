'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { TourGuide, TourStep } from './TourGuide'
import { Button } from '@/components/ui/button'
import { Sparkles, HelpCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface OnboardingContextType {
  startTour: (tourId: string, steps: TourStep[]) => void
  resetTour: (tourId: string) => void
  hasSeenTour: (tourId: string) => boolean
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider')
  }
  return context
}

interface OnboardingProviderProps {
  children: ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [activeTours, setActiveTours] = useState<Map<string, { steps: TourStep[]; autoStart: boolean }>>(new Map())
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false)

  const startTour = (tourId: string, steps: TourStep[]) => {
    setActiveTours(prev => new Map(prev).set(tourId, { steps, autoStart: true }))
  }

  const resetTour = (tourId: string) => {
    localStorage.removeItem(`tour-${tourId}-seen`)
    // Recarregar tour se necessário
    const tour = activeTours.get(tourId)
    if (tour) {
      setActiveTours(prev => new Map(prev).set(tourId, { ...tour, autoStart: true }))
    }
  }

  const hasSeenTour = (tourId: string) => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(`tour-${tourId}-seen`) === 'true'
  }

  return (
    <OnboardingContext.Provider value={{ startTour, resetTour, hasSeenTour }}>
      {children}
      
      {/* Renderizar todos os tours ativos */}
      {Array.from(activeTours.entries()).map(([tourId, tour]) => (
        <TourGuide
          key={tourId}
          id={tourId}
          steps={tour.steps}
          autoStart={tour.autoStart}
          onComplete={() => {
            setActiveTours(prev => {
              const newMap = new Map(prev)
              newMap.delete(tourId)
              return newMap
            })
          }}
          onSkip={() => {
            setActiveTours(prev => {
              const newMap = new Map(prev)
              newMap.delete(tourId)
              return newMap
            })
          }}
        />
      ))}
    </OnboardingContext.Provider>
  )
}

// Componente para botão de ajuda/tour
export interface HelpButtonProps {
  tourId: string
  steps: TourStep[]
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function HelpButton({ tourId, steps, className, variant = 'ghost', size = 'icon' }: HelpButtonProps) {
  const { startTour, hasSeenTour } = useOnboarding()
  const hasSeen = hasSeenTour(tourId)

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => startTour(tourId, steps)}
      className={className}
      title="Iniciar tour guiado"
    >
      <HelpCircle className="h-4 w-4" />
      {size !== 'icon' && <span className="ml-2">Ajuda</span>}
    </Button>
  )
}

