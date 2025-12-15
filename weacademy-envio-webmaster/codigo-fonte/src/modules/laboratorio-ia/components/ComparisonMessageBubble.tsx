'use client'

import { MessageBubble } from './MessageBubble'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'

interface ComparisonResponse {
  provider: string
  model: string
  content: string
  latency?: number
  cost?: number
  id: string
}

interface ComparisonMessageBubbleProps {
  responseA: ComparisonResponse
  responseB: ComparisonResponse
  onVote: (winner: 'A' | 'B') => void
  votedFor?: 'A' | 'B'
}

export function ComparisonMessageBubble({
  responseA,
  responseB,
  onVote,
  votedFor,
}: ComparisonMessageBubbleProps) {
  console.log('[ComparisonMessageBubble] Renderizando com:', {
    responseA: { 
      provider: responseA.provider, 
      model: responseA.model, 
      contentLength: responseA.content?.length,
      contentPreview: responseA.content?.substring(0, 100),
      hasContent: !!responseA.content && responseA.content.trim().length > 0,
    },
    responseB: { 
      provider: responseB.provider, 
      model: responseB.model, 
      contentLength: responseB.content?.length,
      contentPreview: responseB.content?.substring(0, 100),
      hasContent: !!responseB.content && responseB.content.trim().length > 0,
    },
  })
  
  const modelA = AVAILABLE_MODELS.find(
    m => m.provider === responseA.provider && m.model === responseA.model
  )
  const modelB = AVAILABLE_MODELS.find(
    m => m.provider === responseB.provider && m.model === responseB.model
  )
  
  console.log('[ComparisonMessageBubble] Modelos encontrados:', {
    modelA: modelA ? `${modelA.provider}:${modelA.model}` : 'NÃO ENCONTRADO',
    modelB: modelB ? `${modelB.provider}:${modelB.model}` : 'NÃO ENCONTRADO',
  })

  const messageA = {
    id: responseA.id,
    role: 'assistant' as const,
    content: responseA.content,
    created_at: new Date().toISOString(),
    metadata: {
      provider: responseA.provider,
      model: responseA.model,
      isComparison: true,
      comparisonSide: 'A' as const,
    },
  }

  const messageB = {
    id: responseB.id,
    role: 'assistant' as const,
    content: responseB.content,
    created_at: new Date().toISOString(),
    metadata: {
      provider: responseB.provider,
      model: responseB.model,
      isComparison: true,
      comparisonSide: 'B' as const,
    },
  }

  const isLoadingA = !responseA.content || responseA.content.trim() === ''
  const isLoadingB = !responseB.content || responseB.content.trim() === ''
  
  console.log('[ComparisonMessageBubble] Estado de loading:', {
    isLoadingA,
    isLoadingB,
    contentA: responseA.content ? `"${responseA.content.substring(0, 50)}..."` : 'VAZIO',
    contentB: responseB.content ? `"${responseB.content.substring(0, 50)}..."` : 'VAZIO',
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
      {/* Resposta A */}
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">
            {modelA?.icon} {modelA?.displayName || responseA.model}
          </span>
          {responseA.latency && (
            <span className="text-xs text-muted-foreground">
              {(responseA.latency / 1000).toFixed(1)}s
            </span>
          )}
          {responseA.cost && (
            <span className="text-xs text-muted-foreground">
              ${responseA.cost.toFixed(4)}
            </span>
          )}
          {isLoadingA && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Carregando...
            </span>
          )}
        </div>
        <div className={cn(
          "border rounded-lg p-4 min-h-[200px]",
          votedFor === 'A' && "border-primary bg-primary/5 ring-2 ring-primary/20",
          isLoadingA && "opacity-60"
        )}>
          {isLoadingA ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm">Aguardando resposta...</p>
              </div>
            </div>
          ) : (
            <>
              {console.log('[ComparisonMessageBubble] Renderizando MessageBubble A com conteúdo:', messageA.content?.substring(0, 100))}
              <MessageBubble
                id={messageA.id}
                role={messageA.role}
                content={messageA.content}
                timestamp={messageA.created_at}
                metadata={messageA.metadata}
              />
            </>
          )}
        </div>
        {!isLoadingA && (
          <Button
            variant={votedFor === 'A' ? 'default' : 'outline'}
            size="sm"
            className="mt-2 w-full"
            onClick={() => onVote('A')}
          >
            {votedFor === 'A' ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Escolhido
              </>
            ) : (
              <>
                <ThumbsUp className="h-4 w-4 mr-2" />
                Escolher esta
              </>
            )}
          </Button>
        )}
      </div>

      {/* Resposta B */}
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">
            {modelB?.icon} {modelB?.displayName || responseB.model}
          </span>
          {responseB.latency && (
            <span className="text-xs text-muted-foreground">
              {(responseB.latency / 1000).toFixed(1)}s
            </span>
          )}
          {responseB.cost && (
            <span className="text-xs text-muted-foreground">
              ${responseB.cost.toFixed(4)}
            </span>
          )}
          {isLoadingB && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Carregando...
            </span>
          )}
        </div>
        <div className={cn(
          "border rounded-lg p-4 min-h-[200px]",
          votedFor === 'B' && "border-primary bg-primary/5 ring-2 ring-primary/20",
          isLoadingB && "opacity-60"
        )}>
          {isLoadingB ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm">Aguardando resposta...</p>
              </div>
            </div>
          ) : (
            <>
              {console.log('[ComparisonMessageBubble] Renderizando MessageBubble B com conteúdo:', messageB.content?.substring(0, 100))}
              <MessageBubble
                id={messageB.id}
                role={messageB.role}
                content={messageB.content}
                timestamp={messageB.created_at}
                metadata={messageB.metadata}
              />
            </>
          )}
        </div>
        {!isLoadingB && (
          <Button
            variant={votedFor === 'B' ? 'default' : 'outline'}
            size="sm"
            className="mt-2 w-full"
            onClick={() => onVote('B')}
          >
            {votedFor === 'B' ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Escolhido
              </>
            ) : (
              <>
                <ThumbsUp className="h-4 w-4 mr-2" />
                Escolher esta
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

