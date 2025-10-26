'use client'

import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle, BookOpen } from 'lucide-react'

interface ProgressTrackerProps {
  modules: Array<{
    id: string
    title: string
    order_index: number
    lessons: Array<{
      id: string
      title: string
      completed?: boolean
    }>
  }>
  onLessonClick?: (lessonId: string) => void
}

export function ProgressTracker({ modules, onLessonClick }: ProgressTrackerProps) {
  const totalLessons = modules.reduce((acc, module) => acc + module.lessons.length, 0)
  const completedLessons = modules.reduce(
    (acc, module) => acc + module.lessons.filter(l => l.completed).length,
    0
  )
  const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progresso do Curso</span>
          <span className="text-muted-foreground">
            {completedLessons} / {totalLessons} aulas
          </span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {Math.round(progressPercentage)}% completo
        </p>
      </div>

      {/* Modules */}
      <div className="space-y-3">
        {modules.map((module) => {
          const moduleCompletedLessons = module.lessons.filter(l => l.completed).length
          const moduleProgress = module.lessons.length > 0
            ? (moduleCompletedLessons / module.lessons.length) * 100
            : 0

          return (
            <div key={module.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold text-sm">{module.title}</h4>
                </div>
                <span className="text-xs text-muted-foreground">
                  {moduleCompletedLessons}/{module.lessons.length}
                </span>
              </div>
              
              <div className="space-y-2">
                {module.lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    onClick={() => onLessonClick?.(lesson.id)}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                      lesson.completed
                        ? 'bg-green-50 hover:bg-green-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {lesson.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={`text-sm ${
                      lesson.completed ? 'line-through text-muted-foreground' : ''
                    }`}>
                      {lesson.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
