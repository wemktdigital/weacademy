'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  MessageSquare, 
  Image, 
  FileText, 
  Music,
  Video,
  Zap,
  Lightbulb,
  DollarSign,
  Gauge,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'
import { getModelDescription } from '@/modules/laboratorio-ia/config/modelDescriptions'
import { MODEL_PRICING } from '@/modules/laboratorio-ia/config/pricing'
import type { MediaType } from '@/modules/laboratorio-ia/config/models'

interface EmptyChatStateProps {
  provider: string
  model: string
  comparisonMode?: boolean
  modelA?: { provider: string; model: string }
  modelB?: { provider: string; model: string }
}

const CAPABILITY_ICONS: Record<MediaType, any> = {
  text: FileText,
  image: Image,
  video: Video,
  audio: Music,
}

const CAPABILITY_LABELS: Record<MediaType, string> = {
  text: 'Texto',
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
}

function getCapabilityDescription(types: MediaType[], context: 'input' | 'output'): string {
  if (types.length === 0) return 'Nenhum tipo suportado.'
  
  if (context === 'input') {
    if (types.includes('audio')) {
      return 'Envie arquivos de áudio para processamento. Formatos como MP3, WAV e M4A são suportados.'
    }
    if (types.includes('image') && types.includes('text')) {
      return 'Envie mensagens de texto ou inclua imagens para análise multimodal.'
    }
    if (types.includes('image')) {
      return 'Envie imagens para processamento e análise.'
    }
    if (types.includes('video')) {
      return 'Envie vídeos ou descrições textuais para geração.'
    }
    return 'Envie mensagens de texto para processamento.'
  } else {
    if (types.includes('video')) {
      return 'O modelo gera vídeos baseados em suas descrições textuais ou imagens de referência.'
    }
    if (types.includes('image')) {
      return 'O modelo cria imagens a partir de suas descrições textuais.'
    }
    if (types.includes('audio')) {
      return 'O modelo gera conteúdo de áudio, como música ou narração.'
    }
    return 'Respostas em texto com análises, explicações e respostas contextualizadas.'
  }
}

// Helper para pegar apenas a primeira linha da descrição
function getFirstLine(text: string): string {
  // Pega a primeira frase até o primeiro ponto
  const firstSentence = text.split('.')[0].trim()
  // Se a primeira frase for muito curta (menos de 10 caracteres), pega até a segunda frase
  if (firstSentence.length < 10 && text.split('.').length > 1) {
    return text.split('.').slice(0, 2).join('.').trim() + '.'
  }
  return firstSentence + '.'
}

// Helper para calcular custo relativo entre dois modelos
function getRelativeCost(providerA: string, modelA: string, providerB: string, modelB: string): {
  costA: number
  costB: number
  cheaper: 'A' | 'B' | 'equal' | null
  difference: number | null
} {
  const keyA = `${providerA.toLowerCase()}:${modelA}`
  const keyB = `${providerB.toLowerCase()}:${modelB}`
  
  const pricingA = MODEL_PRICING[keyA]
  const pricingB = MODEL_PRICING[keyB]
  
  if (!pricingA || !pricingB) {
    return { costA: 0, costB: 0, cheaper: null, difference: null }
  }
  
  // Usar input + output como custo total aproximado
  const costA = pricingA.input + pricingA.output
  const costB = pricingB.input + pricingB.output
  
  if (costA === 0 && costB === 0) {
    return { costA: 0, costB: 0, cheaper: 'equal', difference: 0 }
  }
  
  if (costA === costB) {
    return { costA, costB, cheaper: 'equal', difference: 0 }
  }
  
  if (costA < costB) {
    const diff = ((costB - costA) / costB) * 100
    return { costA, costB, cheaper: 'A', difference: diff }
  }
  
  const diff = ((costA - costB) / costA) * 100
  return { costA, costB, cheaper: 'B', difference: diff }
}

