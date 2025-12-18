'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import {
  BookOpen,
  Star,
  Clock,
  User,
  Play,
  Search,
  Filter,
  Grid,
  List,
  ArrowRight
} from 'lucide-react'

const levels = ['Todos', 'Iniciante', 'Intermediário', 'Avançado']

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [selectedLevel, setSelectedLevel] = useState('Todos')
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([])

  useEffect(() => {
    fetchCategories()
    fetchCourses()
  }, [])

  useEffect(() => {
    fetchCourses()
  }, [search, selectedCategory, selectedLevel])

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name')
    if (data) setCategories(data)
  }

  const fetchCourses = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('courses')
        .select(`
          *,
          category:categories(id, name),
          instructor:profiles!instructor_id(full_name)
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      if (search) {
        query = query.ilike('title', `%${search}%`)
      }

      if (selectedCategory !== 'Todos') {
        query = query.eq('category.name', selectedCategory)
      }

      if (selectedLevel !== 'Todos') {
        query = query.eq('level', selectedLevel === 'Iniciante' ? 'beginner' : selectedLevel === 'Intermediário' ? 'intermediate' : 'advanced')
      }

      // Nota: Filtragem por nome de categoria precisa ser feita no client se não for exata ou se for complexa, 
      // mas aqui vamos assumir que o ID seria melhor. Por compatibilidade visual, faremos filtro client-side para categoria se o join falhar.

      const { data, error } = await query
      if (error) throw error

      // Refinando filtro de categoria no cliente se necessário (limitação do PostgREST com Foreign Key em alguns casos)
      let filteredData = data || []

      if (selectedCategory !== 'Todos') {
        filteredData = filteredData.filter(course => course.category?.name === selectedCategory)
      }

      setCourses(filteredData)
    } catch (error) {
      console.error('Erro ao buscar cursos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Mapeamento de níveis para exibição
  const getLevelLabel = (level: string) => {
    const map: Record<string, string> = {
      'beginner': 'Iniciante',
      'intermediate': 'Intermediário',
      'advanced': 'Avançado'
    }
    return map[level] || level
  }

  const getLevelColor = (level: string) => {
    const map: Record<string, string> = {
      'beginner': 'bg-green-50 text-green-700 border-green-200',
      'intermediate': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'advanced': 'bg-red-50 text-red-700 border-red-200'
    }
    return map[level] || ''
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 py-16">
        <div className="container">
          <div className="text-center space-y-6">
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Explore Nossos <span className="text-primary">Cursos</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Descubra cursos de alta qualidade ministrados por especialistas
              e transforme sua carreira profissional.
            </p>
          </div>
        </div>
      </section>

      {/* Filters and Search */}
      <section className="py-8 border-b">
        <div className="container">
          <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cursos..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              {/* Category Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Categoria:</span>
                <div className="flex space-x-2">
                  <Button
                    variant={selectedCategory === 'Todos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory('Todos')}
                  >
                    Todos
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.name ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(category.name)}
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Level Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Nível:</span>
                <div className="flex space-x-2">
                  {levels.map((level) => (
                    <Button
                      key={level}
                      variant={selectedLevel === level ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedLevel(level)}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>

              {/* View Toggle */}
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Grid className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Courses Grid */}
      <section className="py-12">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">
                Todos os Cursos ({courses.length})
              </h2>
              <p className="text-muted-foreground mr-2">
                {loading ? 'Carregando cursos...' : 'Encontre o curso perfeito para sua carreira'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-96 bg-gray-100 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map((course) => (
                <Card key={course.id} className="group hover:shadow-lg transition-all duration-300">
                  <div className="aspect-video bg-gray-100 rounded-t-lg relative overflow-hidden">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-primary/40" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="secondary" className="rounded-full">
                        <Play className="h-5 w-5 ml-0.5" />
                      </Button>
                    </div>

                    {/* Badges */}
                    <div className="absolute top-4 left-4 space-y-2">
                      {course.is_free && (
                        <Badge variant="secondary" className="shadow-sm">Gratuito</Badge>
                      )}
                      {course.level && (
                        <Badge variant="outline" className={`${getLevelColor(course.level)} shadow-sm`}>
                          {getLevelLabel(course.level)}
                        </Badge>
                      )}
                    </div>

                    {/* Category */}
                    {course.category && (
                      <div className="absolute top-4 right-4">
                        <Badge variant="secondary" className="shadow-sm backdrop-blur-md bg-white/90">
                          {course.category.name}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardHeader>
                    <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors text-lg">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-sm">
                      {course.short_description || course.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Course Info */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-4">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{course.duration_hours || 0}h</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        {/* TODO: Contagem real de alunos */}
                        <span>{Math.floor(Math.random() * 1000) + 100}</span>
                      </div>
                      {course.instructor?.full_name && (
                        <div className="flex items-center space-x-1" title={course.instructor.full_name}>
                          <BookOpen className="h-4 w-4" />
                          <span className="max-w-[80px] truncate">{course.instructor.full_name.split(' ')[0]}</span>
                        </div>
                      )}
                    </div>

                    {/* Price and Action */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-right">
                        {course.is_free ? (
                          <div className="text-lg font-bold text-green-600">Grátis</div>
                        ) : (
                          <div className="text-lg font-bold">
                            R$ {course.price?.toFixed(2).replace('.', ',')}
                          </div>
                        )}
                      </div>
                      <Button asChild size="sm">
                        <Link href={`/courses/${course.slug}`}>
                          Ver Detalhes
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Load More */}
          {!loading && courses.length > 0 && (
            <div className="text-center mt-12">
              <p className="text-muted-foreground text-sm mb-4">Mostrando {courses.length} cursos</p>
            </div>
          )}

          {!loading && courses.length === 0 && (
            <div className="text-center py-20">
              <h3 className="text-xl font-medium text-muted-foreground">Nenhum curso encontrado com estes filtros.</h3>
              <Button
                variant="link"
                onClick={() => {
                  setSearch('')
                  setSelectedCategory('Todos')
                  setSelectedLevel('Todos')
                }}
                className="mt-2"
              >
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
