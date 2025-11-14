'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Check, X, Zap, DollarSign } from 'lucide-react'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'
import { ModelRecommendation } from '@/modules/laboratorio-ia/services/intelligentRouter'

interface ModelRecommendationCardProps {
  recommendation: ModelRecommendation
  alternatives: ModelRecommendation[]
  currentProvider: string
  currentModel: string
  onAccept: (provider: string, model: string) => void
  onDismiss: () => void
  onViewAlternatives?: () => void
  showAlternatives?: boolean
}

export function ModelRecommendationCard({
  recommendation,
  alternatives,
  currentProvider,
  currentModel,
  onAccept,
  onDismiss,
  onViewAlternatives,
  showAlternatives = false,
}: ModelRecommendationCardProps) {
  const recommendedModel = AVAILABLE_MODELS.find(
    m => m.provider === recommendation.provider && m.model === recommendation.model
  )

  const isDifferentFromCurrent = 
    recommendation.provider.toLowerCase() !== currentProvider.toLowerCase() ||
    recommendation.model !== currentModel

  if (!isDifferentFromCurrent) {
    return null // Não mostrar se já está usando o modelo recomendado
  }

  return (
    <Card className="mb-4 border-primary/50 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Recomendação Automática de Modelo
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <CardDescription className="text-xs">
          Detectamos que este modelo pode ser melhor para sua tarefa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Modelo Recomendado */}
        <div className="flex items-center justify-between rounded-lg border bg-background p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <span className="text-lg">{recommendedModel?.icon || '🤖'}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{recommendedModel?.displayName || recommendation.model}</span>
                <Badge variant="secondary" className="text-xs">
                  Score: {recommendation.score}/100
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{recommendation.reason}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => onAccept(recommendation.provider, recommendation.model)}
            className="gap-2"
          >
            <Check className="h-3 w-3" />
            Usar
          </Button>
        </div>

        {/* Alternativas */}
        {showAlternatives && alternatives.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Outras opções:</p>
            {alternatives.slice(0, 2).map((alt, idx) => {
              const altModel = AVAILABLE_MODELS.find(
                m => m.provider === alt.provider && m.model === alt.model
              )
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border bg-background/50 p-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>{altModel?.icon || '🤖'}</span>
                    <span className="text-xs">{altModel?.displayName || alt.model}</span>
                    <Badge variant="outline" className="text-xs">
                      {alt.score}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAccept(alt.provider, alt.model)}
                    className="h-7 text-xs"
                  >
                    Usar
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {!showAlternatives && alternatives.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAlternatives}
            className="w-full text-xs"
          >
            Ver {alternatives.length} alternativa{alternatives.length > 1 ? 's' : ''}
          </Button>
        )}

        {/* Informações adicionais */}
        {(recommendation.estimatedCost !== undefined || recommendation.estimatedLatency !== undefined) && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {recommendation.estimatedCost !== undefined && (
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span>~${recommendation.estimatedCost.toFixed(4)}</span>
              </div>
            )}
            {recommendation.estimatedLatency !== undefined && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>~{recommendation.estimatedLatency}ms</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

