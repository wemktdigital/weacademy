'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lightbulb, X, ExternalLink, ChevronRight } from 'lucide-react'
import { VeoTipsGuide } from './VeoTipsGuide'

interface ModelTip {
  icon: string
  text: string
}

interface ModelTipsCardProps {
  provider: string
  model: string
}

const VEO_TIPS: ModelTip[] = [
  {
    icon: '💡',
    text: 'Descreva ações específicas e detalhes visuais para obter melhores resultados'
  },
  {
    icon: '🎥',
    text: 'Inclua informações sobre movimento e tipo de tomada (close-up, wide shot, etc.)'
  },
  {
    icon: '🎬',
    text: 'Vídeos são gerados em 8 segundos com áudio nativo - você pode descrever diálogos e sons'
  },
  {
    icon: '⏱️',
    text: 'A geração pode levar de 11 segundos a 6 minutos, dependendo da demanda'
  }
]

export function ModelTipsCard({ provider, model }: ModelTipsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  // Verificar se é modelo VEO
  const isVeo = provider === 'Google' && (model.includes('veo') || model.includes('Veo'))
  
  // Verificar se o usuário já fechou as dicas
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('lab-veo-tips-dismissed') === 'true'
      setIsDismissed(dismissed)
    }
  }, [])

  // Se não for VEO ou se foi descartado, não mostrar
  if (!isVeo || isDismissed) {
    return null
  }

  const tips = VEO_TIPS
  const visibleTips = isExpanded ? tips : tips.slice(0, 2)

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lab-veo-tips-dismissed', 'true')
      setIsDismissed(true)
    }
  }

  return (
    <>
      <Card className="mb-4 border-primary/20 bg-primary/5">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">Dicas para gerar vídeos melhores</h4>
              </div>
              
              <div className="space-y-2">
                {visibleTips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-base flex-shrink-0">{tip.icon}</span>
                    <span>{tip.text}</span>
                  </div>
                ))}
              </div>

              {tips.length > 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs mt-1"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? 'Ver menos' : `Ver mais ${tips.length - 2} dicas`}
                  <ChevronRight className={`h-3 w-3 ml-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs mt-2"
                onClick={() => setShowGuide(true)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Ver guia completo de prompts
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={handleDismiss}
              title="Não mostrar mais"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {showGuide && (
        <VeoTipsGuide open={showGuide} onOpenChange={setShowGuide} />
      )}
    </>
  )
}

