'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, DollarSign, Clock, Zap, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface CostEstimate {
  cost_usd: number
  latency_ms: number
  total_tokens: number
  steps_count: number
  breakdown?: Array<{
    step_order: number
    agent_id: string
    agent_name?: string
    estimated_cost_usd: number
    estimated_latency_ms: number
    estimated_tokens: number
    confidence: 'high' | 'medium' | 'low'
  }>
  formatted?: {
    cost: string
    latency: string
    tokens: string
  }
}

interface OptimizationSuggestion {
  type: string
  description: string
  potential_savings_usd: number
  impact: 'high' | 'medium' | 'low'
}

interface CostEstimateCardProps {
  pipelineId: string
  inputMessages?: Array<{ role: string; content: string }>
  onEstimateReady?: (estimate: CostEstimate) => void
  showOptimizations?: boolean
}

export function CostEstimateCard({
  pipelineId,
  inputMessages = [],
  onEstimateReady,
  showOptimizations = true,
}: CostEstimateCardProps) {
  const [loading, setLoading] = useState(true)
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([])
  const [alerts, setAlerts] = useState<Array<{ alert_type: string; message: string; severity: string }>>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEstimate()
  }, [pipelineId, inputMessages])

  const fetchEstimate = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/pipelines/${pipelineId}/estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          messages: inputMessages,
          input_length: inputMessages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao calcular estimativa')
      }

      const data = await response.json()
      
      if (data.success) {
        setEstimate(data.estimate)
        setSuggestions(data.suggestions || [])
        setAlerts(data.alerts || [])
        
        if (onEstimateReady) {
          onEstimateReady(data.estimate)
        }
      } else {
        throw new Error(data.error || 'Erro ao calcular estimativa')
      }
    } catch (err: any) {
      console.error('Erro ao buscar estimativa:', err)
      setError(err.message || 'Erro ao calcular estimativa de custo')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Calculando estimativa de custo...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950">
        <CardContent className="py-4">
          <div className="text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!estimate) {
    return null
  }

  const formattedCost = estimate.formatted?.cost || `$${estimate.cost_usd.toFixed(4)}`
  const formattedLatency = estimate.formatted?.latency || `${(estimate.latency_ms / 1000).toFixed(1)}s`
  const formattedTokens = estimate.formatted?.tokens || estimate.total_tokens.toLocaleString()

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Estimativa de Custo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas principais */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Custo Estimado</div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {formattedCost}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Tempo Estimado</div>
            <div className="text-lg font-bold flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formattedLatency}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Tokens</div>
            <div className="text-lg font-bold">
              {formattedTokens}
            </div>
          </div>
        </div>

        {/* Alertas */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  alert.severity === 'error'
                    ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                    : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold mb-1">Alerta de Custo</div>
                    <div className="text-xs">{alert.message}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Breakdown por step */}
        {estimate.breakdown && estimate.breakdown.length > 0 && (
          <div className="border-t pt-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              Custo por Step:
            </div>
            <div className="space-y-2">
              {estimate.breakdown.map((step) => (
                <div
                  key={step.step_order}
                  className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 p-2 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Step {step.step_order}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {step.agent_name || 'Agente'}
                    </span>
                    <Badge
                      variant={
                        step.confidence === 'high'
                          ? 'default'
                          : step.confidence === 'medium'
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-xs"
                    >
                      {step.confidence === 'high'
                        ? 'Alta confiança'
                        : step.confidence === 'medium'
                        ? 'Média confiança'
                        : 'Baixa confiança'}
                    </Badge>
                  </div>
                  <div className="text-xs font-semibold">
                    ${step.estimated_cost_usd.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sugestões de otimização */}
        {showOptimizations && suggestions.length > 0 && (
          <div className="border-t pt-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <TrendingDown className="h-3 w-3" />
              Sugestões de Otimização:
            </div>
            <div className="space-y-2">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 p-2 rounded text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span>{suggestion.description}</span>
                    {suggestion.potential_savings_usd > 0 && (
                      <Badge variant="outline" className="ml-2 text-xs shrink-0">
                        Economia: ${suggestion.potential_savings_usd.toFixed(4)}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {alerts.length === 0 && suggestions.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Custo dentro dos limites esperados</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

