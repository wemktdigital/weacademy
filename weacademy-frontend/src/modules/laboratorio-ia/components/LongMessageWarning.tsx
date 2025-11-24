'use client'

import { AlertCircle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LongMessageWarningProps {
  elapsedSeconds: number
  className?: string
}

export function LongMessageWarning({ elapsedSeconds, className }: LongMessageWarningProps) {
  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  const elapsedSecondsDisplay = elapsedSeconds % 60

  return (
    <div className={cn('flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg', className)}>
      <Loader2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
      <div className="flex-1">
        <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
          Processando resposta longa...
        </p>
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          {elapsedMinutes > 0 
            ? `${elapsedMinutes} minuto${elapsedMinutes > 1 ? 's' : ''} e ${elapsedSecondsDisplay} segundo${elapsedSecondsDisplay !== 1 ? 's' : ''}`
            : `${elapsedSeconds} segundo${elapsedSeconds !== 1 ? 's' : ''}`
          }
        </p>
      </div>
      <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/50 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200">
        <AlertCircle className="h-3 w-3 mr-1" />
        Aguardando
      </Badge>
    </div>
  )
}

