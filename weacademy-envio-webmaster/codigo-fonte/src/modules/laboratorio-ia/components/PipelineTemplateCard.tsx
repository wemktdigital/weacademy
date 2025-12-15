'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, Copy, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

interface PipelineTemplateCardProps {
  template: {
    id: string
    name: string
    description?: string
    category?: string
    steps: Array<{ order: number; agent_name: string }>
    agent_templates?: Array<{ name: string; template_id?: string }>
    official?: boolean
  }
  onUseAsBase?: (template: any) => void
  onCopy?: (template: any) => void
}

export function PipelineTemplateCard({ template, onUseAsBase, onCopy }: PipelineTemplateCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (onCopy) {
      onCopy(template)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const categoryColors: Record<string, string> = {
    marketing: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    educacional: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    pesquisa: 'bg-green-500/10 text-green-700 dark:text-green-400',
    compliance: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    outros: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg font-semibold truncate">
                {template.name}
              </CardTitle>
              {template.official && (
                <Badge variant="default" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Oficial
                </Badge>
              )}
            </div>
            {template.category && (
              <Badge
                variant="secondary"
                className={`text-xs mb-2 ${categoryColors[template.category] || categoryColors.outros}`}
              >
                {template.category}
              </Badge>
            )}
            {template.description && (
              <CardDescription className="mt-2 line-clamp-2">
                {template.description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Preview dos steps */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Fluxo ({template.steps.length} etapas):
            </p>
            <div className="space-y-1">
              {template.steps.map((step, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1"
                >
                  <Badge variant="outline" className="text-xs w-6 h-6 p-0 flex items-center justify-center">
                    {step.order}
                  </Badge>
                  <span className="flex-1 truncate">{step.agent_name}</span>
                  {index < template.steps.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-2 pt-2 border-t">
            {onUseAsBase && (
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => onUseAsBase(template)}
              >
                Usar como Base
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {onCopy && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={copied}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

