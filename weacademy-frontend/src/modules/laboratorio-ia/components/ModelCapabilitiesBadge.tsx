'use client'

import { Type, Image, Mic, Video } from 'lucide-react'
import { ModelCapabilities, MediaType } from '@/modules/laboratorio-ia/config/models'
import { cn } from '@/lib/utils'

interface ModelCapabilitiesBadgeProps {
  capabilities?: ModelCapabilities
  size?: 'sm' | 'md'
  className?: string
}

const mediaIcons: Record<MediaType, typeof Type> = {
  text: Type,
  image: Image,
  audio: Mic,
  video: Video,
}

const mediaLabels: Record<MediaType, string> = {
  text: 'Texto',
  image: 'Imagem',
  audio: 'Áudio',
  video: 'Vídeo',
}

export function ModelCapabilitiesBadge({
  capabilities,
  size = 'sm',
  className
}: ModelCapabilitiesBadgeProps) {
  if (!capabilities) return null

  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
  }

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      title={`Aceita: ${capabilities.input.map(t => mediaLabels[t]).join(', ')} | Retorna: ${capabilities.output.map(t => mediaLabels[t]).join(', ')}`}
    >
      <div className="flex items-center gap-1">
        {capabilities.input.map((type) => {
          const Icon = mediaIcons[type]
          return (
            <Icon
              key={type}
              className={cn("text-muted-foreground", sizeClasses[size])}
            />
          )
        })}
      </div>
      <span className="text-[10px] text-muted-foreground">→</span>
      <div className="flex items-center gap-1">
        {capabilities.output.map((type) => {
          const Icon = mediaIcons[type]
          return (
            <Icon
              key={type}
              className={cn("text-muted-foreground", sizeClasses[size])}
            />
          )
        })}
      </div>
    </div>
  )
}

export function ModelCapabilitiesTooltip({
  capabilities
}: { capabilities?: ModelCapabilities }) {
  if (!capabilities) return null

  return (
    <div className="space-y-2 text-xs">
      <div>
        <div className="font-semibold mb-1">Aceita:</div>
        <div className="flex flex-wrap gap-1">
          {capabilities.input.map((type) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground"
            >
              {mediaLabels[type]}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold mb-1">Retorna:</div>
        <div className="flex flex-wrap gap-1">
          {capabilities.output.map((type) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground"
            >
              {mediaLabels[type]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
