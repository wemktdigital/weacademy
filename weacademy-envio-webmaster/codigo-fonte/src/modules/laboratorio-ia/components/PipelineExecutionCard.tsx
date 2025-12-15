'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, DollarSign, CheckCircle2, XCircle, Eye } from 'lucide-react'
// Função auxiliar para formatar data relativa
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'há poucos segundos'
  if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} minutos`
  if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)} horas`
  if (diffInSeconds < 2592000) return `há ${Math.floor(diffInSeconds / 86400)} dias`
  if (diffInSeconds < 31536000) return `há ${Math.floor(diffInSeconds / 2592000)} meses`
  return `há ${Math.floor(diffInSeconds / 31536000)} anos`
}

interface PipelineExecutionCardProps {
  execution: {
    id: string | number
    created_at: string
    steps_executed: number
    total_latency_ms: number
    total_cost_usd: number | string
    pipeline?: {
      id: string
      name: string
      description?: string
    } | null
    user?: {
      id: string
      email?: string
      full_name?: string
    } | null
    output_messages?: any[]
    input_messages?: any[]
  }
  onViewDetails?: (execution: any) => void
  showUser?: boolean
}

export function PipelineExecutionCard({ execution, onViewDetails, showUser = false }: PipelineExecutionCardProps) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  }

  const formatCost = (cost: number | string) => {
    const numCost = typeof cost === 'string' ? parseFloat(cost) : cost
    if (numCost === 0 || isNaN(numCost)) return 'Grátis'
    if (numCost < 0.01) return `$${(numCost * 1000).toFixed(2)} mil`
    return `$${numCost.toFixed(4)}`
  }

  const hasError = execution.steps_executed === 0 || 
                   (execution.output_messages && execution.output_messages.length === 0)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate mb-1">
              {execution.pipeline?.name || 'Pipeline Desconhecido'}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {formatTimeAgo(new Date(execution.created_at))}
            </p>
          </div>
          <Badge variant={hasError ? 'destructive' : 'default'} className="ml-2">
            {hasError ? (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Erro
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Sucesso
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Métricas */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Duração</p>
                <p className="text-sm font-medium">{formatDuration(execution.total_latency_ms)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Custo</p>
                <p className="text-sm font-medium">{formatCost(execution.total_cost_usd)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Etapas</p>
              <p className="text-sm font-medium">{execution.steps_executed}</p>
            </div>
          </div>

          {/* Info do usuário (se admin) */}
          {showUser && execution.user && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">Usuário</p>
              <p className="text-sm font-medium">
                {execution.user.full_name || execution.user.email || 'Usuário desconhecido'}
              </p>
            </div>
          )}

          {/* Botão de detalhes */}
          {onViewDetails && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => onViewDetails(execution)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver Detalhes
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