export function EmptyChatState({ 
  provider, 
  model, 
  comparisonMode = false,
  modelA,
  modelB 
}: EmptyChatStateProps) {
  // Todos os hooks devem ser chamados antes de qualquer retorno condicional
  const [expandedModel, setExpandedModel] = useState<'A' | 'B' | null>(null)
  
  // Buscar modelo nos modelos disponíveis (sempre chamado, mesmo em modo comparação)
  const modelData = useMemo(() => {
    return AVAILABLE_MODELS.find(
      m => m.provider === provider && m.model === model
    )
  }, [provider, model])

  // Modo de comparação: renderizar versão compacta dos dois modelos
  if (comparisonMode && modelA && modelB) {
    const modelAData = AVAILABLE_MODELS.find(
      m => m.provider === modelA.provider && m.model === modelA.model
    )
    const modelBData = AVAILABLE_MODELS.find(
      m => m.provider === modelB.provider && m.model === modelB.model
    )

    if (!modelAData || !modelBData) {
      return null
    }

    const { description: descA, tip: tipA } = getModelDescription(
      modelA.provider,
      modelA.model,
      modelAData.capabilities
    )
    const { description: descB, tip: tipB } = getModelDescription(
      modelB.provider,
      modelB.model,
      modelBData.capabilities
    )

    const firstLineA = getFirstLine(descA)
    const firstLineB = getFirstLine(descB)

    // Calcular custo relativo
    const { cheaper, difference, costA, costB } = getRelativeCost(
      modelA.provider,
      modelA.model,
      modelB.provider,
      modelB.model
    )

    const capabilitiesA = modelAData.capabilities || { input: [], output: [] }
    const capabilitiesB = modelBData.capabilities || { input: [], output: [] }
    const inputTypesA = capabilitiesA.input || []
    const outputTypesA = capabilitiesA.output || []
    const inputTypesB = capabilitiesB.input || []
    const outputTypesB = capabilitiesB.output || []

    // Buscar preços para tooltip
    const keyA = `${modelA.provider.toLowerCase()}:${modelA.model}`
    const keyB = `${modelB.provider.toLowerCase()}:${modelB.model}`
    const pricingA = MODEL_PRICING[keyA]
    const pricingB = MODEL_PRICING[keyB]

    return (
      <TooltipProvider>
        <div className="flex items-center justify-center px-3 py-3">
          <div className="max-w-6xl w-full space-y-4">
            {/* Versão compacta dos dois modelos */}
            <div className="flex items-start gap-2 justify-center">
              {/* Modelo A */}
              <div className="flex-1 max-w-[40%] min-w-0 space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-lg">
                            {modelAData.icon}
                          </div>
                          <h2 className="text-base font-bold tracking-tight truncate">
                            {modelAData.displayName}
                          </h2>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">
                        {firstLineA}
                      </p>
                      
                      {/* Badges de capabilities - compacto */}
                      {(inputTypesA.length > 0 || outputTypesA.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {inputTypesA.map((type) => {
                            const Icon = CAPABILITY_ICONS[type]
                            return (
                              <Badge key={`input-${type}`} variant="secondary" className="gap-0.5 text-[9px] px-1.5 py-0.5 h-5">
                                {Icon && <Icon className="h-2.5 w-2.5" />}
                                {CAPABILITY_LABELS[type]}
                              </Badge>
                            )
                          })}
                          {outputTypesA.map((type) => {
                            const Icon = CAPABILITY_ICONS[type]
                            return (
                              <Badge key={`output-${type}`} variant="default" className="gap-0.5 text-[9px] px-1.5 py-0.5 h-5">
                                {Icon && <Icon className="h-2.5 w-2.5" />}
                                {CAPABILITY_LABELS[type]}
                              </Badge>
                            )
                          })}
                        </div>
                      )}

                      {/* Indicador de custo */}
                      {cheaper === 'A' && difference !== null && difference > 5 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <DollarSign className="h-3 w-3 text-green-600 dark:text-green-500" />
                          <span className="text-[9px] text-green-600 dark:text-green-500 font-medium">
                            {difference.toFixed(0)}% mais econômico
                          </span>
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs p-3">
                    <div className="space-y-2">
                      <div className="font-semibold text-sm">{modelAData.displayName}</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{descA}</p>
                      {tipA && (
                        <div className="pt-2 border-t">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed">{tipA}</p>
                          </div>
                        </div>
                      )}
                      {pricingA && (pricingA.input > 0 || pricingA.output > 0) && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 text-xs">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              ${(pricingA.input + pricingA.output).toFixed(2)} / 1M tokens
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Botão Ver detalhes */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] px-2 mt-2 w-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpandedModel(expandedModel === 'A' ? null : 'A')
                  }}
                >
                  {expandedModel === 'A' ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Ocultar detalhes
                    </>
                  ) : (
                    <>
                      <Info className="h-3 w-3 mr-1" />
                      Ver detalhes completos
                    </>
                  )}
                </Button>
              </div>

              {/* VS com animação */}
              <div className="flex-shrink-0 px-2 pt-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30 shadow-sm animate-pulse">
                  <span className="text-xs font-bold text-primary">VS</span>
                </div>
              </div>

              {/* Modelo B */}
              <div className="flex-1 max-w-[40%] min-w-0 space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-lg">
                            {modelBData.icon}
                          </div>
                          <h2 className="text-base font-bold tracking-tight truncate">
                            {modelBData.displayName}
                          </h2>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">
                        {firstLineB}
                      </p>
                      
                      {/* Badges de capabilities - compacto */}
                      {(inputTypesB.length > 0 || outputTypesB.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {inputTypesB.map((type) => {
                            const Icon = CAPABILITY_ICONS[type]
                            return (
                              <Badge key={`input-${type}`} variant="secondary" className="gap-0.5 text-[9px] px-1.5 py-0.5 h-5">
                                {Icon && <Icon className="h-2.5 w-2.5" />}
                                {CAPABILITY_LABELS[type]}
                              </Badge>
                            )
                          })}
                          {outputTypesB.map((type) => {
                            const Icon = CAPABILITY_ICONS[type]
                            return (
                              <Badge key={`output-${type}`} variant="default" className="gap-0.5 text-[9px] px-1.5 py-0.5 h-5">
                                {Icon && <Icon className="h-2.5 w-2.5" />}
                                {CAPABILITY_LABELS[type]}
                              </Badge>
                            )
                          })}
                        </div>
                      )}

                      {/* Indicador de custo */}
                      {cheaper === 'B' && difference !== null && difference > 5 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <DollarSign className="h-3 w-3 text-green-600 dark:text-green-500" />
                          <span className="text-[9px] text-green-600 dark:text-green-500 font-medium">
                            {difference.toFixed(0)}% mais econômico
                          </span>
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs p-3">
                    <div className="space-y-2">
                      <div className="font-semibold text-sm">{modelBData.displayName}</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{descB}</p>
                      {tipB && (
                        <div className="pt-2 border-t">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed">{tipB}</p>
                          </div>
                        </div>
                      )}
                      {pricingB && (pricingB.input > 0 || pricingB.output > 0) && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 text-xs">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              ${(pricingB.input + pricingB.output).toFixed(2)} / 1M tokens
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Botão Ver detalhes */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] px-2 mt-2 w-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpandedModel(expandedModel === 'B' ? null : 'B')
                  }}
                >
                  {expandedModel === 'B' ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Ocultar detalhes
                    </>
                  ) : (
                    <>
                      <Info className="h-3 w-3 mr-1" />
                      Ver detalhes completos
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Versão expandida do modelo A */}
            {expandedModel === 'A' && (
              <div className="mt-4 pt-4 border-t animate-in slide-in-from-top-2 duration-300">
                <div className="max-w-md mx-auto space-y-2.5">
                  {/* Cabeçalho */}
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-xl">
                        {modelAData.icon}
                      </div>
                      <h2 className="text-lg font-bold tracking-tight">
                        {modelAData.displayName}
                      </h2>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {descA}
                  </p>

                  {/* Cards de informações */}
                  <div className="grid gap-2 md:grid-cols-2">
                    {/* Entrada */}
                    <Card>
                      <CardHeader className="pb-1.5 pt-3">
                        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          O que você pode enviar
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-3 space-y-1.5">
                        {inputTypesA.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-1.5">
                              {inputTypesA.map((type) => {
                                const Icon = CAPABILITY_ICONS[type]
                                return (
                                  <Badge key={type} variant="secondary" className="gap-1 text-xs px-2 py-0.5">
                                    {Icon && <Icon className="h-3 w-3" />}
                                    {CAPABILITY_LABELS[type]}
                                  </Badge>
                                )
                              })}
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">
                              {getCapabilityDescription(inputTypesA, 'input')}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground leading-tight">
                            Este modelo não aceita entradas.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Saída */}
                    <Card>
                      <CardHeader className="pb-1.5 pt-3">
                        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5" />
                          O que você vai receber
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-3 space-y-1.5">
                        {outputTypesA.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-1.5">
                              {outputTypesA.map((type) => {
                                const Icon = CAPABILITY_ICONS[type]
                                return (
                                  <Badge key={type} variant="default" className="gap-1 text-xs px-2 py-0.5">
                                    {Icon && <Icon className="h-3 w-3" />}
                                    {CAPABILITY_LABELS[type]}
                                  </Badge>
                                )
                              })}
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">
                              {getCapabilityDescription(outputTypesA, 'output')}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground leading-tight">
                            Este modelo não gera saídas.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Dica */}
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-2.5 pb-3">
                      <p className="text-xs font-medium text-foreground mb-0.5 flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-primary" />
                        💡 Dica:
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight">
                        {tipA}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Versão expandida do modelo B */}
            {expandedModel === 'B' && (
              <div className="mt-4 pt-4 border-t animate-in slide-in-from-top-2 duration-300">
                <div className="max-w-md mx-auto space-y-2.5">
                  {/* Cabeçalho */}
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-xl">
                        {modelBData.icon}
                      </div>
                      <h2 className="text-lg font-bold tracking-tight">
                        {modelBData.displayName}
                      </h2>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {descB}
                  </p>

                  {/* Cards de informações */}
                  <div className="grid gap-2 md:grid-cols-2">
                    {/* Entrada */}
                    <Card>
                      <CardHeader className="pb-1.5 pt-3">
                        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          O que você pode enviar
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-3 space-y-1.5">
                        {inputTypesB.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-1.5">
                              {inputTypesB.map((type) => {
                                const Icon = CAPABILITY_ICONS[type]
                                return (
                                  <Badge key={type} variant="secondary" className="gap-1 text-xs px-2 py-0.5">
                                    {Icon && <Icon className="h-3 w-3" />}
                                    {CAPABILITY_LABELS[type]}
                                  </Badge>
                                )
                              })}
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">
                              {getCapabilityDescription(inputTypesB, 'input')}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground leading-tight">
                            Este modelo não aceita entradas.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Saída */}
                    <Card>
                      <CardHeader className="pb-1.5 pt-3">
                        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5" />
                          O que você vai receber
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-3 space-y-1.5">
                        {outputTypesB.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-1.5">
                              {outputTypesB.map((type) => {
                                const Icon = CAPABILITY_ICONS[type]
                                return (
                                  <Badge key={type} variant="default" className="gap-1 text-xs px-2 py-0.5">
                                    {Icon && <Icon className="h-3 w-3" />}
                                    {CAPABILITY_LABELS[type]}
                                  </Badge>
                                )
                              })}
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">
                              {getCapabilityDescription(outputTypesB, 'output')}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground leading-tight">
                            Este modelo não gera saídas.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Dica */}
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-2.5 pb-3">
                      <p className="text-xs font-medium text-foreground mb-0.5 flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-primary" />
                        💡 Dica:
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight">
                        {tipB}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>
    )
  }

  // Se não encontrar o modelo, não renderiza
  if (!modelData) {
    return null
  }

  // Buscar descrição (customizada ou genérica)
  const { description, tip } = getModelDescription(
    provider,
    model,
    modelData.capabilities
  )

  const capabilities = modelData.capabilities || { input: [], output: [] }
  const inputTypes = capabilities.input || []
  const outputTypes = capabilities.output || []

  return (
    <div className="flex items-center justify-center px-4 py-3">
      <div className="max-w-3xl w-full space-y-2.5">
        {/* Cabeçalho com ícone do modelo - layout horizontal */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-xl">
              {modelData.icon}
            </div>
            <h2 className="text-lg font-bold tracking-tight">
              {modelData.displayName}
            </h2>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground leading-snug">
              {description}
            </p>
          </div>
        </div>

        {/* Cards de informações - layout ultra compacto */}
        <div className="grid gap-2 md:grid-cols-2">
          {/* Entrada */}
          <Card>
            <CardHeader className="pb-1.5 pt-3">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                O que você pode enviar
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 space-y-1.5">
              {inputTypes.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {inputTypes.map((type) => {
                      const Icon = CAPABILITY_ICONS[type]
                      return (
                        <Badge key={type} variant="secondary" className="gap-1 text-xs px-2 py-0.5">
                          {Icon && <Icon className="h-3 w-3" />}
                          {CAPABILITY_LABELS[type]}
                        </Badge>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {getCapabilityDescription(inputTypes, 'input')}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground leading-tight">
                  Este modelo não aceita entradas.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Saída */}
          <Card>
            <CardHeader className="pb-1.5 pt-3">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                O que você vai receber
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 space-y-1.5">
              {outputTypes.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {outputTypes.map((type) => {
                      const Icon = CAPABILITY_ICONS[type]
                      return (
                        <Badge key={type} variant="default" className="gap-1 text-xs px-2 py-0.5">
                          {Icon && <Icon className="h-3 w-3" />}
                          {CAPABILITY_LABELS[type]}
                        </Badge>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {getCapabilityDescription(outputTypes, 'output')}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground leading-tight">
                  Este modelo não gera saídas.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dica - card único ultra compacto */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-2.5 pb-3">
            <p className="text-xs font-medium text-foreground mb-0.5 flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              💡 Dica:
            </p>
            <p className="text-xs text-muted-foreground leading-tight">
              {tip}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

