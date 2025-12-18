'use client'

import { useState } from 'react'
import { CheckCircle, Circle, Lock, Play, Clock, ChevronDown, ChevronRight } from 'lucide-react'
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

interface Module {
  id: string
  title: string
  order_index: number
  lessons: Lesson[]
}

interface LessonProgress {
  lesson_id: string
  completed_at: string | null
  watch_time_seconds: number
}

interface LessonNavigatorProps {
  modules: Module[]
  progress?: LessonProgress[]
  currentLessonId?: string
  onLessonClick: (lesson: Lesson) => void
  className?: string
}

export function LessonNavigator({
  modules,
  progress = [],
  currentLessonId,
  onLessonClick,
  className = '',
}: LessonNavigatorProps) {
  // Inicialmente, expandir o módulo que contém a lição atual
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    modules.forEach(m => {
      if (m.lessons.some(l => l.id === currentLessonId)) {
        initial.add(m.id)
      }
    })
    return initial
  })

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId)
    } else {
      newExpanded.add(moduleId)
    }
    setExpandedModules(newExpanded)
  }

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
    <div className={cn('space-y-4', className)}>
      <h3 className="text-lg font-semibold mb-4 px-2">Conteúdo do Curso</h3>

      {modules.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2">Nenhuma lição disponível</p>
      ) : (
        <div className="space-y-2">
          {modules.map((module) => (
            <div key={module.id} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-left">{module.title}</span>
                  <span className="text-xs text-muted-foreground">
                    ({module.lessons.length})
                  </span>
                </div>
                {expandedModules.has(module.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {expandedModules.has(module.id) && (
                <div className="divide-y border-t bg-card">
                  {module.lessons.map((lesson) => {
                    const status = getLessonStatus(lesson.id)
                    const isCurrentLesson = lesson.id === currentLessonId

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => onLessonClick(lesson)}
                        className={cn(
                          'w-full flex items-start gap-3 p-3 transition-colors text-left hover:bg-accent/50',
                          isCurrentLesson && 'bg-accent/50 border-l-4 border-l-primary pl-2'
                        )}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {status === 'completed' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : status === 'in_progress' ? (
                            <Play className="h-4 w-4 text-primary" />
                          ) : lesson.is_preview || lesson.is_free ? (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className={cn(
                                'text-sm font-medium leading-none mb-1.5',
                                isCurrentLesson && 'text-primary font-semibold',
                                status === 'completed' && 'text-muted-foreground line-through'
                              )}>
                                {lesson.title}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDuration(lesson.duration_minutes)}</span>
                            {lesson.is_preview && (
                              <span className="text-primary font-medium">Preview</span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
