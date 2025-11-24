'use client'

import { ReactNode } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info, HelpCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ContextualTooltipProps {
  content: string
  children: ReactNode
  icon?: 'info' | 'help' | 'sparkles' | 'none'
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  variant?: 'default' | 'compact'
}

const ICON_CONFIG = {
  info: Info,
  help: HelpCircle,
  sparkles: Sparkles,
  none: null,
}

export function ContextualTooltip({
  content,
  children,
  icon = 'info',
  side = 'top',
  className,
  variant = 'default',
}: ContextualTooltipProps) {
  const Icon = icon !== 'none' ? ICON_CONFIG[icon] : null

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn('inline-flex items-center gap-1', className)}>
              {children}
              {Icon && (
                <Icon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side={side} className="max-w-xs">
            <p className="text-sm">{content}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild className={className}>
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <div className="flex items-start gap-2">
            {Icon && (
              <Icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            )}
            <p className="text-sm">{content}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

