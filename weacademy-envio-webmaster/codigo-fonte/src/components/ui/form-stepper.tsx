'use client'

import * as React from 'react'
import { Stepper, type StepperStep } from './stepper'
import { Button } from './button'
import { cn } from '@/lib/utils'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'

export interface FormStepperProps {
  steps: StepperStep[]
  currentStep: number
  onStepChange: (step: number) => void
  onFinish?: () => void
  onCancel?: () => void
  isLoading?: boolean
  isValid?: boolean
  showNavigation?: boolean
  allowStepClick?: boolean
  className?: string
  children: (stepIndex: number) => React.ReactNode
}

export function FormStepper({
  steps,
  currentStep,
  onStepChange,
  onFinish,
  onCancel,
  isLoading = false,
  isValid = true,
  showNavigation = true,
  allowStepClick = false,
  className,
  children,
}: FormStepperProps) {
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1
  const completedSteps = Array.from({ length: currentStep }, (_, i) => i)

  const handlePrevious = () => {
    if (!isFirstStep) {
      onStepChange(currentStep - 1)
    }
  }

  const handleNext = () => {
    if (!isLastStep) {
      onStepChange(currentStep + 1)
    } else if (onFinish) {
      onFinish()
    }
  }

  const handleStepClick = (stepIndex: number) => {
    if (allowStepClick && (completedSteps.includes(stepIndex) || stepIndex <= currentStep)) {
      onStepChange(stepIndex)
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Stepper */}
      <Stepper
        steps={steps}
        currentStep={currentStep}
        onStepClick={handleStepClick}
        completedSteps={completedSteps}
        allowNavigation={allowStepClick}
        orientation="horizontal"
      />

      {/* Conteúdo do passo atual */}
      <div className="min-h-[300px] py-6">
        {children(currentStep)}
      </div>

      {/* Navegação */}
      {showNavigation && (
        <div className="flex items-center justify-between pt-6 border-t">
          <div>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            )}

            {!isLastStep ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={isLoading || !isValid}
              >
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onFinish}
                disabled={isLoading || !isValid}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Finalizar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

