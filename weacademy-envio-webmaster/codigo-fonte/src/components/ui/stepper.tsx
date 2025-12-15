'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Loader2, ChevronRight } from 'lucide-react'

export interface StepperStep {
  id: string
  label: string
  description?: string
  optional?: boolean
}

export interface StepperProps {
  steps: StepperStep[]
  currentStep: number
  onStepClick?: (stepIndex: number) => void
  completedSteps?: number[]
  allowNavigation?: boolean
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

export function Stepper({
  steps,
  currentStep,
  onStepClick,
  completedSteps = [],
  allowNavigation = false,
  className,
  orientation = 'horizontal',
}: StepperProps) {
  const isStepCompleted = (index: number) => completedSteps.includes(index) || index < currentStep
  const isStepCurrent = (index: number) => index === currentStep
  const canNavigateToStep = (index: number) => allowNavigation && (isStepCompleted(index) || index <= currentStep)

  if (orientation === 'vertical') {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        {steps.map((step, index) => {
          const completed = isStepCompleted(index)
          const current = isStepCurrent(index)
          const canNavigate = canNavigateToStep(index)

          return (
            <div key={step.id} className="flex gap-4">
              {/* Linha vertical */}
              {index < steps.length - 1 && (
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors',
                    completed
                      ? 'bg-primary border-primary text-primary-foreground'
                      : current
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-background border-muted-foreground/30 text-muted-foreground'
                  )}>
                    {completed ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : current ? (
                      <Circle className="h-4 w-4 fill-current" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <div className={cn(
                    'w-0.5 flex-1 my-2 transition-colors',
                    completed || index < currentStep
                      ? 'bg-primary'
                      : 'bg-muted-foreground/20'
                  )} />
                </div>
              )}

              {/* Conteúdo do passo */}
              <div className={cn(
                'flex-1 pb-4',
                index === steps.length - 1 && 'pb-0'
              )}>
                <button
                  type="button"
                  onClick={() => canNavigate && onStepClick?.(index)}
                  disabled={!canNavigate}
                  className={cn(
                    'text-left w-full transition-colors',
                    canNavigate && 'cursor-pointer hover:text-primary',
                    !canNavigate && 'cursor-not-allowed'
                  )}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <h3 className={cn(
                      'font-semibold',
                      current && 'text-primary',
                      completed && 'text-foreground',
                      !current && !completed && 'text-muted-foreground'
                    )}>
                      {step.label}
                      {step.optional && (
                        <span className="text-xs font-normal text-muted-foreground ml-2">
                          (Opcional)
                        </span>
                      )}
                    </h3>
                  </div>
                  {step.description && (
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Horizontal (padrão)
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => {
          const completed = isStepCompleted(index)
          const current = isStepCurrent(index)
          const canNavigate = canNavigateToStep(index)
          const isLast = index === steps.length - 1

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-1">
                <button
                  type="button"
                  onClick={() => canNavigate && onStepClick?.(index)}
                  disabled={!canNavigate}
                  className={cn(
                    'flex flex-col items-center gap-2 transition-all',
                    canNavigate && 'cursor-pointer hover:scale-105',
                    !canNavigate && 'cursor-not-allowed'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                    completed
                      ? 'bg-primary border-primary text-primary-foreground'
                      : current
                      ? 'bg-primary/10 border-primary text-primary scale-110'
                      : 'bg-background border-muted-foreground/30 text-muted-foreground'
                  )}>
                    {completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className={cn(
                        'text-sm font-semibold',
                        current && 'text-primary'
                      )}>
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      'text-sm font-medium',
                      current && 'text-primary',
                      completed && 'text-foreground',
                      !current && !completed && 'text-muted-foreground'
                    )}>
                      {step.label}
                    </p>
                    {step.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                    )}
                  </div>
                </button>
              </div>
              {!isLast && (
                <div className={cn(
                  'h-0.5 flex-1 mx-2 mt-[-20px] transition-colors',
                  completed || index < currentStep
                    ? 'bg-primary'
                    : 'bg-muted-foreground/20'
                )} aria-hidden="true" />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

