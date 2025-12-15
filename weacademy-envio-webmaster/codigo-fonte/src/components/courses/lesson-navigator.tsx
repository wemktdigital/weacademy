'use client'

import { useState } from 'react'
import { CheckCircle, Circle, Lock, Play, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Lesson {
  id: string
  title: string
  description?: string
  duration_minutes: number
  is_preview: boolean
  is_free: boolean
  order_index: number
}

interface LessonProgress {
  lesson_id: string
  completed_at: string | null
  watch_time_seconds: number
}

interface LessonNavigatorProps {
  lessons: Lesson[]
  progress?: LessonProgress[]
  currentLessonId?: string
  onLessonClick: (lessonId: string) => void
  className?: string
}

export function LessonNavigator({
  lessons,
  progress = [],
  currentLessonId,
  onLessonClick,
  className = '',
}: LessonNavigatorProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  const getLessonStatus = (lessonId: string) => {
    const lessonProgress = progress.find(p => p.lesson_id === lessonId)
    
    if (lessonProgress?.completed_at) {
      return 'completed'
    }
    
    if (lessonProgress && lessonProgress.watch_time_seconds > 0) {
      return 'in_progress'
    }
    
    return 'not_started'
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
  }

  return (
    <div className={cn('space-y-2', className)}>
      <h3 className="text-lg font-semibold mb-4">Conteúdo do Curso</h3>
      
      {lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma lição disponível</p>
      ) : (
        <div className="space-y-1">
          {lessons.map((lesson) => {
            const status = getLessonStatus(lesson.id)
            const isCurrentLesson = lesson.id === currentLessonId
            
            return (
              <button
                key={lesson.id}
                onClick={() => onLessonClick(lesson.id)}
                className={cn(
                  'w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left',
                  'hover:bg-accent',
                  isCurrentLesson && 'bg-accent border-l-2 border-l-primary',
                  status === 'completed' && 'bg-green-50 dark:bg-green-950/20',
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {status === 'completed' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : status === 'in_progress' ? (
                    <Play className="h-5 w-5 text-primary" />
                  ) : lesson.is_preview || lesson.is_free ? (
                    <Circle className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Lock className="h-5 w-5 text-gray-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className={cn(
                        'text-sm font-medium',
                        isCurrentLesson && 'text-primary font-semibold',
                        status === 'completed' && 'text-green-700 dark:text-green-400',
                        !lesson.is_preview && !lesson.is_free && status === 'not_started' && 'text-muted-foreground',
                      )}>
                        {lesson.title}
                      </p>
                      
                      {lesson.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {lesson.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(lesson.duration_minutes)}</span>
                      </div>

                      {lesson.is_preview && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                          Preview
                        </span>
                      )}

                      {lesson.is_free && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                          Grátis
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
