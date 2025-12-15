'use client'

import { Bot, Sparkles } from 'lucide-react'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'
import { cn } from '@/lib/utils'

interface ThinkingBubbleProps {
  provider?: string
  model?: string
  agentName?: string
  agentIcon?: string
  pipelineName?: string
}

export function ThinkingBubble({
  provider,
  model,
  agentName,
  agentIcon,
  pipelineName,
}: ThinkingBubbleProps) {
  const modelData = provider && model 
    ? AVAILABLE_MODELS.find(m => m.provider === provider && m.model === model)
    : null

  const displayName = pipelineName 
    ? `Pipeline: ${pipelineName}`
    : agentName
    ? `${agentIcon || '🤖'} ${agentName}`
    : modelData
    ? `${modelData.icon} ${modelData.displayName}`
    : 'WE IA'

  return (
    <div className="flex items-start gap-3 py-4 px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            {agentIcon ? (
              <span className="text-lg">{agentIcon}</span>
            ) : (
              <Bot className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="absolute -top-1 -right-1">
            <Sparkles className="h-3 w-3 text-primary animate-pulse" />
          </div>
        </div>
      </div>

      {/* Thinking bubble */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-foreground">{displayName}</span>
          <span className="text-xs text-muted-foreground">está pensando</span>
        </div>
        
        {/* Animated dots */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-4 py-3 border border-border/50">
          <div className="flex gap-1">
            <span 
              className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
            />
            <span 
              className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
            />
            <span 
              className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

