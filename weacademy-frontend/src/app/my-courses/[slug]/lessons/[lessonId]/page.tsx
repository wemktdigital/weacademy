'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { VideoPlayer } from '@/components/courses/video-player'
import { LessonNavigator } from '@/components/courses/lesson-navigator'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { trackLessonStart, trackLessonComplete } from '@/lib/analytics'
import { 
  ArrowLeft, 
  CheckCircle2, 
  Lock, 
  Play, 
  Clock,
  ChevronRight,
  FileText
} from 'lucide-react'
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
  order_index: number
  lessons: Lesson[]
}

export default function LessonPlayerPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [watchTime, setWatchTime] = useState(0)

  useEffect(() => {
    if (user) {
      fetchLesson()
    } else {
      router.push('/auth/login')
    }
  }, [params.lessonId])

  const fetchLesson = async () => {
    try {
      // Buscar lição atual
      const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', params.lessonId)
        .single()

      if (lessonError) throw lessonError

      // Buscar módulo
      const { data: moduleData } = await supabase
        .from('modules')
        .select('*')
        .eq('id', lessonData.module_id)
        .single()

      // Buscar curso
      const { data: courseData } = await supabase
        .from('courses')
        .select('id')
        .eq('id', moduleData.course_id)
        .single()

      // Buscar todos os módulos e lições do curso
      const { data: courseModules } = await supabase
        .from('modules')
        .select(`
          id,
          title,
          order_index,
          lessons:lessons(*)
        `)
        .eq('course_id', courseData.id)
        .order('order_index', { ascending: true })

      // Buscar progresso
      const allLessonIds = courseModules.flatMap((m: Module) => m.lessons.map((l: Lesson) => l.id))
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id, completed_at')
        .eq('user_id', user?.id)
        .in('lesson_id', allLessonIds)

      const completedLessonIds = new Set(
        progressData?.filter(p => p.completed_at).map(p => p.lesson_id) || []
      )

      courseModules.forEach((module: Module) => {
        module.lessons.forEach((lesson: Lesson) => {
          lesson.completed = completedLessonIds.has(lesson.id)
        })
      })

      setCurrentLesson(lessonData)
      setModules(courseModules)

      // Rastrear início da lição
      if (moduleData && courseData) {
        trackLessonStart(
          courseData.id,
          lessonData.id,
          lessonData.title
        )
      }
    } catch (error: any) {
      console.error('Error fetching lesson:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao carregar a lição',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVideoProgress = (seconds: number) => {
    setWatchTime(seconds)
  }

  const handleVideoComplete = async () => {
    if (!currentLesson || !user) return

    try {
      // Buscar curso para verificar se deve marcar como completo
      let courseId: string | null = null
      if (modules.length > 0 && modules[0].lessons.length > 0) {
        const { data: moduleData } = await supabase
          .from('modules')
          .select('course_id')
          .eq('id', modules[0].id)
          .single()
        courseId = moduleData?.course_id || null
      }

      // Marcar como concluída (trigger SQL vai adicionar XP automaticamente)
      await supabase
        .from('lesson_progress')
        .upsert({
          user_id: user.id,
          lesson_id: currentLesson.id,
          watch_time_seconds: watchTime,
          completed_at: new Date().toISOString(),
        })

      // Verificar se todas as aulas do curso foram completadas
      if (courseId) {
        try {
          // Buscar todas as aulas do curso
          const { data: allLessons } = await supabase
            .from('modules')
            .select(`
              id,
              lessons:lessons(id)
            `)
            .eq('course_id', courseId)

          const allLessonIds = allLessons?.flatMap(m => m.lessons.map((l: any) => l.id)) || []

          // Buscar aulas completadas
          const { data: completedLessons } = await supabase
            .from('lesson_progress')
            .select('lesson_id')
            .eq('user_id', user.id)
            .in('lesson_id', allLessonIds)
            .not('completed_at', 'is', null)

          // Se todas as aulas foram completadas, marcar curso como completo
          if (allLessonIds.length > 0 && completedLessons && completedLessons.length >= allLessonIds.length) {
            const { data: enrollment } = await supabase
              .from('enrollments')
              .select('id, completed_at')
              .eq('user_id', user.id)
              .eq('course_id', courseId)
              .single()

            if (enrollment && !enrollment.completed_at) {
              await supabase
                .from('enrollments')
                .update({
                  completed_at: new Date().toISOString(),
                  progress_percentage: 100,
                })
                .eq('id', enrollment.id)

              toast({
                title: '🎉 Parabéns!',
                description: 'Curso completo! Você ganhou XP adicional!',
              })
            }
          }
        } catch (error) {
          // Ignorar erros de verificação de curso completo
          console.error('Error checking course completion:', error)
        }
      }

      // Verificar achievements (após trigger adicionar XP)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token

        if (token) {
          await fetch('/api/gamification/check-achievements', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ user_id: user.id }),
          })
        }
      } catch (error) {
        // Ignorar erros de achievements para não bloquear a conclusão da aula
        console.error('Error checking achievements:', error)
      }

      // Marcar localmente como completa
      setCurrentLesson({ ...currentLesson, completed: true })

      // Rastrear conclusão da lição
      if (courseId) {
        trackLessonComplete(
          courseId,
          currentLesson.id,
          currentLesson.title
        )
      }

      toast({
        title: 'Parabéns!',
        description: 'Lição concluída! Você ganhou XP! 🎉',
      })
    } catch (error) {
      console.error('Error updating progress:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao marcar lição como concluída',
        variant: 'destructive',
      })
    }
  }

  const getNextLesson = (): Lesson | null => {
    if (!currentLesson) return null

    for (const module of modules) {
      const currentIndex = module.lessons.findIndex(l => l.id === currentLesson.id)
      if (currentIndex !== -1 && currentIndex < module.lessons.length - 1) {
        return module.lessons[currentIndex + 1]
      }
      // Se não encontrou no módulo atual, pegar a primeira do próximo módulo
      const moduleIndex = modules.findIndex(m => m.id === module.id)
      if (moduleIndex !== -1 && moduleIndex < modules.length - 1) {
        return modules[moduleIndex + 1].lessons[0]
      }
    }

    return null
  }

  const handleNextLesson = () => {
    const next = getNextLesson()
    if (next) {
      router.push(`/my-courses/${params.slug}/lessons/${next.id}`)
      window.scrollTo(0, 0)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="animate-pulse space-y-4 p-8">
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!currentLesson) {
    return null
  }

  const nextLesson = getNextLesson()
  const allLessons = modules.flatMap(m => m.lessons)
  const currentIndex = allLessons.findIndex(l => l.id === currentLesson.id)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href={`/my-courses/${params.slug}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Curso
              </Button>
            </Link>
            {currentLesson.completed && (
              <Badge className="bg-green-500">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Completa
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video */}
            <Card>
              <CardContent className="p-0">
                {currentLesson.video_url ? (
                  <VideoPlayer
                    url={currentLesson.video_url}
                    provider={currentLesson.video_provider as 'youtube' | 'vimeo'}
                    title={currentLesson.title}
                    onProgress={handleVideoProgress}
                    onComplete={handleVideoComplete}
                  />
                ) : (
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">Sem vídeo disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lesson Info */}
            <Card>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Badge variant="outline" className="mb-2">
                      {currentLesson.type}
                    </Badge>
                    <h1 className="text-2xl font-bold mb-2">{currentLesson.title}</h1>
                    <p className="text-muted-foreground">{currentLesson.description}</p>
                  </div>
                  {currentLesson.completed && (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  )}
                </div>

                {/* Content */}
                {currentLesson.content && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Conteúdo da Lição</h3>
                    </div>
                    <div 
                      className="prose max-w-none text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: currentLesson.content }}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Next Lesson Button */}
            {nextLesson && (
              <Button
                className="w-full"
                size="lg"
                onClick={handleNextLesson}
              >
                Próxima Lição: {nextLesson.title}
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Conteúdo do Curso</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Lição {currentIndex + 1} de {allLessons.length}
                </p>
              </div>
              <div className="p-2">
                <LessonNavigator
                  modules={modules}
                  currentLessonId={currentLesson.id}
                  onLessonClick={(lesson) => {
                    router.push(`/my-courses/${params.slug}/lessons/${lesson.id}`)
                    window.scrollTo(0, 0)
                  }}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
