'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'
import { BookOpen, Clock, TrendingUp, Play, Award, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface Enrollment {
  id: string
  enrolled_at: string
  completed_at: string | null
  progress_percentage: number
  course: {
    id: string
    title: string
    slug: string
    thumbnail_url: string
    duration_hours: number
    level: string
  }
}

export default function MyCoursesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    } else if (user) {
      fetchEnrollments()
    }
  }, [user, authLoading])

  const fetchEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          enrolled_at,
          completed_at,
          progress_percentage,
          course:courses(id, title, slug, thumbnail_url, duration_hours, level)
        `)
        .eq('user_id', user?.id)
        .order('enrolled_at', { ascending: false })

      if (error) throw error
      setEnrollments(data || [])
    } catch (error: any) {
      console.error('Error fetching enrollments:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao carregar seus cursos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const activeCourses = enrollments.filter(e => !e.completed_at)
  const completedCourses = enrollments.filter(e => e.completed_at)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-2">Meus Cursos</h1>
          <p className="text-muted-foreground">
            Continue de onde parou
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {enrollments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Você ainda não está inscrito em nenhum curso</h3>
              <p className="text-muted-foreground mb-6">
                Explore nossos cursos e comece sua jornada de aprendizado
              </p>
              <Link href="/courses">
                <Button>
                  Explorar Cursos
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Active Courses */}
            {activeCourses.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-semibold">Em Progresso</h2>
                  <Badge variant="secondary">{activeCourses.length}</Badge>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeCourses.map((enrollment) => (
                    <Card key={enrollment.id} className="hover:shadow-lg transition-shadow">
                      <div className="relative">
                        {enrollment.course.thumbnail_url ? (
                          <img
                            src={enrollment.course.thumbnail_url}
                            alt={enrollment.course.title}
                            className="w-full h-48 object-cover rounded-t-lg"
                          />
                        ) : (
                          <div className="w-full h-48 bg-primary/10 rounded-t-lg flex items-center justify-center">
                            <BookOpen className="h-16 w-16 text-primary/30" />
                          </div>
                        )}
                        <Badge className="absolute top-3 right-3">
                          {enrollment.course.level}
                        </Badge>
                      </div>
                      <CardHeader>
                        <CardTitle className="line-clamp-2">
                          {enrollment.course.title}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {enrollment.course.duration_hours}h
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Progresso</span>
                            <span className="text-sm text-muted-foreground">
                              {enrollment.progress_percentage}%
                            </span>
                          </div>
                          <Progress value={enrollment.progress_percentage} />
                        </div>
                        <Link href={`/my-courses/${enrollment.course.slug}`}>
                          <Button className="w-full">
                            <Play className="mr-2 h-4 w-4" />
                            Continuar Curso
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Courses */}
            {completedCourses.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <h2 className="text-2xl font-semibold">Concluídos</h2>
                  <Badge variant="secondary">{completedCourses.length}</Badge>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {completedCourses.map((enrollment) => (
                    <Card key={enrollment.id} className="hover:shadow-lg transition-shadow">
                      <div className="relative">
                        {enrollment.course.thumbnail_url ? (
                          <img
                            src={enrollment.course.thumbnail_url}
                            alt={enrollment.course.title}
                            className="w-full h-48 object-cover rounded-t-lg opacity-75"
                          />
                        ) : (
                          <div className="w-full h-48 bg-primary/10 rounded-t-lg flex items-center justify-center opacity-75">
                            <BookOpen className="h-16 w-16 text-primary/30" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 rounded-t-lg" />
                        <Badge className="absolute top-3 right-3" variant="secondary">
                          {enrollment.course.level}
                        </Badge>
                        <div className="absolute bottom-3 left-3 right-3">
                          <Badge className="bg-green-500">
                            <Award className="mr-1 h-3 w-3" />
                            Concluído
                          </Badge>
                        </div>
                      </div>
                      <CardHeader>
                        <CardTitle className="line-clamp-2">
                          {enrollment.course.title}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {enrollment.course.duration_hours}h
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Link href={`/my-courses/${enrollment.course.slug}`}>
                          <Button className="w-full" variant="outline">
                            Revisar Curso
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
