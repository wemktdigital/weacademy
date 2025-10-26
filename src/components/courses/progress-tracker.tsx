'use client'

import { Progress } from '@/components/ui/progress'
import { CheckCircle, Clock } from 'lucide-react'

interface ProgressTrackerProps {
  progress: number
  totalLessons?: number
  completedLessons?: number
  className?: string
}

export function ProgressTracker({
  progress,
  totalLessons,
  completedLessons,
  className = '',
}: ProgressTrackerProps) {
  const getProgressColor = () => {
    if (progress >= 100) return 'bg-green-500'
    if (progress >= 50) return 'bg-blue-500'
    return 'bg-primary'
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progresso</span>
        <span className="font-semibold">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      {totalLessons && completedLessons !== undefined && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>
            {completedLessons} de {totalLessons} lições concluídas
          </span>
        </div>
      )}
    </div>
  )
}
