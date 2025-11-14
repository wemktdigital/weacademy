'use client'

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Loader2, CheckCircle2, XCircle, Rocket, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface PipelineTesterProps {
  pipelineId: string
  pipelineName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onTestSuccess?: () => void
}

interface TestStep {
  agent_id: string
  agent_name: string
  agent_icon: string
  output: string
  latency: number
  cost: number
}

interface TestResult {
  success: boolean
  steps: TestStep[]
  metrics: {
    steps_executed: number
    total_latency_ms: number
    total_cost_usd: number
  }
}

interface ProgressStep {
  agent_name: string
  agent_icon?: string
  status: 'pending' | 'running' | 'completed' | 'error'
  output_preview?: string
}

export function PipelineTester({
  pipelineId,
  pipelineName,
  open,
  onOpenChange,
  onTestSuccess,
}: PipelineTesterProps) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [totalSteps, setTotalSteps] = useState<number>(0)
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleTest = async () => {
    if (!message.trim()) {
      toast.error('Digite uma mensagem para testar o pipeline')
      return
    }

    if (!pipelineId) {
      toast.error('ID do pipeline não fornecido')
      console.error('[PipelineTester] Pipeline ID não fornecido:', { pipelineId, pipelineName })
      return
    }

    // Limpar estado anterior
    setLoading(true)
    setResult(null)
    setCurrentStep(0)
    setTotalSteps(0)
    setProgressSteps([])

    // Abortar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Criar novo AbortController
    abortControllerRef.current = new AbortController()

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      console.log('[PipelineTester] Iniciando teste:', {
        pipelineId,
        pipelineName,
        hasToken: !!token,
      })

      const response = await fetch(`/api/lab-ia/admin/pipelines/${pipelineId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({ message }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      // Processar stream SSE
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'progress') {
                const progressData = data.data
                setCurrentStep(progressData.step)
                setTotalSteps(progressData.totalSteps)

                // Atualizar progressSteps
                setProgressSteps((prev) => {
                  const newSteps = [...prev]
                  const stepIndex = progressData.step - 1

                  // Garantir que temos espaço suficiente
                  while (newSteps.length < progressData.totalSteps) {
                    newSteps.push({
                      agent_name: '',
                      status: 'pending',
                    })
                  }

                  if (progressData.status === 'running') {
                    newSteps[stepIndex] = {
                      agent_name: progressData.agentName || 'Agente Desconhecido',
                      agent_icon: progressData.agentIcon || '',
                      status: 'running',
                    }
                  } else if (progressData.status === 'completed') {
                    newSteps[stepIndex] = {
                      agent_name: progressData.agentName || 'Agente Desconhecido',
                      agent_icon: progressData.agentIcon || '',
                      status: 'completed',
                      output_preview: progressData.output || '',
                    }
                  } else if (progressData.status === 'error') {
                    newSteps[stepIndex] = {
                      agent_name: progressData.agentName || 'Agente Desconhecido',
                      agent_icon: progressData.agentIcon || '',
                      status: 'error',
                    }
                  }

                  return newSteps
                })
              } else if (data.type === 'done') {
                const finalData = data.data
                setResult(finalData)
                toast.success(`Pipeline testado com sucesso! ${finalData.metrics.steps_executed} etapa(s) executadas.`)
                
                if (onTestSuccess) {
                  onTestSuccess()
                }
                setLoading(false)
              } else if (data.type === 'error') {
                throw new Error(data.data.error || 'Erro ao testar pipeline')
              }
            } catch (parseError) {
              console.error('[PipelineTester] Erro ao processar evento SSE:', parseError)
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[PipelineTester] Requisição cancelada')
        return
      }
      console.error('Error testing pipeline:', error)
      toast.error(error.message || 'Erro ao testar pipeline')
      setLoading(false)
    } finally {
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setLoading(false)
      toast.info('Teste cancelado')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(value)
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
    return `${(ms / 60000).toFixed(2)}min`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Testar Pipeline
          </DialogTitle>
          <DialogDescription>
            Teste o pipeline <strong>{pipelineName}</strong> antes de torná-lo ativo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input para mensagem de teste */}
          <div className="space-y-2">
            <Label htmlFor="test-message">Mensagem de Teste *</Label>
            <Textarea
              id="test-message"
              placeholder="Digite uma mensagem para testar o pipeline..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Resultado do teste */}
          {result && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">Resultado do Teste</h3>
              </div>

              {/* Métricas gerais */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-background rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {result.metrics.steps_executed}
                  </div>
                  <div className="text-xs text-muted-foreground">Etapas</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {formatDuration(result.metrics.total_latency_ms)}
                  </div>
                  <div className="text-xs text-muted-foreground">Tempo Total</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(result.metrics.total_cost_usd)}
                  </div>
                  <div className="text-xs text-muted-foreground">Custo Total</div>
                </div>
              </div>

              {/* Steps */}
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {result.steps.map((step, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-background">
                      <div className="flex items-start gap-3 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          Etapa {index + 1}
                        </Badge>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{step.agent_icon}</span>
                            <span className="font-medium">{step.agent_name}</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-4">
                          <span>⏱️ {formatDuration(step.latency)}</span>
                          <span>💰 {formatCurrency(step.cost)}</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {step.output}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Progresso em tempo real */}
          {loading && (currentStep > 0 || totalSteps > 0) && (
            <Card className="p-4 bg-muted/30 border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Pipeline: {pipelineName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {currentStep === 0 
                      ? 'Iniciando pipeline...' 
                      : `Executando etapa ${currentStep} de ${totalSteps}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {currentStep}/{totalSteps}
                  </Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancel}
                    className="h-7 px-3 text-xs"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>

              {progressSteps.length > 0 && (
                <div className="space-y-2 mt-4">
                  {progressSteps.map((step, index) => {
                    const stepNumber = index + 1
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
                      StatusIcon = XCircle
                      statusClass = 'text-red-600'
                      statusText = 'Erro'
                    }

                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          step.status === 'running' ? 'bg-primary/5' : ''
                        }`}
                      >
                        <StatusIcon className={`h-4 w-4 ${statusClass}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {step.agent_icon && <span className="text-sm">{step.agent_icon}</span>}
                            <span className="text-sm font-medium truncate">
                              {step.agent_name || `Etapa ${stepNumber}`}
                            </span>
                          </div>
                          {step.output_preview && step.status === 'completed' && (
                            <p className="text-xs text-muted-foreground truncate">
                              {step.output_preview}
                            </p>
                          )}
                        </div>
                        {step.status !== 'pending' && (
                          <span className="text-xs text-muted-foreground">{statusText}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Loading simples (sem progresso ainda) */}
          {loading && currentStep === 0 && totalSteps === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Iniciando teste...</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              // Cancelar requisição se estiver em andamento
              if (loading && abortControllerRef.current) {
                abortControllerRef.current.abort()
              }
              setMessage('')
              setResult(null)
              setCurrentStep(0)
              setTotalSteps(0)
              setProgressSteps([])
              onOpenChange(false)
            }}
            disabled={loading}
          >
            Fechar
          </Button>
          <Button 
            onClick={loading ? handleCancel : handleTest} 
            disabled={!loading && !message.trim()}
            variant={loading ? 'destructive' : 'default'}
          >
            {loading ? (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Executar Teste
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

