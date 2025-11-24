'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { VideoPlayer } from '@/components/courses/video-player'
import { LessonNavigator } from '@/components/courses/lesson-navigator'
import { ProgressTracker } from '@/components/courses/progress-tracker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { trackCourseAction } from '@/lib/analytics'
import { BookOpen, CheckCircle2, Clock, Play, Lock } from 'lucide-react'
import Link from 'next/link'

interface Lesson {
  id: string
  title: string
  description: string
  type: string
  video_url: string
  video_provider: string
  content: string
  duration_minutes: number
  is_preview: boolean
  is_free: boolean
  order_index: number
  completed?: boolean
}

interface Module {
  id: string
  title: string
  description: string
  order_index: number
  lessons: Lesson[]
}

interface Course {
  id: string
  title: string
  description: string
  duration_hours: number
  level: string
  modules: Module[]
}

export default function CoursePlayerPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchCourse()
    } else {
      router.push('/auth/login')
    }
  }, [params.slug, user])

  const fetchCourse = async () => {
    try {
      // Verificar se está inscrito
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('progress_percentage')
        .eq('user_id', user?.id)
        .eq('course_id', (await supabase.from('courses').select('id').eq('slug', params.slug).single()).data?.id)
        .single()

      if (!enrollment) {
        toast({
          title: 'Não autorizado',
          description: 'Você não está inscrito neste curso',
          variant: 'destructive',
        })
        router.push('/courses')
        return
      }

      // Buscar curso
      const { data, error } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          description,
          duration_hours,
          level,
          modules:modules(
            id,
            title,
            description,
            order_index,
            lessons:lessons(*)
          )
        `)
        .eq('slug', params.slug)
        .single()

      if (error) throw error

      // Buscar progresso das lições
      const allLessonIds = data.modules.flatMap((m: Module) => m.lessons.map((l: Lesson) => l.id))
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id, completed_at')
        .eq('user_id', user?.id)
        .in('lesson_id', allLessonIds)

      const completedLessonIds = new Set(
        progressData?.filter(p => p.completed_at).map(p => p.lesson_id) || []
      )

      // Marcar lições como completas
      data.modules.forEach((module: Module) => {
        module.lessons.forEach((lesson: Lesson) => {
          lesson.completed = completedLessonIds.has(lesson.id)
        })
      })

      setCourse(data)
      setProgress(enrollment.progress_percentage)

      // Rastrear visualização do curso
      trackCourseAction('view', data.id, data.title)
    } catch (error: any) {
      console.error('Error fetching course:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao carregar o curso',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLessonClick = (lesson: Lesson) => {
    router.push(`/my-courses/${params.slug}/lessons/${lesson.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="animate-pulse space-y-4 p-8">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!course) {
    return null
  }

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0)
  const completedLessons = course.modules.reduce((acc, m) => 
    acc + m.lessons.filter(l => l.completed).length, 0)

  // Encontrar primeira lição não completa
  const firstIncompleteLesson = course.modules
    .flatMap(m => m.lessons)
    .find(l => !l.completed && !l.is_preview)

  const previewLesson = course.modules
    .flatMap(m => m.lessons)
    .find(l => l.is_preview)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/my-courses">
            <Button variant="ghost" size="sm">
              ← Voltar para Meus Cursos
            </Button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">{course.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {totalLessons} lições
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {course.duration_hours}h
                </div>
                <Badge>{course.level}</Badge>
              </div>
            </div>
          </div>

          {/* Progress */}
          <Card>
            <CardContent className="pt-6">
              <ProgressTracker
                progress={progress}
                totalLessons={totalLessons}
                completedLessons={completedLessons}
              />
            </CardContent>
          </Card>
        </div>

        {/* Preview Lesson */}
        {previewLesson && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge>Preview</Badge>
                <CardTitle>Aula Preview</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {previewLesson.video_url ? (
                <VideoPlayer
                  url={previewLesson.video_url}
                  provider={previewLesson.video_provider as 'youtube' | 'vimeo'}
                  title={previewLesson.title}
                />
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Sem vídeo disponível</p>
                </div>
              )}
              <div className="mt-4">
                <h3 className="font-semibold mb-2">{previewLesson.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {previewLesson.description}
                </p>
                <Button onClick={() => handleLessonClick(previewLesson)}>
                  <Play className="mr-2 h-4 w-4" />
                  Assistir Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Start */}
        {firstIncompleteLesson && (
          <Card className="mb-8 bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Continue aprendendo</h3>
                  <p className="text-sm text-muted-foreground">
                    {firstIncompleteLesson.title}
                  </p>
                </div>
                <Button onClick={() => handleLessonClick(firstIncompleteLesson)}>
                  <Play className="mr-2 h-4 w-4" />
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modules */}
        <div className="space-y-6">
          {course.modules
            .sort((a, b) => a.order_index - b.order_index)
            .map((module, index) => (
              <Card key={module.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Módulo {index + 1}</Badge>
                    <CardTitle>{module.title}</CardTitle>
                  </div>
                  {module.description && (
                    <CardDescription>{module.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {module.lessons
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((lesson, lessonIndex) => (
                        <button
                          key={lesson.id}
                          onClick={() => handleLessonClick(lesson)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left border"
                          disabled={!lesson.is_preview && !lesson.is_free && !lesson.completed}
                        >
                          <div className="flex-shrink-0">
                            {lesson.completed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : lesson.is_preview || lesson.is_free ? (
                              <Play className="h-5 w-5 text-primary" />
                            ) : (
                              <Lock className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">
                              {lessonIndex + 1}. {lesson.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {lesson.type && <Badge variant="outline" className="text-xs">{lesson.type}</Badge>}
                              {lesson.duration_minutes > 0 && (
                                <span>{lesson.duration_minutes} min</span>
                              )}
                              {lesson.is_preview && <Badge variant="secondary" className="text-xs">Preview</Badge>}
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </div>
  )
}
