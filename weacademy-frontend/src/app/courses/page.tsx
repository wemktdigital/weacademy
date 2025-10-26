import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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

// Mock data - em produção viria do Supabase
const courses = [
  {
    id: '1',
    title: 'React do Zero ao Avançado',
    slug: 'react-do-zero-ao-avancado',
    description: 'Domine React e crie aplicações modernas e escaláveis',
    short_description: 'Aprenda React desde o básico até conceitos avançados',
    thumbnail_url: '/courses/react.jpg',
    price: 199.90,
    is_free: false,
    level: 'intermediate',
    duration_hours: 40,
    category: 'Desenvolvimento Web',
    instructor: 'João Silva',
    rating: 4.9,
    reviews_count: 1200,
    students_count: 2500,
    is_published: true
  },
  {
    id: '2',
    title: 'JavaScript Fundamentos',
    slug: 'javascript-fundamentos',
    description: 'Aprenda JavaScript do zero com projetos práticos',
    short_description: 'Fundamentos essenciais do JavaScript moderno',
    thumbnail_url: '/courses/javascript.jpg',
    price: 0,
    is_free: true,
    level: 'beginner',
    duration_hours: 20,
    category: 'Desenvolvimento Web',
    instructor: 'Maria Santos',
    rating: 4.8,
    reviews_count: 856,
    students_count: 5200,
    is_published: true
  },
  {
    id: '3',
    title: 'UI/UX Design com Figma',
    slug: 'ui-ux-design-com-figma',
    description: 'Domine o Figma e crie designs profissionais',
    short_description: 'Design de interfaces modernas com Figma',
    thumbnail_url: '/courses/figma.jpg',
    price: 149.90,
    is_free: false,
    level: 'beginner',
    duration_hours: 25,
    category: 'Design',
    instructor: 'Ana Costa',
    rating: 4.9,
    reviews_count: 324,
    students_count: 1800,
    is_published: true
  },
  {
    id: '4',
    title: 'Marketing Digital Completo',
    slug: 'marketing-digital-completo',
    description: 'Estratégias completas de marketing digital',
    short_description: 'SEO, SEM, redes sociais e análise de dados',
    thumbnail_url: '/courses/marketing.jpg',
    price: 299.90,
    is_free: false,
    level: 'intermediate',
    duration_hours: 35,
    category: 'Marketing Digital',
    instructor: 'Carlos Lima',
    rating: 4.7,
    reviews_count: 567,
    students_count: 1200,
    is_published: true
  },
  {
    id: '5',
    title: 'Python para Data Science',
    slug: 'python-para-data-science',
    description: 'Python para análise de dados e machine learning',
    short_description: 'Pandas, NumPy, Matplotlib e machine learning básico',
    thumbnail_url: '/courses/python.jpg',
    price: 249.90,
    is_free: false,
    level: 'intermediate',
    duration_hours: 30,
    category: 'Tecnologia',
    instructor: 'Pedro Oliveira',
    rating: 4.8,
    reviews_count: 423,
    students_count: 1500,
    is_published: true
  },
  {
    id: '6',
    title: 'Node.js e Express',
    slug: 'nodejs-express',
    description: 'Desenvolvimento backend com Node.js e Express',
    short_description: 'APIs RESTful e desenvolvimento de servidores',
    thumbnail_url: '/courses/nodejs.jpg',
    price: 179.90,
    is_free: false,
    level: 'intermediate',
    duration_hours: 28,
    category: 'Desenvolvimento Web',
    instructor: 'João Silva',
    rating: 4.6,
    reviews_count: 298,
    students_count: 980,
    is_published: true
  }
]

const categories = [
  'Todos',
  'Desenvolvimento Web',
  'Design',
  'Marketing Digital',
  'Tecnologia',
  'Negócios'
]

const levels = ['Todos', 'Iniciante', 'Intermediário', 'Avançado']

export default function CoursesPage() {
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
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              {/* Category Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Categoria:</span>
                <div className="flex space-x-2">
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={category === 'Todos' ? 'default' : 'outline'}
                      size="sm"
                    >
                      {category}
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
                      variant={level === 'Todos' ? 'default' : 'outline'}
                      size="sm"
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
              <p className="text-muted-foreground">
                Encontre o curso perfeito para sua carreira
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course) => (
              <Card key={course.id} className="group hover:shadow-lg transition-all duration-300">
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/40 rounded-t-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Badges */}
                  <div className="absolute top-4 left-4 space-y-2">
                    {course.is_free && (
                      <Badge variant="secondary">Gratuito</Badge>
                    )}
                    {course.level === 'beginner' && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Iniciante
                      </Badge>
                    )}
                    {course.level === 'intermediate' && (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        Intermediário
                      </Badge>
                    )}
                    {course.level === 'advanced' && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        Avançado
                      </Badge>
                    )}
                  </div>

                  {/* Category */}
                  <div className="absolute top-4 right-4">
                    <Badge variant="secondary">{course.category}</Badge>
                  </div>
                </div>

                <CardHeader>
                  <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                    {course.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {course.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Rating */}
                  <div className="flex items-center space-x-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`h-4 w-4 ${
                            i < Math.floor(course.rating) 
                              ? 'fill-yellow-400 text-yellow-400' 
                              : 'text-gray-300'
                          }`} 
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {course.rating} ({course.reviews_count.toLocaleString()})
                    </span>
                  </div>

                  {/* Course Info */}
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{course.duration_hours}h</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>{course.students_count.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BookOpen className="h-4 w-4" />
                      <span>{course.instructor}</span>
                    </div>
                  </div>

                  {/* Price and Action */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-right">
                      {course.is_free ? (
                        <div className="text-lg font-bold text-green-600">Gratuito</div>
                      ) : (
                        <div className="text-lg font-bold">
                          R$ {course.price.toFixed(2).replace('.', ',')}
                        </div>
                      )}
                    </div>
                    <Button asChild>
                      <Link href={`/courses/${course.slug}`}>
                        Ver Curso
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More */}
          <div className="text-center mt-12">
            <Button size="lg" variant="outline">
              Carregar Mais Cursos
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
