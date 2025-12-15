'use client'

import { CheckCircle2, Loader2, Circle, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface PipelineStep {
  order?: number
  agent_id?: string
  agent_name: string
  agent_icon?: string
  status: 'pending' | 'running' | 'completed' | 'error'
  output_preview?: string
  metadata?: Record<string, any> | null
  team?: {
    key: string
    name: string
    strategy: string
    phase?: string
    summary?: string
    status?: 'ok' | 'review' | 'conflict'
    votes?: Array<{ option: number; score: number }>
  }
}

interface PipelineProgressProps {
  pipelineName: string
  totalSteps: number
  currentStep?: number
  steps?: PipelineStep[]
  onCancel?: () => void
  isCanceling?: boolean
}

export function PipelineProgress({ 
  pipelineName, 
  totalSteps, 
  currentStep, 
  steps,
  onCancel,
  isCanceling = false
}: PipelineProgressProps) {
  if (currentStep === undefined || totalSteps === 0) {
    return null
  }

  return (
    <Card className="p-4 mb-4 bg-muted/30 border-primary/20">
      <div className="flex items-center gap-3 mb-3">
        {isCanceling ? (
          <X className="h-5 w-5 text-destructive animate-pulse" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Pipeline: {pipelineName}</h3>
          <p className="text-xs text-muted-foreground">
            {isCanceling 
              ? 'Cancelando execução...' 
              : currentStep === 0 
                ? 'Iniciando pipeline...' 
                : `Executando etapa ${currentStep} de ${totalSteps}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {currentStep}/{totalSteps}
          </Badge>
          {onCancel && !isCanceling && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onCancel}
              className="h-7 px-3 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {steps && steps.length > 0 && (
        <div className="space-y-3 mt-4">
          {/* Agrupar steps por ordem (para mostrar execução paralela) */}
          {(() => {
            // Agrupar steps por ordem
            const stepsByOrder = new Map<number, PipelineStep[]>()
            steps.forEach((step) => {
              const order = step.order || 0
              if (!stepsByOrder.has(order)) {
                stepsByOrder.set(order, [])
              }
              stepsByOrder.get(order)!.push(step)
            })
            
            // Ordenar por ordem
            const sortedOrders = Array.from(stepsByOrder.keys()).sort((a, b) => a - b)
            
            return sortedOrders.map((order) => {
              const stepsAtOrder = stepsByOrder.get(order)!
              const isParallel = stepsAtOrder.length > 1
              
              return (
                <div key={order} className="space-y-2">
                  {isParallel && (
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500">
                        ⚡ Executando em paralelo ({stepsAtOrder.length} agentes)
                      </Badge>
                    </div>
                  )}
                  {stepsAtOrder.map((step, index) => {
                    let StatusIcon = Circle
                    let statusClass = 'text-muted-foreground'
                    let statusText = 'Pendente'

                    if (step.status === 'running') {
                      StatusIcon = Loader2
                      statusClass = 'text-primary animate-spin'
                      statusText = 'Executando...'
                    } else if (step.status === 'completed') {
                      StatusIcon = CheckCircle2
                      statusClass = 'text-green-600'
                      statusText = 'Concluído'
                    } else if (step.status === 'error') {
                      StatusIcon = Circle
                      statusClass = 'text-red-600'
                      statusText = 'Erro'
                    }

                    const teamStatusVariant =
                      step.team?.status === 'conflict'
                        ? 'destructive'
                        : step.team?.status === 'review'
                        ? 'secondary'
                        : 'outline'

                    const teamStatusLabel =
                      step.team?.status === 'conflict'
                        ? 'Conflito'
                        : step.team?.status === 'review'
                        ? 'Revisar'
                        : 'OK'

                    return (
                      <div
                        key={`${order}-${step.agent_id || index}`}
                        className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
                          step.status === 'running' ? 'bg-primary/5 border-primary/30' : ''
                        } ${isParallel ? 'ml-4 border-l-4 border-blue-500/30 pl-3' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <StatusIcon className={`h-4 w-4 ${statusClass}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {step.agent_icon && <span className="text-sm">{step.agent_icon}</span>}
                              <span className="text-sm font-medium truncate">{step.agent_name}</span>
                              {isParallel && order > 0 && (
                                <Badge variant="secondary" className="text-xs">#{order}</Badge>
                              )}
                            </div>
                            {step.output_preview && step.status === 'completed' && (
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                {step.output_preview}
                              </p>
                            )}
                          </div>
                          {step.status !== 'pending' && (
                            <span className="text-xs text-muted-foreground">{statusText}</span>
                          )}
                        </div>

                        {step.team && (
                          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-xs text-muted-foreground">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                Equipe {step.team.name}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                Estratégia: {step.team.strategy}
                              </Badge>
                              {step.team.phase && (
                                <Badge variant="outline" className="text-[10px]">
                                  Fase: {step.team.phase}
                                </Badge>
                              )}
                              {step.team.status && (
                                <Badge variant={teamStatusVariant} className="text-[10px]">
                                  {teamStatusLabel}
                                </Badge>
                              )}
                            </div>
                            {step.team.summary && (
                              <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                                {step.team.summary}
                              </p>
                            )}
                            {step.team.votes && step.team.votes.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {step.team.votes.map((vote, voteIndex) => (
                                  <Badge key={`${step.team?.key}-vote-${voteIndex}`} variant="outline" className="text-[10px]">
                                    Opção {vote.option + 1}: {vote.score}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })
          })()}
        </div>
      )}
    </Card>
  )
}

