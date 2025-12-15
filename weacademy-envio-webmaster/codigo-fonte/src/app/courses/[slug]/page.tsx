'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { VideoPlayer } from '@/components/courses/video-player'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Calendar, 
  Clock, 
  Users, 
  Star, 
  Play, 
  CheckCircle,
  Award,
  User,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

interface Lesson {
  id: string
  title: string
  description: string
  type: string
  duration_minutes: number
  is_preview: boolean
  is_free: boolean
  order_index: number
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
  slug: string
  description: string
  short_description: string
  thumbnail_url: string
  video_url: string
  video_provider: string
  price: number
  is_free: boolean
  level: string
  duration_hours: number
  status: string
  instructor: {
    id: string
    full_name: string
    avatar_url: string
  }
  category: {
    id: string
    name: string
  }
  modules: Module[]
}

export default function CourseDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    fetchCourse()
  }, [params.slug])

  const fetchCourse = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          instructor:profiles!instructor_id(id, full_name, avatar_url),
          category:categories(id, name),
          modules:modules(
            *,
            lessons:lessons(*)
          )
        `)
        .eq('slug', params.slug)
        .eq('status', 'published')
        .single()

      if (error) throw error
      setCourse(data)
    } catch (error: any) {
      console.error('Error fetching course:', error)
      toast({
        title: 'Erro',
        description: 'Curso não encontrado',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async () => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    setEnrolling(true)
    try {
      // Usar API de checkout para cursos pagos
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: course?.id,
          userId: user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar inscrição')
      }

      toast({
        title: 'Sucesso!',
        description: 'Você foi inscrito no curso',
      })

      // Se há redirect_url, redirecionar para lá, senão para o curso
      if (data.redirect_url) {
        router.push(data.redirect_url)
      } else {
        router.push(`/my-courses/${course?.slug}`)
      }
    } catch (error: any) {
      console.error('Error enrolling:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao se inscrever',
        variant: 'destructive',
      })
    } finally {
      setEnrolling(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Curso não encontrado</h1>
        <Link href="/courses">
          <Button>Voltar para Cursos</Button>
        </Link>
      </div>
    )
  }

  const totalLessons = course.modules.reduce((acc, module) => acc + module.lessons.length, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/courses">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Preview */}
            {course.video_url && (
              <Card>
                <CardContent className="p-0">
                  <VideoPlayer
                    url={course.video_url}
                    provider={course.video_provider as 'youtube' | 'vimeo'}
                    title={course.title}
                  />
                </CardContent>
              </Card>
            )}

            {/* Course Info */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{course.category.name}</Badge>
                      <Badge variant="outline">{course.level}</Badge>
                    </div>
                    <CardTitle className="text-3xl">{course.title}</CardTitle>
                    <CardDescription className="text-base">
                      {course.short_description || course.description}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {course.is_free ? 'Grátis' : `R$ ${course.price.toFixed(2)}`}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line">
                  {course.description}
                </p>
              </CardContent>
            </Card>

            {/* What You'll Learn */}
            <Card>
              <CardHeader>
                <CardTitle>O que você vai aprender</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid md:grid-cols-2 gap-3">
                  {course.modules.map((module) => (
                    <li key={module.id} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span>{module.title}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Course Content */}
            <Card>
              <CardHeader>
                <CardTitle>Conteúdo do Curso</CardTitle>
                <CardDescription>
                  {course.modules.length} módulo(s) · {totalLessons} aula(s) · {course.duration_hours}h de conteúdo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {course.modules.map((module, index) => (
                    <details key={module.id} className="border rounded-lg">
                      <summary className="p-4 font-semibold cursor-pointer">
                        Módulo {index + 1}: {module.title}
                      </summary>
                      <div className="px-4 pb-4 space-y-2">
                        {module.description && (
                          <p className="text-sm text-muted-foreground">
                            {module.description}
                          </p>
                        )}
                        <div className="space-y-2">
                          {module.lessons
                            .sort((a, b) => a.order_index - b.order_index)
                            .map((lesson) => (
                              <div
                                key={lesson.id}
                                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50"
                              >
                                <div className="flex-shrink-0">
                                  {lesson.is_preview ? (
                                    <Play className="h-4 w-4 text-primary" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {lesson.title}
                                  </p>
                                  {lesson.type && (
                                    <p className="text-xs text-muted-foreground">
                                      {lesson.type} · {lesson.duration_minutes} min
                                    </p>
                                  )}
                                </div>
                                {lesson.is_preview && (
                                  <Badge variant="secondary" className="text-xs">
                                    Preview
                                  </Badge>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Instructor */}
            {course.instructor && (
              <Card>
                <CardHeader>
                  <CardTitle>Sobre o Instrutor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      {course.instructor.avatar_url ? (
                        <img
                          src={course.instructor.avatar_url}
                          alt={course.instructor.full_name}
                          className="w-16 h-16 rounded-full"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-8 w-8 text-primary" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold">{course.instructor.full_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Instrutor especializado
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl font-bold">
                    {course.is_free ? 'Grátis' : `R$ ${course.price.toFixed(2)}`}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      <span>Duração</span>
                    </div>
                    <p className="font-semibold">{course.duration_hours}h</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="h-4 w-4" />
                      <span>Aulas</span>
                    </div>
                    <p className="font-semibold">{totalLessons}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleEnroll}
                    disabled={enrolling}
                  >
                    <Award className="mr-2 h-4 w-4" />
                    {enrolling ? 'Inscrevendo...' : 'Inscrever-se Agora'}
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground text-center">
                  <p>✓ Acesso vitalício</p>
                  <p>✓ Certificado de conclusão</p>
                  <p>✓ Suporte ao estudante</p>
                  <p>✓ Garantia de 7 dias</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
